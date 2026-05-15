from fastapi import APIRouter
from sqlalchemy import text

from core.config import get_settings
from core.database import AsyncSessionLocal
from core.redis_client import ping_redis
from schemas.common import ApiResponse, HealthStatus

router = APIRouter()
settings = get_settings()


async def check_database() -> bool:
    try:
        async with AsyncSessionLocal() as session:
            await session.execute(text("SELECT 1"))
        return True
    except Exception:
        return False


@router.get("", response_model=ApiResponse[HealthStatus])
async def health_check() -> ApiResponse[HealthStatus]:
    db_ok = await check_database()
    redis_ok = await ping_redis()

    status: str = "ok"
    if not db_ok or not redis_ok:
        status = "degraded" if db_ok or redis_ok else "error"

    return ApiResponse(
        success=True,
        data=HealthStatus(
            status=status,  # type: ignore[arg-type]
            version="0.1.0",
            services={"database": db_ok, "redis": redis_ok},
        ),
    )
