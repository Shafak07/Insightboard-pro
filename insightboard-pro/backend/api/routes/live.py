from typing import Annotated

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser, get_current_user
from core.database import get_db
from models.live_connection import LiveConnection
from schemas.common import ApiResponse
from schemas.live import (
    LiveConnectRequest,
    LiveConnectResponse,
    LiveConnectionSummary,
    LiveSnapshotResponse,
    LiveTestRequest,
    LiveTestResponse,
)
from services.live_data_service import LiveDataService

router = APIRouter()


@router.post("/test", response_model=ApiResponse[LiveTestResponse])
async def test_connection(
    body: LiveTestRequest,
    _: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[LiveTestResponse]:
    try:
        preview = LiveDataService.validate_json_response(
            str(body.api_url),
            body.method,
            body.headers,
            body.body,
        )
        return ApiResponse(
            success=True,
            data=LiveTestResponse(ok=True, preview=preview),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/connect", response_model=ApiResponse[LiveConnectResponse])
async def connect_api(
    body: LiveConnectRequest,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[LiveConnectResponse]:
    try:
        conn_id = LiveDataService.connect_rest_api(
            user_id=current_user.id,
            name=body.name,
            url=str(body.api_url),
            headers=body.headers,
            method=body.method,
            body=body.body,
            refresh_seconds=body.refresh_seconds,
            x_field=body.chart_x_field,
            y_field=body.chart_y_field,
        )
        return ApiResponse(
            success=True,
            data=LiveConnectResponse(connection_id=conn_id),
        )
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(exc),
        ) from exc


@router.post("/demo", response_model=ApiResponse[LiveConnectResponse])
async def create_btc_demo(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
) -> ApiResponse[LiveConnectResponse]:
    try:
        conn_id = LiveDataService.ensure_btc_demo(current_user.id)
    except Exception as exc:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail=str(exc),
        ) from exc
    return ApiResponse(
        success=True,
        data=LiveConnectResponse(connection_id=conn_id),
    )


@router.get("/connections", response_model=ApiResponse[list[LiveConnectionSummary]])
async def list_connections(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[list[LiveConnectionSummary]]:
    import uuid

    uid = uuid.UUID(current_user.id)
    result = await db.execute(
        select(LiveConnection)
        .where(LiveConnection.user_id == uid)
        .order_by(LiveConnection.created_at.desc())
    )
    rows = result.scalars().all()
    data = [
        LiveConnectionSummary(
            id=str(r.id),
            name=r.name,
            api_url=r.api_url,
            method=r.method,
            refresh_interval=r.refresh_interval,
            last_fetched_at=r.last_fetched_at,
            last_row_count=r.last_row_count,
            status=r.status.value,
            chart_x_field=r.chart_x_field,
            chart_y_field=r.chart_y_field,
        )
        for r in rows
    ]
    return ApiResponse(success=True, data=data)


@router.get(
    "/connections/{connection_id}/snapshot",
    response_model=ApiResponse[LiveSnapshotResponse],
)
async def get_snapshot(
    connection_id: str,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[LiveSnapshotResponse]:
    import uuid

    uid = uuid.UUID(current_user.id)
    cid = uuid.UUID(connection_id)
    row = await db.get(LiveConnection, cid)
    if row is None or row.user_id != uid:
        raise HTTPException(status_code=404, detail="Connection not found")

    latest = LiveDataService.get_latest_snapshot(connection_id)
    points = (latest or {}).get("records") or []
    series = LiveDataService.get_history_series(connection_id)
    return ApiResponse(
        success=True,
        data=LiveSnapshotResponse(
            connection_id=connection_id,
            points=points,
            series=series,
        ),
    )
