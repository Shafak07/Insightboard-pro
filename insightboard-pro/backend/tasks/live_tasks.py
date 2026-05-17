import logging
import uuid
from datetime import datetime, timezone

from celery import Task

from core.celery_app import celery_app
from core.sync_db import sync_session_scope
from models.live_connection import LiveConnection, LiveConnectionStatus
from services.live_data_service import LiveDataService

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=2, name="live.fetch_and_cache")
def fetch_and_cache(self: Task, connection_id: str) -> dict:
    try:
        return LiveDataService.fetch_and_cache(connection_id)
    except Exception as exc:
        logger.exception("fetch_and_cache failed for %s", connection_id)
        raise self.retry(exc=exc, countdown=30) from exc


@celery_app.task(name="live.poll_connections")
def poll_live_connections() -> dict:
    """Celery beat — refresh connections whose interval has elapsed."""
    now = datetime.now(timezone.utc)
    due: list[str] = []
    from sqlalchemy import select

    with sync_session_scope() as session:
        rows = list(
            session.execute(
                select(LiveConnection).where(
                    LiveConnection.status == LiveConnectionStatus.active
                )
            )
            .scalars()
            .all()
        )
        for row in rows:
            if row.last_fetched_at is None:
                due.append(str(row.id))
                continue
            elapsed = (now - row.last_fetched_at).total_seconds()
            if elapsed >= row.refresh_interval:
                due.append(str(row.id))

    for cid in due:
        fetch_and_cache.delay(cid)
    return {"scheduled": len(due)}
