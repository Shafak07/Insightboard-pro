"""WebSocket connection registry and Redis pub/sub bridge for Celery workers."""

from __future__ import annotations

import json
import logging
from typing import Any

from fastapi import WebSocket

from core.config import get_settings

logger = logging.getLogger(__name__)

REDIS_WS_CHANNEL = "insightboard:ws_events"
# Legacy channel — still published for older listeners during transition
REDIS_DATASET_CHANNEL = "insightboard:dataset_events"


class ConnectionManager:
    def __init__(self) -> None:
        self.connections: dict[str, list[WebSocket]] = {}
        self._dashboard_viewers: dict[str, set[str]] = {}

    async def connect(self, websocket: WebSocket, user_id: str) -> None:
        await websocket.accept()
        self.connections.setdefault(user_id, []).append(websocket)

    def disconnect(self, websocket: WebSocket, user_id: str) -> None:
        conns = self.connections.get(user_id)
        if not conns:
            return
        if websocket in conns:
            conns.remove(websocket)
        if not conns:
            self.connections.pop(user_id, None)
        for dash_id, viewers in list(self._dashboard_viewers.items()):
            viewers.discard(user_id)
            if not viewers:
                self._dashboard_viewers.pop(dash_id, None)

    async def send_to_user(self, user_id: str, message: dict[str, Any]) -> None:
        dead: list[WebSocket] = []
        for ws in self.connections.get(user_id, []):
            try:
                await ws.send_json(message)
            except Exception:
                dead.append(ws)
        for ws in dead:
            self.disconnect(ws, user_id)

    async def broadcast(self, message: dict[str, Any]) -> None:
        for user_id in list(self.connections.keys()):
            await self.send_to_user(user_id, message)

    def subscribe_dashboard(self, user_id: str, dashboard_id: str) -> int:
        viewers = self._dashboard_viewers.setdefault(dashboard_id, set())
        viewers.add(user_id)
        return len(viewers)

    def unsubscribe_dashboard(self, user_id: str, dashboard_id: str) -> int:
        viewers = self._dashboard_viewers.get(dashboard_id)
        if not viewers:
            return 0
        viewers.discard(user_id)
        if not viewers:
            self._dashboard_viewers.pop(dashboard_id, None)
            return 0
        return len(viewers)

    async def notify_dashboard_viewers(self, dashboard_id: str) -> None:
        count = len(self._dashboard_viewers.get(dashboard_id, set()))
        msg = {
            "type": "dashboard_view",
            "dashboard_id": dashboard_id,
            "viewer_count": count,
        }
        for uid in self._dashboard_viewers.get(dashboard_id, set()):
            await self.send_to_user(uid, msg)


connection_manager = ConnectionManager()


def publish_ws_event(user_id: str, message: dict[str, Any]) -> None:
    """Publish a typed WebSocket payload from sync Celery workers."""
    if "type" not in message:
        logger.warning("WS message missing type field: %s", message)
    envelope = json.dumps({"user_id": user_id, "payload": message})
    try:
        import redis

        settings = get_settings()
        r = redis.from_url(settings.redis_url)
        r.publish(REDIS_WS_CHANNEL, envelope)
        r.publish(REDIS_DATASET_CHANNEL, envelope)
        r.close()
    except Exception:
        logger.exception("Failed to publish WS event")


def publish_dataset_event(user_id: str, payload: dict[str, Any]) -> None:
    """Backward-compatible alias used by ETL tasks."""
    publish_ws_event(user_id, payload)
