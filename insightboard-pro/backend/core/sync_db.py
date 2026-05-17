"""Synchronous DB session for Celery workers (pandas/ETL runs in sync context)."""

from contextlib import contextmanager
from typing import Generator

from sqlalchemy import create_engine
from sqlalchemy.orm import Session, sessionmaker

from core.config import get_settings
from core.db_connect import get_sync_connect_args


def _sync_database_url() -> str:
    return get_settings().database_url_sync


_engine = None
_SessionLocal = None


def get_sync_engine():
    global _engine, _SessionLocal
    if _engine is None:
        url = _sync_database_url()
        _engine = create_engine(
            url,
            pool_pre_ping=True,
            connect_args=get_sync_connect_args(url),
        )
        _SessionLocal = sessionmaker(bind=_engine, expire_on_commit=False)
    return _engine


def get_sync_session_factory():
    get_sync_engine()
    return _SessionLocal


@contextmanager
def sync_session_scope() -> Generator[Session, None, None]:
    factory = get_sync_session_factory()
    session = factory()
    try:
        yield session
        session.commit()
    except Exception:
        session.rollback()
        raise
    finally:
        session.close()
