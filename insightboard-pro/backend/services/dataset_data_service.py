"""Efficient dataset row access: ETL samples, in-memory cache, no repeat storage downloads."""

from __future__ import annotations

import io
import json
import logging
import threading
import time
from typing import Any

import pandas as pd

from services.storage_service import download_dataset_csv

logger = logging.getLogger(__name__)

CHART_SAMPLE_ROWS = 500
PREVIEW_SAMPLE_ROWS = 100
CACHE_TTL_SECONDS = 300
CACHE_MAX_ENTRIES = 16

def _rows_to_json(df: pd.DataFrame) -> list[dict[str, Any]]:
    return json.loads(df.to_json(orient="records", date_format="iso"))


class _DataFrameCache:
    def __init__(self) -> None:
        self._entries: dict[str, tuple[float, pd.DataFrame]] = {}
        self._lock = threading.Lock()

    def get(self, storage_path: str) -> pd.DataFrame | None:
        with self._lock:
            entry = self._entries.get(storage_path)
            if entry is None:
                return None
            loaded_at, df = entry
            if time.monotonic() - loaded_at > CACHE_TTL_SECONDS:
                del self._entries[storage_path]
                return None
            return df

    def set(self, storage_path: str, df: pd.DataFrame) -> None:
        with self._lock:
            if len(self._entries) >= CACHE_MAX_ENTRIES:
                oldest = min(self._entries, key=lambda k: self._entries[k][0])
                del self._entries[oldest]
            self._entries[storage_path] = (time.monotonic(), df)

    def invalidate(self, storage_path: str) -> None:
        with self._lock:
            self._entries.pop(storage_path, None)


_df_cache = _DataFrameCache()


def invalidate_dataset_cache(storage_path: str | None) -> None:
    if storage_path:
        _df_cache.invalidate(storage_path)


def build_eda_samples(df: pd.DataFrame) -> dict[str, list[dict[str, Any]]]:
    """Precompute rows for charts/preview (stored in eda_profile at ETL time)."""
    n = len(df)
    chart_n = min(CHART_SAMPLE_ROWS, n)
    preview_n = min(PREVIEW_SAMPLE_ROWS, n)
    return {
        "chart_sample": _rows_to_json(df.head(chart_n)),
        "preview_sample": _rows_to_json(df.head(preview_n)),
    }


def chart_sample_from_eda(eda_profile: dict[str, Any] | None) -> list[dict[str, Any]] | None:
    if not eda_profile:
        return None
    sample = eda_profile.get("chart_sample")
    if isinstance(sample, list) and sample:
        return sample
    return None


def preview_sample_from_eda(eda_profile: dict[str, Any] | None) -> list[dict[str, Any]]:
    if not eda_profile:
        return []
    sample = eda_profile.get("preview_sample")
    if isinstance(sample, list):
        return sample
    chart = eda_profile.get("chart_sample")
    if isinstance(chart, list):
        return chart[:PREVIEW_SAMPLE_ROWS]
    return []


def load_dataframe(storage_path: str) -> pd.DataFrame:
    cached = _df_cache.get(storage_path)
    if cached is not None:
        return cached

    raw = download_dataset_csv(storage_path)
    df = pd.read_csv(io.BytesIO(raw))
    _df_cache.set(storage_path, df)
    return df


def paginate_dataframe(
    df: pd.DataFrame,
    *,
    page: int,
    limit: int,
    sort_by: str | None,
    sort_dir: str,
    total_rows: int | None = None,
) -> tuple[list[dict[str, Any]], int]:
    total = total_rows if total_rows is not None else len(df)
    work = df
    if sort_by and sort_by in df.columns:
        work = df.sort_values(
            sort_by, ascending=sort_dir == "asc", na_position="last"
        )
    start = (page - 1) * limit
    chunk = work.iloc[start : start + limit]
    return _rows_to_json(chunk), total


def chart_rows(
    *,
    storage_path: str,
    eda_profile: dict[str, Any] | None,
    row_count: int,
    max_rows: int = CHART_SAMPLE_ROWS,
) -> tuple[list[dict[str, Any]], int, str]:
    """
    Return rows for chart builder. Prefer ETL-stored sample (no storage I/O).
    """
    cap = min(max_rows, CHART_SAMPLE_ROWS)
    stored = chart_sample_from_eda(eda_profile)
    if stored is not None:
        return stored[:cap], row_count, "stored_sample"

    df = load_dataframe(storage_path)
    total = row_count or len(df)
    n = min(cap, len(df))
    return _rows_to_json(df.head(n)), total, "storage"
