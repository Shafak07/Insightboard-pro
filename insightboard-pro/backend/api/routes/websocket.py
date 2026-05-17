"""WebSocket endpoint: /api/v1/ws/{user_id}?token=..."""

from __future__ import annotations

import asyncio
import json
from typing import Annotated

from fastapi import APIRouter, Query, WebSocket, WebSocketDisconnect
from fastapi import HTTPException

from core.auth import verify_supabase_token
from core.websocket_manager import connection_manager

router = APIRouter()

PING_INTERVAL_SEC = 30


def _user_id_from_token(token: str) -> str | None:
    try:
        payload = verify_supabase_token(token)
        return payload.get("sub")
    except HTTPException:
        return None


@router.websocket("/{user_id}")
async def websocket_endpoint(
    websocket: WebSocket,
    user_id: str,
    token: Annotated[str | None, Query()] = None,
) -> None:
    if not token:
        await websocket.close(code=4401)
        return

    token_user = _user_id_from_token(token)
    if not token_user or token_user != user_id:
        await websocket.close(code=4401)
        return

    await connection_manager.connect(websocket, user_id)
    await connection_manager.send_to_user(
        user_id,
        {"type": "connected", "user_id": user_id},
    )

    stop = asyncio.Event()

    async def ping_loop() -> None:
        while not stop.is_set():
            await asyncio.sleep(PING_INTERVAL_SEC)
            if stop.is_set():
                break
            try:
                await websocket.send_json({"type": "ping"})
            except Exception:
                stop.set()
                break

    ping_task = asyncio.create_task(ping_loop())

    try:
        while True:
            raw = await websocket.receive_text()
            try:
                data = json.loads(raw)
            except json.JSONDecodeError:
                continue
            msg_type = data.get("type")
            if msg_type == "pong":
                continue
            if msg_type == "dashboard_subscribe":
                dash_id = data.get("dashboard_id")
                if dash_id:
                    connection_manager.subscribe_dashboard(user_id, str(dash_id))
                    await connection_manager.notify_dashboard_viewers(str(dash_id))
            elif msg_type == "dashboard_unsubscribe":
                dash_id = data.get("dashboard_id")
                if dash_id:
                    connection_manager.unsubscribe_dashboard(user_id, str(dash_id))
                    await connection_manager.notify_dashboard_viewers(str(dash_id))
    except WebSocketDisconnect:
        pass
    finally:
        stop.set()
        ping_task.cancel()
        try:
            await ping_task
        except asyncio.CancelledError:
            pass
        connection_manager.disconnect(websocket, user_id)
