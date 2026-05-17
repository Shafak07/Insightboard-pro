"""Backward-compatible re-exports — prefer core.websocket_manager."""

from core.websocket_manager import (
    REDIS_DATASET_CHANNEL as REDIS_CHANNEL,
    REDIS_WS_CHANNEL,
    connection_manager,
    publish_dataset_event,
    publish_ws_event,
)

ws_manager = connection_manager

__all__ = [
    "REDIS_CHANNEL",
    "REDIS_WS_CHANNEL",
    "connection_manager",
    "publish_dataset_event",
    "publish_ws_event",
    "ws_manager",
]
