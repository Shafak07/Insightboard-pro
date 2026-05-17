"""Production health check at GET /health (no API prefix)."""

from __future__ import annotations

import time

from fastapi import APIRouter
from sqlalchemy import text

from core.database import AsyncSessionLocal
from core.redis_client import ping_redis

router = APIRouter()
_started_at = time.time()


async def _database_status() -> str:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return "connected"
    except Exception:
        return "disconnected"


@router.get("")
async def health_check() -> dict[str, str | int]:
    db = await _database_status()
    redis = "connected" if await ping_redis() else "disconnected"

    if db == "connected" and redis == "connected":
        status = "healthy"
    elif db == "disconnected" and redis == "disconnected":
        status = "unhealthy"
    else:
        status = "degraded"

    return {
        "status": status,
        "database": db,
        "redis": redis,
        "version": "1.0.0",
        "uptime_seconds": int(time.time() - _started_at),
    }
