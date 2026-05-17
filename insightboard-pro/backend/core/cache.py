"""Redis caching with orjson — decorators, bulk ops, invalidation."""

from __future__ import annotations

import hashlib
import inspect
import logging
from collections.abc import Awaitable, Callable, Iterable
from functools import wraps
from typing import Any, ParamSpec, TypeVar

import orjson
import redis.asyncio as aioredis

from core.redis_client import get_redis

logger = logging.getLogger(__name__)

P = ParamSpec("P")
R = TypeVar("R")

# TTL presets (seconds)
TTL_CHART_DATA = 300
TTL_DATASET_EDA = 3600
TTL_AI_SUMMARY = 86400
TTL_PUBLIC_DASHBOARD = 60


def _serialize(value: Any) -> bytes:
    if hasattr(value, "model_dump"):
        value = value.model_dump(mode="json")
    return orjson.dumps(value, default=str)


def _deserialize(raw: bytes | str) -> Any:
    if isinstance(raw, str):
        raw = raw.encode()
    return orjson.loads(raw)


def cache_key(*parts: str) -> str:
    return ":".join(str(p) for p in parts if p is not None)


def cache_key_hash(prefix: str, params: dict[str, Any]) -> str:
    payload = orjson.dumps(params, option=orjson.OPT_SORT_KEYS)
    digest = hashlib.sha256(payload).hexdigest()[:16]
    return f"{prefix}:{digest}"


async def cache_get(key: str) -> Any | None:
    try:
        client = await get_redis()
        raw = await client.get(key)
        if raw is None:
            return None
        if isinstance(raw, str):
            raw = raw.encode()
        return _deserialize(raw)
    except Exception:
        logger.exception("cache_get failed for %s", key)
        return None


async def cache_set(key: str, value: Any, ttl: int) -> None:
    try:
        client = await get_redis()
        await client.setex(key, ttl, _serialize(value))
    except Exception:
        logger.exception("cache_set failed for %s", key)


async def cache_delete(key: str) -> None:
    try:
        client = await get_redis()
        await client.delete(key)
    except Exception:
        logger.exception("cache_delete failed for %s", key)


async def cache_many(
    items: dict[str, Any],
    ttl: int,
) -> None:
    """Set multiple keys in one pipeline."""
    if not items:
        return
    try:
        client = await get_redis()
        pipe = client.pipeline()
        for key, value in items.items():
            pipe.setex(key, ttl, _serialize(value))
        await pipe.execute()
    except Exception:
        logger.exception("cache_many failed")


async def cache_get_many(keys: Iterable[str]) -> dict[str, Any]:
    key_list = list(keys)
    if not key_list:
        return {}
    try:
        client = await get_redis()
        values = await client.mget(key_list)
        out: dict[str, Any] = {}
        for key, raw in zip(key_list, values, strict=True):
            if raw is not None:
                out[key] = _deserialize(raw)
        return out
    except Exception:
        logger.exception("cache_get_many failed")
        return {}


async def invalidate_prefix(prefix: str) -> int:
    """Delete all keys matching prefix*."""
    pattern = f"{prefix}*"
    deleted = 0
    try:
        client = await get_redis()
        async for key in client.scan_iter(match=pattern, count=100):
            await client.delete(key)
            deleted += 1
    except Exception:
        logger.exception("invalidate_prefix failed for %s", prefix)
    return deleted


async def invalidate_dataset(dataset_id: str) -> None:
    await invalidate_prefix(f"dataset:{dataset_id}")
    await invalidate_prefix(f"chart:{dataset_id}")


def invalidate_dataset_sync(dataset_id: str) -> None:
    """Sync invalidation for Celery workers."""
    import redis

    from core.config import get_settings

    try:
        r = redis.from_url(get_settings().redis_url)
        for pattern in (f"dataset:{dataset_id}*", f"chart:{dataset_id}*"):
            for key in r.scan_iter(match=pattern, count=100):
                r.delete(key)
        r.close()
    except Exception:
        logger.exception("invalidate_dataset_sync failed for %s", dataset_id)


def cache(
    prefix: str,
    ttl: int = 300,
    *,
    key_arg: str | None = None,
    key_builder: Callable[..., str] | None = None,
) -> Callable[[Callable[P, Awaitable[R]]], Callable[P, Awaitable[R]]]:
    """Async Redis cache decorator."""

    def decorator(func: Callable[P, Awaitable[R]]) -> Callable[P, Awaitable[R]]:
        sig = inspect.signature(func)

        @wraps(func)
        async def wrapper(*args: P.args, **kwargs: P.kwargs) -> R:
            if key_builder is not None:
                redis_key = key_builder(*args, **kwargs)
            elif key_arg and key_arg in kwargs:
                redis_key = cache_key(prefix, str(kwargs[key_arg]))
            elif key_arg:
                bound = sig.bind_partial(*args, **kwargs)
                bound.apply_defaults()
                redis_key = cache_key(prefix, str(bound.arguments.get(key_arg, "")))
            else:
                redis_key = cache_key(prefix, hashlib.sha256(repr((args, kwargs)).encode()).hexdigest()[:12])

            hit = await cache_get(redis_key)
            if hit is not None:
                return hit  # type: ignore[return-value]

            result = await func(*args, **kwargs)
            await cache_set(redis_key, result, ttl)
            return result

        return wrapper

    return decorator
