from collections.abc import AsyncGenerator
from uuid import uuid4

from sqlalchemy.ext.asyncio import AsyncSession, async_sessionmaker, create_async_engine
from sqlalchemy.orm import DeclarativeBase
from sqlalchemy.pool import NullPool

from core.config import get_settings
from core.db_connect import get_async_connect_args

settings = get_settings()
_async_url = settings.database_url_async

_connect_args = get_async_connect_args(_async_url)
_engine_kwargs: dict = {
    "echo": settings.debug,
    "connect_args": _connect_args,
}

# Supabase transaction pooler (:6543) + PgBouncer: disable asyncpg caches and use
# unique prepared-statement names (see SQLAlchemy asyncpg dialect docs).
if settings.uses_supabase_transaction_pooler:
    _connect_args["prepared_statement_cache_size"] = 0
    _connect_args["statement_cache_size"] = 0
    _connect_args["prepared_statement_name_func"] = (
        lambda: f"__asyncpg_{uuid4()}__"
    )
    _engine_kwargs["poolclass"] = NullPool
else:
    _engine_kwargs.update(pool_pre_ping=True, pool_size=5, max_overflow=10)

engine = create_async_engine(_async_url, **_engine_kwargs)

AsyncSessionLocal = async_sessionmaker(
    engine,
    class_=AsyncSession,
    expire_on_commit=False,
)


class Base(DeclarativeBase):
    pass


async def get_db() -> AsyncGenerator[AsyncSession, None]:
    async with AsyncSessionLocal() as session:
        try:
            yield session
            await session.commit()
        except Exception:
            await session.rollback()
            raise
