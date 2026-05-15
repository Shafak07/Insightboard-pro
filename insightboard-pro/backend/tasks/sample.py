from core.celery_app import celery_app


@celery_app.task(name="tasks.sample.process_data")
def process_data(payload: dict) -> dict:
    """Example background task for data processing."""
    return {"status": "completed", "received": payload}
