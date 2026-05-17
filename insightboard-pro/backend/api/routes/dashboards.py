"""Dashboard CRUD, publish, public view, duplicate."""

from __future__ import annotations

import uuid
from typing import Annotated, Any

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import JSONResponse
from sqlalchemy import func, select, update
from sqlalchemy.ext.asyncio import AsyncSession

from core.auth import CurrentUser, get_current_user
from core.config import get_settings
from core.database import get_db
from models.dashboard import Dashboard, DashboardTheme
from schemas.common import ApiResponse
from schemas.dashboard import (
    DashboardCreate,
    DashboardDetail,
    DashboardListResponse,
    DashboardSummary,
    DashboardUpdate,
    DeleteDashboardResponse,
    PublishDashboardResponse,
    PublicDashboardResponse,
)
from core.cache import (
    TTL_PUBLIC_DASHBOARD,
    cache_get,
    cache_key,
    cache_set,
    invalidate_prefix,
)
from services.dashboard_service import (
    clone_dashboard_row,
    dashboard_to_detail,
    ensure_unique_slug,
    sync_widgets_from_layout,
    widgets_to_layout,
)

router = APIRouter()


def _public_url(slug: str) -> str:
    settings = get_settings()
    base = settings.cors_origins_list[0] if settings.cors_origins_list else "http://localhost:3000"
    return f"{base.rstrip('/')}/share/{slug}"


