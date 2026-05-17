"""REST API live connections — fetch, cache in Redis, notify via WebSocket."""

from __future__ import annotations

import json
import logging
import uuid
from datetime import datetime, timezone
from typing import Any

import httpx
import pandas as pd
import redis
from sqlalchemy import select

from core.config import get_settings
from core.crypto_utils import decrypt_json, encrypt_json
from core.sync_db import sync_session_scope
from core.websocket_manager import publish_ws_event
from models.live_connection import LiveConnection, LiveConnectionStatus

logger = logging.getLogger(__name__)

# CoinDesk BPI was retired; use free public price feeds (no API key).
BTC_DEMO_URLS = (
    "https://api.coingecko.com/api/v3/simple/price?ids=bitcoin&vs_currencies=usd",
    "https://api.binance.com/api/v3/ticker/price?symbol=BTCUSDT",
)
BTC_DEMO_NAME = "Live BTC Price Demo"
BTC_DEMO_X = "time"
BTC_DEMO_Y = "USD"
_LEGACY_COINDESK_HOST = "api.coindesk.com"


class LiveDataService:
    @staticmethod
    def _redis() -> redis.Redis:
        return redis.from_url(get_settings().redis_url, decode_responses=True)

    @staticmethod
    def _latest_key(connection_id: str) -> str:
        return f"live:{connection_id}:latest"

    @staticmethod
    def _history_key(connection_id: str) -> str:
        return f"live:{connection_id}:history"

    @classmethod
    def validate_json_response(
        cls,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        body: str | None = None,
    ) -> dict[str, Any]:
        try:
            with httpx.Client(timeout=30.0, follow_redirects=True) as client:
                resp = client.request(
                    method.upper(),
                    url,
                    headers=headers or {},
                    content=body if method.upper() != "GET" else None,
                )
                resp.raise_for_status()
                return resp.json()
        except httpx.ConnectError as exc:
            raise ValueError(
                f"Could not reach API host ({url}). Check the URL and your network/DNS."
            ) from exc
        except httpx.HTTPStatusError as exc:
            raise ValueError(
                f"API returned HTTP {exc.response.status_code} for {url}"
            ) from exc

    @classmethod
    def fetch_first_available(
        cls,
        urls: tuple[str, ...],
        method: str = "GET",
        headers: dict[str, str] | None = None,
    ) -> tuple[dict[str, Any], str]:
        """Try URLs in order; return (json_payload, url_that_worked)."""
        last_err: Exception | None = None
        for url in urls:
            try:
                return cls.validate_json_response(url, method, headers), url
            except Exception as exc:
                last_err = exc
                logger.warning("Live API probe failed for %s: %s", url, exc)
        raise ValueError(
            f"All price API endpoints failed. Last error: {last_err}"
        ) from last_err

    @classmethod
    def json_to_records(
        cls,
        payload: dict[str, Any],
        x_field: str | None = None,
        y_field: str | None = None,
    ) -> list[dict[str, Any]]:
        """Normalize JSON API payloads into chart-friendly rows."""
        if x_field and y_field:
            flat = pd.json_normalize(payload, sep=".")
            if x_field in flat.columns and y_field in flat.columns:
                return [
                    {x_field: row[x_field], y_field: row[y_field]}
                    for _, row in flat.iterrows()
                ]

        now = datetime.now(timezone.utc).isoformat()

        if "bitcoin" in payload and isinstance(payload["bitcoin"], dict):
            usd = payload["bitcoin"].get("usd")
            if usd is not None:
                return [{"time": now, "USD": float(usd)}]

        if "price" in payload and payload.get("symbol") in (
            "BTCUSDT",
            "BTCUSD",
            None,
        ):
            try:
                return [{"time": now, "USD": float(payload["price"])}]
            except (TypeError, ValueError):
                pass

        if "bpi" in payload and isinstance(payload["bpi"], dict):
            updated = (payload.get("time") or {}).get("updated", now)
            usd = payload["bpi"].get("USD", {})
            rate = usd.get("rate_float") or float(
                str(usd.get("rate", "0")).replace(",", "")
            )
            return [{"time": updated, "USD": rate}]

        if isinstance(payload, list):
            return payload

        flat = pd.json_normalize(payload, sep=".")
        if flat.empty:
            return [payload]
        return json.loads(flat.to_json(orient="records", date_format="iso"))

    @classmethod
    def connect_rest_api(
        cls,
        user_id: str,
        name: str,
        url: str,
        headers: dict[str, str] | None = None,
        method: str = "GET",
        body: str | None = None,
        refresh_seconds: int = 60,
        x_field: str | None = None,
        y_field: str | None = None,
    ) -> str:
        cls.validate_json_response(url, method, headers, body)
        uid = uuid.UUID(user_id)

        with sync_session_scope() as session:
            conn_id = cls._create_connection_row(
                session,
                user_id=uid,
                name=name,
                url=url,
                method=method,
                headers=headers,
                body=body,
                refresh_seconds=refresh_seconds,
                x_field=x_field,
                y_field=y_field,
            )

        from tasks.live_tasks import fetch_and_cache

        fetch_and_cache.delay(str(conn_id))
        return str(conn_id)

    @classmethod
    def ensure_btc_demo(cls, user_id: str) -> str:
        uid = uuid.UUID(user_id)
        _, working_url = cls.fetch_first_available(BTC_DEMO_URLS)

        with sync_session_scope() as session:
            existing = session.execute(
                select(LiveConnection).where(
                    LiveConnection.user_id == uid,
                    LiveConnection.name == BTC_DEMO_NAME,
                )
            ).scalar_one_or_none()
            if existing:
                if _LEGACY_COINDESK_HOST in existing.api_url or existing.api_url not in BTC_DEMO_URLS:
                    existing.api_url = working_url
                    existing.status = LiveConnectionStatus.active
                    existing.last_error = None
                conn_id = str(existing.id)
            else:
                conn_id = str(
                    cls._create_connection_row(
                        session,
                        user_id=uid,
                        name=BTC_DEMO_NAME,
                        url=working_url,
                        refresh_seconds=30,
                        x_field=BTC_DEMO_X,
                        y_field=BTC_DEMO_Y,
                    )
                )

        from tasks.live_tasks import fetch_and_cache

        fetch_and_cache.delay(conn_id)
        return conn_id

    @classmethod
    def _create_connection_row(
        cls,
        session,
        *,
        user_id: uuid.UUID,
        name: str,
        url: str,
        method: str = "GET",
        headers: dict[str, str] | None = None,
        body: str | None = None,
        refresh_seconds: int = 60,
        x_field: str | None = None,
        y_field: str | None = None,
    ) -> uuid.UUID:
        conn_id = uuid.uuid4()
        session.add(
            LiveConnection(
                id=conn_id,
                user_id=user_id,
                name=name,
                api_url=url,
                method=method.upper(),
                headers=encrypt_json(headers or {}),
                request_body=body,
                refresh_interval=max(30, min(refresh_seconds, 86400)),
                chart_x_field=x_field,
                chart_y_field=y_field,
                status=LiveConnectionStatus.active,
            )
        )
        return conn_id

    @classmethod
    def fetch_and_cache(cls, connection_id: str) -> dict[str, Any]:
        cid = uuid.UUID(connection_id)
        with sync_session_scope() as session:
            row = session.get(LiveConnection, cid)
            if row is None:
                return {"ok": False, "error": "not found"}
            if row.status != LiveConnectionStatus.active:
                return {"ok": False, "error": "not active"}
            url = row.api_url
            method = row.method
            headers = decrypt_json(row.headers)
            body = row.request_body
            user_id = str(row.user_id)
            name = row.name
            x_field = row.chart_x_field
            y_field = row.chart_y_field

        try:
            if name == BTC_DEMO_NAME:
                payload, url = cls.fetch_first_available(
                    BTC_DEMO_URLS, method, headers
                )
                with sync_session_scope() as session:
                    row = session.get(LiveConnection, cid)
                    if row and row.api_url != url:
                        row.api_url = url
            else:
                payload = cls.validate_json_response(url, method, headers, body)
            records = cls.json_to_records(payload, x_field, y_field)
            df = pd.DataFrame(records) if records else pd.DataFrame()
            records = json.loads(df.to_json(orient="records", date_format="iso"))
            snapshot = {
                "fetched_at": datetime.now(timezone.utc).isoformat(),
                "records": records,
                "row_count": len(df),
                "raw": payload,
            }
            r = cls._redis()
            latest_key = cls._latest_key(connection_id)
            history_key = cls._history_key(connection_id)
            r.set(latest_key, json.dumps(snapshot))
            r.lpush(history_key, json.dumps(snapshot))
            r.ltrim(history_key, 0, 99)

            with sync_session_scope() as session:
                row = session.get(LiveConnection, cid)
                if row:
                    row.last_fetched_at = datetime.now(timezone.utc)
                    row.last_row_count = len(records)
                    row.status = LiveConnectionStatus.active
                    row.last_error = None

            publish_ws_event(
                user_id,
                {
                    "type": "live_data_update",
                    "connection_id": connection_id,
                    "name": name,
                    "points": records,
                    "x_field": x_field,
                    "y_field": y_field,
                },
            )
            return {"ok": True, "row_count": len(records)}
        except Exception as exc:
            err = str(exc)[:2000]
            logger.warning("Live fetch failed for %s: %s", connection_id, err)
            with sync_session_scope() as session:
                row = session.get(LiveConnection, cid)
                if row:
                    row.status = LiveConnectionStatus.error
                    row.last_error = err
            publish_ws_event(
                user_id,
                {
                    "type": "live_data_error",
                    "connection_id": connection_id,
                    "message": err,
                },
            )
            return {"ok": False, "error": err}

    @classmethod
    def get_latest_snapshot(cls, connection_id: str) -> dict[str, Any] | None:
        raw = cls._redis().get(cls._latest_key(connection_id))
        if not raw:
            return None
        return json.loads(raw)

    @classmethod
    def get_history_series(cls, connection_id: str) -> list[dict[str, Any]]:
        """Flatten history snapshots into a growing time series (for demo charts)."""
        items = cls._redis().lrange(cls._history_key(connection_id), 0, 99)
        points: list[dict[str, Any]] = []
        for item in reversed(items):
            snap = json.loads(item)
            for rec in snap.get("records") or []:
                points.append(rec)
        return points[-100:]
