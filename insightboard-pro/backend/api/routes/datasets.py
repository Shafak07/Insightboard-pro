import asyncio
import json
import os
import uuid
from typing import Annotated, Any, Optional

import pandas as pd
from fastapi import (
    APIRouter,
    Depends,
    File,
    Form,
    HTTPException,
    Query,
    UploadFile,
    status,
)
from fastapi.responses import JSONResponse
from sqlalchemy import delete, func, select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser, get_current_user
from core.config import get_settings
from core.database import get_db
from models.dataset import Dataset, DatasetStatus
from schemas.common import ApiResponse
from schemas.dataset import (
    ChartDataResponse,
    DatasetDetail,
    DatasetListResponse,
    DatasetSummary,
    PaginatedRowsResponse,
    UploadResponse,
)
from core.cache import (
    TTL_CHART_DATA,
    TTL_DATASET_EDA,
    cache_get,
    cache_key,
    cache_key_hash,
    cache_set,
    invalidate_dataset,
)
from services.chart_aggregation_service import AGGREGATIONS, aggregate_chart_data
from services.dataset_data_service import (
    CHART_SAMPLE_ROWS,
    chart_rows,
    invalidate_dataset_cache,
    load_dataframe,
    paginate_dataframe,
    preview_sample_from_eda,
)
from services.profile_service import ensure_profile_async
from services.storage_service import delete_dataset_object
from tasks.etl_tasks import process_dataset_task

router = APIRouter()


def json_rows(df: pd.DataFrame) -> list[dict[str, Any]]:
    return json.loads(df.to_json(orient="records", date_format="iso"))


@router.post("/upload", response_model=ApiResponse[UploadResponse])
async def upload_dataset(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    file: UploadFile = File(...),
    name: str = Form(...),
    description: Optional[str] = Form(None),
) -> ApiResponse[UploadResponse]:
    settings = get_settings()
    content = await file.read()
    if len(content) > settings.max_upload_bytes:
        raise HTTPException(
            status_code=status.HTTP_413_REQUEST_ENTITY_TOO_LARGE,
            detail=f"File exceeds {settings.max_upload_bytes // (1024 * 1024)}MB limit",
        )
    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="Only .csv files are allowed",
        )

    await ensure_profile_async(
        db,
        current_user.id,
        str(current_user.email),
        current_user.full_name,
        current_user.avatar_url,
    )

    dataset_id = uuid.uuid4()
    os.makedirs(settings.upload_temp_dir, exist_ok=True)
    temp_path = os.path.join(settings.upload_temp_dir, f"{dataset_id}.csv")
    with open(temp_path, "wb") as f:
        f.write(content)

    ds = Dataset(
        id=dataset_id,
        user_id=uuid.UUID(current_user.id),
        name=name.strip(),
        description=description,
        file_name=file.filename,
        file_size=len(content),
        row_count=0,
        column_count=0,
        status=DatasetStatus.processing,
        storage_path="",
    )
    db.add(ds)
    await db.commit()

    process_dataset_task.delay(
        str(dataset_id), temp_path, current_user.id, str(current_user.email)
    )

    return ApiResponse(
        success=True,
        data=UploadResponse(dataset_id=dataset_id, status="processing"),
    )


@router.get("", response_model=ApiResponse[DatasetListResponse], include_in_schema=False)
@router.get("/", response_model=ApiResponse[DatasetListResponse])
async def list_datasets(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(10, ge=1, le=100),
) -> ApiResponse[DatasetListResponse]:
    uid = uuid.UUID(current_user.id)
    count_stmt = select(func.count()).select_from(Dataset).where(Dataset.user_id == uid)
    total = (await db.execute(count_stmt)).scalar_one()

    stmt = (
        select(Dataset)
        .where(Dataset.user_id == uid)
        .order_by(Dataset.created_at.desc())
        .offset((page - 1) * limit)
        .limit(limit)
    )
    result = await db.execute(stmt)
    rows = result.scalars().all()

    items = [DatasetSummary.model_validate(r) for r in rows]
    return ApiResponse(
        success=True,
        data=DatasetListResponse(
            items=items,
            total=total,
            page=page,
            limit=limit,
        ),
    )


async def _get_ready_dataset(
    dataset_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Dataset:
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == user_id)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")
    if row.status != DatasetStatus.ready or not row.storage_path:
        raise HTTPException(status_code=400, detail="Dataset is not ready")
    return row


