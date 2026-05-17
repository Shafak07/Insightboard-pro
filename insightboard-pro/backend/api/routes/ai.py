"""AI insights: dataset summaries (SSE), chart narration, natural language Q&A."""

from __future__ import annotations

import asyncio
import json
import re
import uuid
from typing import Annotated, Any, AsyncGenerator

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import StreamingResponse
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from core.redis_client import cache_get, cache_set
from models.dataset import Dataset, DatasetStatus
from schemas.ai import (
    AskQuestionRequest,
    AskQuestionResponse,
    ChartInsightRequest,
    ChartInsightResponse,
)
from schemas.common import ApiResponse
from services.ai_service import AIInsightService
from services.dataset_data_service import chart_rows, preview_sample_from_eda

router = APIRouter()


async def _get_dataset_for_user(
    dataset_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Dataset:
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if row.status != DatasetStatus.ready:
        raise HTTPException(status_code=400, detail="Dataset is not ready for AI analysis")
    return row


def _sse(payload: dict[str, Any]) -> str:
    return f"data: {json.dumps(payload, default=str)}\n\n"


async def _stream_text_tokens(text: str) -> AsyncGenerator[str, None]:
    """Emit executive summary text in word-sized chunks for typewriter UX."""
    if not text:
        yield _sse({"type": "token", "text": ""})
        return
    for part in re.split(r"(\s+)", text):
        if not part:
            continue
        yield _sse({"type": "token", "text": part})
        await asyncio.sleep(0.01)


@router.post("/dataset/{dataset_id}/summary")
async def stream_dataset_summary(
    dataset_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> StreamingResponse:
    uid = uuid.UUID(str(current_user.id))
    cache_key = AIInsightService.summary_cache_key(str(dataset_id))

    async def event_generator() -> AsyncGenerator[str, None]:
        cached = await cache_get(cache_key)
        if cached and isinstance(cached, dict):
            async for chunk in _stream_text_tokens(str(cached.get("executive_summary") or "")):
                yield chunk
            yield _sse({"type": "done", "summary": cached, "cached": True})
            return

        row = await _get_dataset_for_user(dataset_id, uid, db)
        eda = row.eda_profile if isinstance(row.eda_profile, dict) else {}

        summary, _raw = await AIInsightService.generate_dataset_summary_stream(eda)
        await cache_set(
            cache_key,
            summary,
            ttl=AIInsightService.AI_SUMMARY_CACHE_TTL,
        )

        async for chunk in _stream_text_tokens(str(summary.get("executive_summary") or "")):
            yield chunk
        yield _sse({"type": "done", "summary": summary, "cached": False})

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "Connection": "keep-alive",
            "X-Accel-Buffering": "no",
        },
    )


@router.post("/chart-insight", response_model=ApiResponse[ChartInsightResponse])
async def chart_insight(
    body: ChartInsightRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[ChartInsightResponse]:
    _ = current_user
    chart_config = {
        "chart_type": body.chart_type,
        "x_col": body.x_col,
        "y_col": body.y_col,
        "title": body.chart_title,
    }
    insight = await AIInsightService.generate_chart_insight(
        chart_config,
        body.chart_data,
    )
    return ApiResponse(data=ChartInsightResponse(insight=insight))


@router.post("/ask", response_model=ApiResponse[AskQuestionResponse])
async def ask_about_dataset(
    body: AskQuestionRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[AskQuestionResponse]:
    uid = uuid.UUID(str(current_user.id))
    row = await _get_dataset_for_user(body.dataset_id, uid, db)
    eda = row.eda_profile if isinstance(row.eda_profile, dict) else {}

    sample = preview_sample_from_eda(eda)
    if len(sample) < 3:
        rows, _, _ = await asyncio.to_thread(
            chart_rows,
            storage_path=row.storage_path,
            eda_profile=eda,
            row_count=row.row_count or 0,
            max_rows=50,
        )
        sample = rows

    columns = row.columns_metadata if isinstance(row.columns_metadata, list) else []
    result = await AIInsightService.answer_data_question(
        body.question.strip(),
        str(body.dataset_id),
        sample,
        columns_metadata=columns,
        eda_profile=eda,
    )
    return ApiResponse(data=AskQuestionResponse(**result))
