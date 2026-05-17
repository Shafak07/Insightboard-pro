import logging
import os
import uuid

from celery import Task

from core.celery_app import celery_app
from core.sync_db import sync_session_scope
from core.cache import invalidate_dataset_sync
from core.ws_manager import publish_dataset_event
from models.dataset import Dataset, DatasetStatus
from services.etl_service import ETLService
from services.profile_service import ensure_profile_sync

logger = logging.getLogger(__name__)


@celery_app.task(bind=True, max_retries=3, name="etl.process_dataset")
def process_dataset_task(
    self: Task,
    dataset_id: str,
    file_path: str,
    user_id: str,
    user_email: str = "",
) -> dict:
    ds_uuid = uuid.UUID(dataset_id)
    try:
        ensure_profile_sync(
            user_id,
            user_email or f"{user_id}@insightboard.local",
            None,
            None,
        )
    except Exception:
        logger.warning("Could not ensure profile for user %s", user_id)

    try:
        with open(file_path, "rb") as f:
            raw = f.read()
    except Exception as exc:
        logger.exception("Failed to read upload %s", file_path)
        _mark_error(ds_uuid, str(exc))
        raise self.retry(exc=exc, countdown=30) from exc

    try:
        with sync_session_scope() as session:
            row = session.get(Dataset, ds_uuid)
            if row is None:
                return {"ok": False, "error": "dataset not found"}
            row.status = DatasetStatus.processing
            file_name = row.file_name
            dataset_name = row.name

        publish_dataset_event(
            user_id,
            {
                "type": "processing_progress",
                "dataset_id": dataset_id,
                "percent": 5,
                "stage": "starting",
            },
        )

        def on_progress(percent: int, stage: str) -> None:
            publish_dataset_event(
                user_id,
                {
                    "type": "processing_progress",
                    "dataset_id": dataset_id,
                    "percent": percent,
                    "stage": stage,
                },
            )

        result = ETLService.process_csv_sync(
            raw,
            file_name,
            user_id,
            dataset_id=ds_uuid,
            on_progress=on_progress,
        )

        with sync_session_scope() as session:
            row = session.get(Dataset, ds_uuid)
            if row:
                row.status = DatasetStatus.ready
                row.row_count = result["row_count"]
                row.column_count = result["column_count"]
                row.file_size = result["file_size"]
                row.columns_metadata = result["columns_metadata"]
                row.eda_profile = result["eda_profile"]
                row.storage_path = result["storage_path"]

        invalidate_dataset_sync(dataset_id)

        publish_dataset_event(
            user_id,
            {
                "type": "dataset_ready",
                "dataset_id": dataset_id,
                "name": dataset_name,
                "row_count": result["row_count"],
            },
        )

        try:
            os.remove(file_path)
        except OSError:
            pass

        return {"ok": True, "dataset_id": dataset_id}
    except ValueError as exc:
        msg = str(exc)[:2000]
        logger.warning("CSV validation failed: %s", msg)
        _mark_error(ds_uuid, msg)
        publish_dataset_event(
            user_id,
            {
                "type": "dataset_error",
                "dataset_id": dataset_id,
                "status": "error",
                "message": msg,
            },
        )
        try:
            os.remove(file_path)
        except OSError:
            pass
        return {"ok": False, "error": msg}
    except Exception as exc:
        logger.exception("ETL failed for %s", dataset_id)
        err = str(exc)[:2000]
        _mark_error(ds_uuid, err)
        publish_dataset_event(
            user_id,
            {
                "type": "dataset_error",
                "dataset_id": dataset_id,
                "status": "error",
                "message": err,
            },
        )
        try:
            os.remove(file_path)
        except OSError:
            pass
        raise self.retry(exc=exc, countdown=60) from exc


def _mark_error(dataset_id: uuid.UUID, message: str) -> None:
    try:
        with sync_session_scope() as session:
            row = session.get(Dataset, dataset_id)
            if row:
                row.status = DatasetStatus.error
                row.error_message = message
    except Exception:
        logger.exception("Could not persist error state for %s", dataset_id)
