from typing import Any

import orjson
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
            decode_responses=False,
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
    if isinstance(value, str):
        value = value.encode()
    return orjson.loads(value)


async def cache_set(key: str, value: Any, ttl: int | None = None) -> None:
    client = await get_redis()
    ttl = ttl or settings.cache_ttl_seconds
    payload = value
    if hasattr(payload, "model_dump"):
        payload = payload.model_dump(mode="json")
    await client.setex(key, ttl, orjson.dumps(payload, default=str))


async def ping_redis() -> bool:
    try:
        client = await get_redis()
        return await client.ping()
    except Exception:
        return False