@router.get("/{dataset_id}/chart-data")
async def get_dataset_chart_data(
    dataset_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    x_col: Optional[str] = Query(None),
    y_col: Optional[str] = Query(None),
    group_by: Optional[str] = Query(None),
    aggregation: str = Query("sum"),
    limit: int = Query(CHART_SAMPLE_ROWS, ge=1, le=CHART_SAMPLE_ROWS),
) -> JSONResponse:
    """Chart data with Redis cache, optional aggregation, Cache-Control headers."""
    if aggregation.lower() not in AGGREGATIONS:
        raise HTTPException(
            status_code=400,
            detail=f"aggregation must be one of: {', '.join(sorted(AGGREGATIONS))}",
        )

    uid = uuid.UUID(current_user.id)
    row = await _get_ready_dataset(dataset_id, uid, db)
    eda = row.eda_profile if isinstance(row.eda_profile, dict) else {}

    cache_params = {
        "dataset_id": str(dataset_id),
        "x_col": x_col,
        "y_col": y_col,
        "group_by": group_by,
        "aggregation": aggregation,
        "limit": limit,
    }
    redis_key = cache_key_hash(f"chart:{dataset_id}", cache_params)
    cached = await cache_get(redis_key)
    if cached is not None:
        return JSONResponse(
            content={"success": True, "data": cached},
            headers={
                "Cache-Control": "max-age=300, stale-while-revalidate=60",
            },
        )

    def _build() -> dict[str, Any]:
        if group_by or (x_col and y_col):
            df = load_dataframe(row.storage_path)
            rows_data, aggregated = aggregate_chart_data(
                df,
                x_col=x_col,
                y_col=y_col,
                group_by=group_by or x_col,
                aggregation=aggregation,
                limit=limit,
            )
            source = "aggregated"
        else:
            rows_data, _, source = chart_rows(
                storage_path=row.storage_path,
                eda_profile=eda,
                row_count=row.row_count,
                max_rows=limit,
            )
            aggregated = False

        correlations = (
            eda.get("correlations") if isinstance(eda.get("correlations"), dict) else None
        )
        return ChartDataResponse(
            rows=rows_data,
            total_rows=row.row_count,
            columns_metadata=row.columns_metadata,
            correlations=correlations,
            source=source,
            aggregated=aggregated,
            x_col=x_col,
            y_col=y_col,
        ).model_dump(mode="json")

    data = await asyncio.to_thread(_build)
    await cache_set(redis_key, data, TTL_CHART_DATA)

    return JSONResponse(
        content={"success": True, "data": data},
        headers={"Cache-Control": "max-age=300, stale-while-revalidate=60"},
    )


@router.get("/{dataset_id}/data", response_model=ApiResponse[PaginatedRowsResponse])
async def get_dataset_data(
    dataset_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(50, ge=1, le=1000),
    sort_by: Optional[str] = None,
    sort_dir: str = Query("asc", pattern="^(asc|desc)$"),
) -> ApiResponse[PaginatedRowsResponse]:
    uid = uuid.UUID(current_user.id)
    row = await _get_ready_dataset(dataset_id, uid, db)

    def _load_page() -> tuple[list[dict[str, Any]], int]:
        df = load_dataframe(row.storage_path)
        return paginate_dataframe(
            df,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
            total_rows=row.row_count or len(df),
        )

    rows, total_rows = await asyncio.to_thread(_load_page)

    return ApiResponse(
        success=True,
        data=PaginatedRowsResponse(
            rows=rows,
            total_rows=total_rows,
            page=page,
            limit=limit,
            sort_by=sort_by,
            sort_dir=sort_dir,
        ),
    )


@router.get("/{dataset_id}", response_model=ApiResponse[DatasetDetail])
async def get_dataset(
    dataset_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DatasetDetail]:
    uid = uuid.UUID(current_user.id)
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == uid)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    eda_key = cache_key("dataset", str(dataset_id), "eda")
    cached_eda = await cache_get(eda_key)
    if cached_eda and isinstance(cached_eda, dict):
        detail = DatasetDetail.model_validate({**cached_eda, "id": row.id})
        return ApiResponse(success=True, data=detail)

    detail = DatasetDetail.model_validate(row)
    eda = row.eda_profile if isinstance(row.eda_profile, dict) else {}
    detail.sample_data = preview_sample_from_eda(eda) if row.status == DatasetStatus.ready else []

    await cache_set(eda_key, detail.model_dump(mode="json"), TTL_DATASET_EDA)
    return ApiResponse(success=True, data=detail)


@router.delete("/{dataset_id}", response_model=ApiResponse[dict])
async def delete_dataset(
    dataset_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[dict]:
    uid = uuid.UUID(current_user.id)
    stmt = select(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == uid)
    row = (await db.execute(stmt)).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dataset not found")

    path = row.storage_path
    await db.execute(
        delete(Dataset).where(Dataset.id == dataset_id, Dataset.user_id == uid)
    )
    await db.commit()

    if path:
        invalidate_dataset_cache(path)
        delete_dataset_object(path)

    await invalidate_dataset(str(dataset_id))

    return ApiResponse(success=True, data={"deleted": True})
