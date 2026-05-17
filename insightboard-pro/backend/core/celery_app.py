"""Celery application — run from `backend/`: celery -A core.celery_app worker -l info -P solo"""

from __future__ import annotations

import sys
from pathlib import Path

# Ensure `backend/` is on sys.path so `tasks` and `core` resolve when using -A core.celery_app
_BACKEND_ROOT = Path(__file__).resolve().parent.parent
if str(_BACKEND_ROOT) not in sys.path:
    sys.path.insert(0, str(_BACKEND_ROOT))

from celery import Celery

from core.config import get_settings

settings = get_settings()

celery_app = Celery(
    "insightboard",
    broker=settings.celery_broker_url,
    backend=settings.celery_result_backend,
    include=["tasks.etl_tasks", "tasks.live_tasks", "tasks.sample"],
)

celery_app.conf.update(
    task_serializer="json",
    accept_content=["json"],
    result_serializer="json",
    timezone="UTC",
    enable_utc=True,
    task_track_started=True,
    task_acks_late=True,
    worker_prefetch_multiplier=1,
    beat_schedule={
        "poll-live-connections": {
            "task": "live.poll_connections",
            "schedule": 30.0,
        },
    },
)

# Register task modules (explicit import is reliable on Windows)
import tasks.etl_tasks  # noqa: E402, F401
import tasks.live_tasks  # noqa: E402, F401
import tasks.sample  # noqa: E402, F401
