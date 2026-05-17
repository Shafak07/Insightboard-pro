"""Server-side chart aggregation with Pandas."""

from __future__ import annotations

from typing import Any

import numpy as np
import pandas as pd

AGGREGATIONS = frozenset({"sum", "mean", "count", "min", "max", "median"})
TOP_GROUPS = 50


def _agg_func(name: str):
    n = name.lower()
    if n == "count":
        return "count"
    if n == "median":
        return "median"
    return n


def aggregate_chart_data(
    df: pd.DataFrame,
    *,
    x_col: str | None,
    y_col: str | None,
    group_by: str | None,
    aggregation: str = "sum",
    limit: int = 500,
) -> tuple[list[dict[str, Any]], bool]:
    """
    Returns (rows, aggregated_flag).
    Aggregated rows use minimal keys x, y.
    """
    agg = _agg_func(aggregation or "sum")
    if agg not in AGGREGATIONS:
        agg = "sum"

    if group_by and group_by in df.columns and y_col and y_col in df.columns:
        work = df.copy()
        grouped = work.groupby(group_by, dropna=False)[y_col]
        if agg == "count":
            out = grouped.count().reset_index()
            out.columns = [group_by, y_col]
        else:
            out = grouped.agg(agg).reset_index()
        out = out.sort_values(y_col, ascending=False).head(TOP_GROUPS)
        rows = [
            {"x": row[group_by], "y": _json_safe(row[y_col])}
            for _, row in out.iterrows()
        ]
        return rows[:limit], True

    if x_col and y_col and x_col in df.columns and y_col in df.columns:
        work = df[[x_col, y_col]].dropna(subset=[y_col])
        if agg != "count":
            numeric = pd.to_numeric(work[y_col], errors="coerce")
            work = work.assign(_y=numeric).dropna(subset=["_y"])
            if group_by is None and len(work) > TOP_GROUPS:
                out = (
                    work.groupby(x_col, dropna=False)["_y"]
                    .agg(agg)
                    .reset_index()
                    .sort_values("_y", ascending=False)
                    .head(TOP_GROUPS)
                )
                rows = [
                    {"x": row[x_col], "y": _json_safe(row["_y"])}
                    for _, row in out.iterrows()
                ]
                return rows[:limit], True

    n = min(limit, len(df))
    sample = df.head(n)
    return [
        {k: _json_safe(v) for k, v in rec.items()}
        for rec in sample.to_dict(orient="records")
    ], False


def _json_safe(val: Any) -> Any:
    if isinstance(val, (np.floating, float)):
        if np.isnan(val) or np.isinf(val):
            return None
        return float(val)
    if isinstance(val, (np.integer, int)):
        return int(val)
    if pd.isna(val):
        return None
    return val