async def _get_owned_dashboard(
    dashboard_id: uuid.UUID,
    user_id: uuid.UUID,
    db: AsyncSession,
) -> Dashboard:
    row = (
        await db.execute(
            select(Dashboard).where(
                Dashboard.id == dashboard_id,
                Dashboard.user_id == user_id,
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Dashboard not found")
    return row


def _normalize_widgets(raw: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            out.append(item)
        else:
            out.append(item.model_dump())
    return out


def _normalize_layout(raw: list[Any]) -> list[dict[str, Any]]:
    out: list[dict[str, Any]] = []
    for item in raw:
        if isinstance(item, dict):
            out.append(item)
        else:
            out.append(item.model_dump())
    return out


@router.post("", response_model=ApiResponse[DashboardDetail], status_code=status.HTTP_201_CREATED, include_in_schema=False)
@router.post("/", response_model=ApiResponse[DashboardDetail], status_code=status.HTTP_201_CREATED)
async def create_dashboard(
    body: DashboardCreate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DashboardDetail]:
    uid = uuid.UUID(current_user.id)
    slug = await ensure_unique_slug(db)
    row = Dashboard(
        user_id=uid,
        title=body.title.strip() or "Untitled Dashboard",
        description=body.description,
        layout=[],
        widgets=[],
        is_public=False,
        public_slug=slug,
        theme=body.theme,
    )
    db.add(row)
    await db.commit()
    await db.refresh(row)
    return ApiResponse(success=True, data=DashboardDetail.model_validate(dashboard_to_detail(row)))


@router.get("", response_model=ApiResponse[DashboardListResponse], include_in_schema=False)
@router.get("/", response_model=ApiResponse[DashboardListResponse])
async def list_dashboards(
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
    page: int = Query(1, ge=1),
    limit: int = Query(12, ge=1, le=50),
) -> ApiResponse[DashboardListResponse]:
    uid = uuid.UUID(current_user.id)
    total = (
        await db.execute(select(func.count()).select_from(Dashboard).where(Dashboard.user_id == uid))
    ).scalar_one()
    offset = (page - 1) * limit
    rows = (
        await db.execute(
            select(Dashboard)
            .where(Dashboard.user_id == uid)
            .order_by(Dashboard.updated_at.desc())
            .offset(offset)
            .limit(limit)
        )
    ).scalars().all()

    items: list[DashboardSummary] = []
    for r in rows:
        widgets = r.widgets if isinstance(r.widgets, list) else []
        items.append(
            DashboardSummary(
                id=r.id,
                title=r.title,
                description=r.description,
                is_public=r.is_public,
                public_slug=r.public_slug,
                theme=r.theme,
                view_count=r.view_count,
                widget_count=len(widgets),
                created_at=r.created_at,
                updated_at=r.updated_at,
            )
        )
    return ApiResponse(
        success=True,
        data=DashboardListResponse(items=items, total=total, page=page, limit=limit),
    )


@router.get("/public/{slug}")
async def get_public_dashboard(
    slug: str,
    db: Annotated[AsyncSession, Depends(get_db)],
) -> JSONResponse:
    pub_key = cache_key("public_dashboard", slug)
    cached = await cache_get(pub_key)
    if cached is not None:
        return JSONResponse(
            content={"success": True, "data": cached},
            headers={"Cache-Control": "max-age=60, stale-while-revalidate=30"},
        )

    row = (
        await db.execute(
            select(Dashboard).where(
                Dashboard.public_slug == slug,
                Dashboard.is_public.is_(True),
            )
        )
    ).scalar_one_or_none()
    if row is None:
        raise HTTPException(status_code=404, detail="Public dashboard not found")

    await db.execute(
        update(Dashboard)
        .where(Dashboard.id == row.id)
        .values(view_count=Dashboard.view_count + 1)
    )
    await db.commit()
    await db.refresh(row)

    detail = dashboard_to_detail(row)
    payload = PublicDashboardResponse(
        title=row.title,
        description=row.description,
        layout=detail["layout"],
        widgets=detail["widgets"],
        theme=row.theme,
        refresh_interval=row.refresh_interval,
        view_count=row.view_count,
        public_slug=row.public_slug,
    ).model_dump(mode="json")

    await cache_set(pub_key, payload, TTL_PUBLIC_DASHBOARD)
    return JSONResponse(
        content={"success": True, "data": payload},
        headers={"Cache-Control": "max-age=60, stale-while-revalidate=30"},
    )


@router.get("/{dashboard_id}", response_model=ApiResponse[DashboardDetail])
async def get_dashboard(
    dashboard_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DashboardDetail]:
    uid = uuid.UUID(current_user.id)
    row = await _get_owned_dashboard(dashboard_id, uid, db)
    return ApiResponse(
        success=True,
        data=DashboardDetail.model_validate(dashboard_to_detail(row)),
    )


@router.put("/{dashboard_id}", response_model=ApiResponse[DashboardDetail])
async def update_dashboard(
    dashboard_id: uuid.UUID,
    body: DashboardUpdate,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DashboardDetail]:
    uid = uuid.UUID(current_user.id)
    row = await _get_owned_dashboard(dashboard_id, uid, db)

    if body.title is not None:
        row.title = body.title.strip() or row.title
    if body.description is not None:
        row.description = body.description
    if body.theme is not None:
        row.theme = body.theme
    if body.refresh_interval is not None:
        row.refresh_interval = body.refresh_interval

    widgets = row.widgets if isinstance(row.widgets, list) else []
    layout = row.layout if isinstance(row.layout, list) else []

    if body.widgets is not None:
        widgets = _normalize_widgets(body.widgets)
    if body.layout is not None:
        layout = _normalize_layout(body.layout)
        widgets = sync_widgets_from_layout(widgets, layout)
    elif body.widgets is not None:
        layout = widgets_to_layout(widgets)

    row.widgets = widgets
    row.layout = layout
    await db.commit()
    await db.refresh(row)
    await invalidate_prefix(cache_key("public_dashboard", row.public_slug))
    return ApiResponse(
        success=True,
        data=DashboardDetail.model_validate(dashboard_to_detail(row)),
    )


@router.delete("/{dashboard_id}", response_model=ApiResponse[DeleteDashboardResponse])
async def delete_dashboard(
    dashboard_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DeleteDashboardResponse]:
    """Idempotent delete — safe if the client retries or double-submits."""
    uid = uuid.UUID(current_user.id)
    row = (
        await db.execute(
            select(Dashboard).where(
                Dashboard.id == dashboard_id,
                Dashboard.user_id == uid,
            )
        )
    ).scalar_one_or_none()

    slug: str | None = None
    if row is not None:
        slug = row.public_slug
        await db.delete(row)

    await db.commit()

    if slug:
        await invalidate_prefix(cache_key("public_dashboard", slug))

    return ApiResponse(
        success=True,
        data=DeleteDashboardResponse(
            id=dashboard_id,
            deleted=row is not None,
        ),
    )


@router.post("/{dashboard_id}/publish", response_model=ApiResponse[PublishDashboardResponse])
async def publish_dashboard(
    dashboard_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[PublishDashboardResponse]:
    uid = uuid.UUID(current_user.id)
    row = await _get_owned_dashboard(dashboard_id, uid, db)
    row.is_public = not row.is_public
    if row.is_public and not row.public_slug:
        row.public_slug = await ensure_unique_slug(db)
    await db.commit()
    await db.refresh(row)
    return ApiResponse(
        success=True,
        data=PublishDashboardResponse(
            is_public=row.is_public,
            public_slug=row.public_slug,
            public_url=_public_url(row.public_slug) if row.is_public else None,
        ),
    )


@router.post("/{dashboard_id}/duplicate", response_model=ApiResponse[DashboardDetail])
async def duplicate_dashboard(
    dashboard_id: uuid.UUID,
    current_user: Annotated[CurrentUser, Depends(get_current_user)],
    db: Annotated[AsyncSession, Depends(get_db)],
) -> ApiResponse[DashboardDetail]:
    uid = uuid.UUID(current_user.id)
    row = await _get_owned_dashboard(dashboard_id, uid, db)
    payload = clone_dashboard_row(row, new_user_id=uid)
    payload["public_slug"] = await ensure_unique_slug(db)
    clone = Dashboard(**payload)
    db.add(clone)
    await db.commit()
    await db.refresh(clone)
    return ApiResponse(
        success=True,
        data=DashboardDetail.model_validate(dashboard_to_detail(clone)),
    )
