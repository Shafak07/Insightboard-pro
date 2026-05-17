"""Supabase Storage helpers for dataset CSV files (REST API — works with JWT or sb_* keys)."""

from __future__ import annotations

import logging
from typing import Any
from urllib.parse import quote

import httpx

from core.config import get_settings

logger = logging.getLogger(__name__)


def _storage_base() -> str:
    settings = get_settings()
    return f"{settings.supabase_url.rstrip('/')}/storage/v1"


def _api_key() -> str:
    settings = get_settings()
    key = settings.supabase_service_role_key.strip()
    if not key:
        raise RuntimeError("SUPABASE_SERVICE_ROLE_KEY is not configured")
    return key


def _headers() -> dict[str, str]:
    key = _api_key()
    return {
        "apikey": key,
        "Authorization": f"Bearer {key}",
    }


def ensure_datasets_bucket() -> None:
    """Create the datasets bucket if it does not exist."""
    settings = get_settings()
    bucket = settings.supabase_datasets_bucket
    base = _storage_base()
    headers = _headers()

    with httpx.Client(timeout=30.0) as client:
        listed = client.get(f"{base}/bucket", headers=headers)
        if listed.status_code == 200:
            buckets: list[dict[str, Any]] = listed.json()
            if any(b.get("name") == bucket or b.get("id") == bucket for b in buckets):
                return

        created = client.post(
            f"{base}/bucket",
            headers={**headers, "Content-Type": "application/json"},
            json={"id": bucket, "name": bucket, "public": False},
        )
        if created.status_code in (200, 201):
            return
        if created.status_code == 409:
            return
        logger.warning(
            "Could not create bucket %s: %s %s",
            bucket,
            created.status_code,
            created.text[:300],
        )


def upload_dataset_csv(storage_path: str, data: bytes, content_type: str = "text/csv") -> None:
    settings = get_settings()
    ensure_datasets_bucket()
    bucket = settings.supabase_datasets_bucket
    path = quote(storage_path, safe="/")
    url = f"{_storage_base()}/object/{bucket}/{path}"

    with httpx.Client(timeout=120.0) as client:
        response = client.post(
            url,
            headers={
                **_headers(),
                "Content-Type": content_type,
                "x-upsert": "true",
            },
            content=data,
        )
        if response.status_code >= 400:
            raise RuntimeError(
                f"Storage upload failed ({response.status_code}): {response.text[:500]}"
            )


def download_dataset_csv(storage_path: str) -> bytes:
    settings = get_settings()
    bucket = settings.supabase_datasets_bucket
    path = quote(storage_path, safe="/")
    url = f"{_storage_base()}/object/{bucket}/{path}"

    with httpx.Client(timeout=120.0) as client:
        response = client.get(url, headers=_headers())
        if response.status_code >= 400:
            raise RuntimeError(
                f"Storage download failed ({response.status_code}): {response.text[:500]}"
            )
        return response.content


def delete_dataset_object(storage_path: str) -> None:
    settings = get_settings()
    bucket = settings.supabase_datasets_bucket
    path = quote(storage_path, safe="/")
    url = f"{_storage_base()}/object/{bucket}/{path}"

    try:
        with httpx.Client(timeout=30.0) as client:
            client.delete(url, headers=_headers())
    except Exception:
        logger.exception("Failed to delete storage object %s", storage_path)
