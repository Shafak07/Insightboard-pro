"""CSV ingestion, profiling, quality checks, correlations, and trends."""

from __future__ import annotations

import asyncio
import io
import json
import uuid
from datetime import datetime
from collections.abc import Callable
from typing import Any

import numpy as np
import pandas as pd
from pandas.api.types import (
    is_bool_dtype,
    is_datetime64_any_dtype,
    is_numeric_dtype,
    is_object_dtype,
)

from core.config import get_settings
from services.dataset_data_service import build_eda_samples
from services.storage_service import upload_dataset_csv


def _json_safe(obj: Any) -> Any:
    if isinstance(obj, (np.floating, float)):
        if np.isnan(obj) or np.isinf(obj):
            return None
        return float(obj)
    if isinstance(obj, (np.integer, int)):
        return int(obj)
    if isinstance(obj, np.ndarray):
        return obj.tolist()
    if isinstance(obj, (datetime, pd.Timestamp)):
        return obj.isoformat()
    if pd.isna(obj):
        return None
    return obj


class ETLService:
    ENCODINGS = ("utf-8", "utf-8-sig", "latin-1", "cp1252")

    @classmethod
    def _read_csv(cls, file_bytes: bytes, filename: str) -> pd.DataFrame:
        last_err: Exception | None = None
        for enc in cls.ENCODINGS:
            try:
                df = pd.read_csv(io.BytesIO(file_bytes), encoding=enc)
                return df
            except Exception as e:
                last_err = e
        raise ValueError(f"Could not parse CSV ({filename}): {last_err}")

    @classmethod
    def _convert_types(cls, df: pd.DataFrame) -> pd.DataFrame:
        out = df.copy()
        for col in out.columns:
            s = out[col]
            if is_numeric_dtype(s):
                continue
            if is_bool_dtype(s):
                continue
            if is_datetime64_any_dtype(s):
                continue
            conv = pd.to_numeric(s, errors="coerce")
            if conv.notna().sum() / max(len(s), 1) > 0.9:
                out[col] = conv
                continue
            dt = pd.to_datetime(s, errors="coerce", utc=True)
            if dt.notna().sum() / max(len(s), 1) > 0.5:
                out[col] = dt
                continue
            out[col] = s.astype(str)
        return out

    @classmethod
    def _column_summary(cls, df: pd.DataFrame, col: str) -> dict[str, Any]:
        s = df[col]
        null_count = int(s.isna().sum())
        nunique = int(s.nunique(dropna=True))
        samples = (
            s.dropna()
            .astype(str)
            .head(5)
            .replace({"nan": None})
            .tolist()
        )
        dtype_str = str(s.dtype)
        meta: dict[str, Any] = {
            "column_name": col,
            "dtype": dtype_str,
            "null_count": null_count,
            "unique_count": nunique,
            "sample_values": samples,
        }
        if is_numeric_dtype(s) and s.notna().any():
            sc = pd.to_numeric(s, errors="coerce").dropna()
            if len(sc):
                meta["numeric_profile"] = {
                    "mean": _json_safe(float(sc.mean())),
                    "median": _json_safe(float(sc.median())),
                    "std": _json_safe(float(sc.std())) if len(sc) > 1 else 0.0,
                    "min": _json_safe(float(sc.min())),
                    "max": _json_safe(float(sc.max())),
                    "q25": _json_safe(float(sc.quantile(0.25))),
                    "q75": _json_safe(float(sc.quantile(0.75))),
                    "skewness": _json_safe(float(sc.skew())) if len(sc) > 2 else 0.0,
                    "outlier_count": int(cls._iqr_outlier_count(sc)),
                }
        elif is_object_dtype(s) or (
            hasattr(s.dtype, "name") and s.dtype.name == "string"
        ):
            st = s.astype(str)
            vc = st.value_counts().head(5)
            meta["string_profile"] = {
                "unique_count": nunique,
                "top_values": {str(k): int(v) for k, v in vc.items()},
                "avg_length": _json_safe(float(st.str.len().mean()))
                if len(st)
                else 0.0,
                "null_percentage": _json_safe(100.0 * null_count / max(len(s), 1)),
            }
        elif is_datetime64_any_dtype(s):
            dt = pd.to_datetime(s, errors="coerce", utc=True)
            valid = dt.dropna()
            if len(valid) > 0:
                sorted_dt = valid.sort_values()
                deltas = sorted_dt.diff().dropna()
                trend_dir = "flat"
                num_cols = [c for c in df.columns if is_numeric_dtype(df[c]) and c != col]
                if num_cols:
                    trend_dir = cls.detect_trends(df, col, num_cols[0]).get("trend", "flat")
                meta["date_profile"] = {
                    "min_date": sorted_dt.min().isoformat(),
                    "max_date": sorted_dt.max().isoformat(),
                    "date_gaps": _json_safe(float(deltas.dt.total_seconds().median()))
                    if len(deltas)
                    else 0.0,
                    "trend_direction": trend_dir,
                }
        return meta

    @staticmethod
    def _iqr_outlier_count(series: pd.Series) -> int:
        if len(series) < 4:
            return 0
        q1 = series.quantile(0.25)
        q3 = series.quantile(0.75)
        iqr = q3 - q1
        if iqr == 0:
            return 0
        low = q1 - 1.5 * iqr
        high = q3 + 1.5 * iqr
        return int(((series < low) | (series > high)).sum())

    @classmethod
    def validate_data_quality(cls, df: pd.DataFrame) -> dict[str, Any]:
        warnings: list[str] = []
        n = len(df)
        if n == 0:
            return {"score": 0, "warnings": ["Dataset is empty"]}

        null_pct = (
            float(df.isna().sum().sum()) / float(n * max(len(df.columns), 1)) * 100
        )
        dup_pct = float(df.duplicated().sum()) / float(n) * 100

        type_penalty = 0.0
        for col in df.columns:
            s = df[col]
            if is_object_dtype(s):
                str_ratio = s.astype(str).str.match(r"^-?\d+(\.\d+)?$").fillna(False).mean()
                if 0.05 < float(str_ratio) < 0.95:
                    type_penalty += 2

        outlier_ratio = 0.0
        num_cols = [c for c in df.columns if is_numeric_dtype(df[c])]
        for c in num_cols:
            sc = pd.to_numeric(df[c], errors="coerce").dropna()
            if len(sc) > 3:
                outlier_ratio += cls._iqr_outlier_count(sc) / len(sc)
        outlier_ratio = outlier_ratio / max(len(num_cols), 1)

        if null_pct > 30:
            warnings.append(f"High null rate across cells ({null_pct:.1f}%)")
        if dup_pct > 10:
            warnings.append(f"High duplicate row rate ({dup_pct:.1f}%)")
        if type_penalty > 0:
            warnings.append("Inconsistent value types detected in some columns")
        if outlier_ratio > 0.1:
            warnings.append("Elevated outlier ratio in numeric columns")

        score = 100.0
        score -= min(null_pct * 0.8, 40)
        score -= min(dup_pct * 1.2, 25)
        score -= min(type_penalty, 15)
        score -= min(outlier_ratio * 100, 20)
        score = max(0, min(100, round(score, 1)))

        return {
            "score": score,
            "null_percentage": round(null_pct, 2),
            "duplicate_percentage": round(dup_pct, 2),
            "type_consistency_penalty": round(type_penalty, 2),
            "outlier_ratio": round(outlier_ratio * 100, 2),
            "warnings": warnings,
        }

    @classmethod
    def generate_correlation_matrix(
        cls, df: pd.DataFrame
    ) -> dict[str, dict[str, float]]:
        num_df = df.select_dtypes(include=[np.number])
        if num_df.shape[1] < 2:
            return {}
        corr = num_df.corr(method="pearson", min_periods=3)
        out: dict[str, dict[str, float]] = {}
        for c1 in corr.columns:
            out[str(c1)] = {}
            for c2 in corr.columns:
                if c1 == c2:
                    continue
                v = corr.loc[c1, c2]
                if pd.isna(v):
                    continue
                out[str(c1)][str(c2)] = round(float(v), 6)
        return out

    @classmethod
    def detect_trends(
        cls,
        df: pd.DataFrame,
        date_col: str,
        value_col: str,
    ) -> dict[str, Any]:
        if date_col not in df.columns or value_col not in df.columns:
            return {"points": [], "trend": "unknown", "error": "missing columns"}

        dfd = df[[date_col, value_col]].copy()
        dfd[date_col] = pd.to_datetime(dfd[date_col], errors="coerce", utc=True)
        dfd[value_col] = pd.to_numeric(dfd[value_col], errors="coerce")
        dfd = dfd.dropna().sort_values(date_col)
        if len(dfd) < 2:
            return {"points": [], "trend": "flat"}

        dfd = dfd.set_index(date_col)
        series = dfd[value_col]
        ma7 = series.rolling(window=7, min_periods=1).mean()
        ma30 = series.rolling(window=30, min_periods=1).mean()

        points: list[dict[str, Any]] = []
        for i, (ts, row) in enumerate(dfd.iterrows()):
            v = float(row[value_col])
            m7 = float(ma7.iloc[i]) if i < len(ma7) else v
            m30 = float(ma30.iloc[i]) if i < len(ma30) else v
            points.append(
                {
                    "date": ts.isoformat() if hasattr(ts, "isoformat") else str(ts),
                    "value": _json_safe(v),
                    "ma7": _json_safe(m7),
                    "ma30": _json_safe(m30),
                    "trend": "flat",
                }
            )

        if len(ma7.dropna()) >= 2:
            a, b = float(ma7.iloc[-1]), float(ma7.iloc[0])
            change = (a - b) / abs(b) if b != 0 else 0.0
            if change > 0.02:
                overall = "upward"
            elif change < -0.02:
                overall = "downward"
            else:
                overall = "flat"
        else:
            overall = "flat"

        for p in points:
            p["trend"] = overall

        return {
            "points": points,
            "trend": overall,
            "date_col": date_col,
            "value_col": value_col,
        }

    @classmethod
    async def process_csv(
        cls,
        file_bytes: bytes,
        filename: str,
        user_id: str,
        dataset_id: uuid.UUID | None = None,
    ) -> dict[str, Any]:
        return await asyncio.to_thread(
            cls.process_csv_sync,
            file_bytes,
            filename,
            user_id,
            dataset_id,
        )

    @classmethod
    async def validate_data_quality_async(cls, df: pd.DataFrame) -> dict[str, Any]:
        return await asyncio.to_thread(cls.validate_data_quality, df)

    @classmethod
    async def generate_correlation_matrix_async(
        cls, df: pd.DataFrame
    ) -> dict[str, dict[str, float]]:
        return await asyncio.to_thread(cls.generate_correlation_matrix, df)

    @classmethod
    async def detect_trends_async(
        cls, df: pd.DataFrame, date_col: str, value_col: str
    ) -> dict[str, Any]:
        return await asyncio.to_thread(cls.detect_trends, df, date_col, value_col)

    @classmethod
    def process_csv_sync(
        cls,
        file_bytes: bytes,
        filename: str,
        user_id: str,
        dataset_id: uuid.UUID | None = None,
        on_progress: Callable[[int, str], None] | None = None,
    ) -> dict[str, Any]:
        def progress(percent: int, stage: str) -> None:
            if on_progress:
                on_progress(percent, stage)

        progress(5, "parsing")
        try:
            df = cls._read_csv(file_bytes, filename)
        except Exception as e:
            raise ValueError(f"Invalid CSV: {e}") from e

        ds_id = dataset_id or uuid.uuid4()
        progress(25, "parsing")
        df = cls._convert_types(df)
        row_count = len(df)
        column_count = len(df.columns)

        progress(45, "profiling")
        columns_metadata: list[dict[str, Any]] = []
        for col in df.columns:
            columns_metadata.append(cls._column_summary(df, col))

        quality = cls.validate_data_quality(df)
        correlations = cls.generate_correlation_matrix(df)

        for c in list(df.columns):
            if is_object_dtype(df[c]) and pd.to_datetime(
                df[c], errors="coerce"
            ).notna().sum() / max(len(df), 1) > 0.5:
                df[c] = pd.to_datetime(df[c], errors="coerce", utc=True)

        date_cols = [c for c in df.columns if is_datetime64_any_dtype(df[c])]
        num_cols = [c for c in df.columns if is_numeric_dtype(df[c])]

        if date_cols and num_cols:
            trends = cls.detect_trends(df, date_cols[0], num_cols[0])
        else:
            trends = {"points": [], "trend": "flat", "note": "no date/value pair"}

        progress(70, "analysis")
        samples = build_eda_samples(df)
        eda_profile: dict[str, Any] = {
            "quality": quality,
            "correlations": correlations,
            "trends": trends,
            "summary": {"rows": row_count, "columns": column_count},
            **samples,
        }

        csv_buffer = io.BytesIO()
        df.to_csv(csv_buffer, index=False, encoding="utf-8")
        cleaned_bytes = csv_buffer.getvalue()

        safe_name = filename.rsplit("/", maxsplit=1)[-1]
        if not safe_name.lower().endswith(".csv"):
            safe_name = safe_name + ".csv"
        storage_path = f"{user_id}/{ds_id}/{safe_name}"

        progress(90, "storage")
        upload_dataset_csv(storage_path, cleaned_bytes, "text/csv")

        return {
            "dataset_id": str(ds_id),
            "columns_metadata": columns_metadata,
            "eda_profile": eda_profile,
            "row_count": row_count,
            "column_count": column_count,
            "file_size": len(cleaned_bytes),
            "storage_path": storage_path,
            "sample_data": samples["preview_sample"],
        }
