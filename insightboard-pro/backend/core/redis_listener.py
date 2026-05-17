"""Bridge Redis Pub/Sub (Celery) → WebSocket clients."""

import asyncio
import json
import logging

import redis.asyncio as aioredis

from core.config import get_settings
from core.websocket_manager import (
    REDIS_DATASET_CHANNEL,
    REDIS_WS_CHANNEL,
    connection_manager,
)

logger = logging.getLogger(__name__)

CHANNELS = [REDIS_WS_CHANNEL, REDIS_DATASET_CHANNEL]


async def listen_dataset_events(stop: asyncio.Event) -> None:
    settings = get_settings()
    r = None
    pubsub = None
    try:
        r = aioredis.from_url(settings.redis_url, decode_responses=True)
        pubsub = r.pubsub()
        await pubsub.subscribe(*CHANNELS)
        while not stop.is_set():
            try:
                msg = await asyncio.wait_for(
                    pubsub.get_message(ignore_subscribe_messages=True),
                    timeout=1.0,
                )
            except asyncio.TimeoutError:
                continue
            if msg is None or msg["type"] != "message":
                continue
            try:
                body = json.loads(msg["data"])
                await connection_manager.send_to_user(
                    body["user_id"],
                    body["payload"],
                )
            except Exception:
                logger.exception("Failed to forward WS notification")
    except asyncio.CancelledError:
        raise
    except Exception:
        logger.exception("Redis listener error")
    finally:
        if pubsub is not None:
            for ch in CHANNELS:
                try:
                    await pubsub.unsubscribe(ch)
                except Exception:
                    pass
        if r is not None:
            try:
                await r.aclose()
            except Exception:
                pass
