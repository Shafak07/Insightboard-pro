import json
from typing import Any

import redis.asyncio as aioredis

from core.config import get_settings

settings = get_settings()

_redis: aioredis.Redis | None = None


async def get_redis() -> aioredis.Redis:
    global _redis
    if _redis is None:
        _redis = aioredis.from_url(
            settings.redis_url,
            encoding="utf-8",
            decode_responses=True,
        )
    return _redis


async def close_redis() -> None:
    global _redis
    if _redis is not None:
        await _redis.aclose()
        _redis = None


async def cache_get(key: str) -> Any | None:
    client = await get_redis()
    value = await client.get(key)
    if value is None:
        return None
    return json.loads(value)


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    client = await get_redis()
    ttl = ttl or settings.cache_ttl_seconds
    await client.setex(key, ttl, json.dumps(value))


async def ping_redis() -> bool:
    try:
        client = await get_redis()
        return await client.ping()
    except Exception:
        return False
