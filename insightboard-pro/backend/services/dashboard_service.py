"""Dashboard helpers: slug generation, serialization."""

from __future__ import annotations

import secrets
import string
import uuid
from typing import Any

from sqlalchemy import select
from sqlalchemy.ext.asyncio import AsyncSession

from models.dashboard import Dashboard, DashboardTheme

_SLUG_ALPHABET = string.ascii_lowercase + string.digits


def generate_public_slug(length: int = 8) -> str:
    return "".join(secrets.choice(_SLUG_ALPHABET) for _ in range(length))


async def ensure_unique_slug(db: AsyncSession, length: int = 8) -> str:
    for _ in range(32):
        slug = generate_public_slug(length)
        exists = (
            await db.execute(select(Dashboard.id).where(Dashboard.public_slug == slug))
        ).scalar_one_or_none()
        if exists is None:
            return slug
    raise RuntimeError("Could not allocate unique public slug")


def widgets_to_layout(widgets: list[dict[str, Any]]) -> list[dict[str, Any]]:
    """Build react-grid-layout items from widget grid_position fields."""
    layout: list[dict[str, Any]] = []
    for w in widgets:
        wid = str(w.get("id", ""))
        pos = w.get("grid_position") or {}
        layout.append(
            {
                "i": wid,
                "x": int(pos.get("x", 0)),
                "y": int(pos.get("y", 0)),
                "w": int(pos.get("w", 4)),
                "h": int(pos.get("h", 3)),
                "minW": 2,
                "minH": 2,
            }
        )
    return layout


def sync_widgets_from_layout(
    widgets: list[dict[str, Any]],
    layout: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Update widget grid_position from layout drag/resize events."""
    by_id = {str(item.get("i")): item for item in layout}
    updated: list[dict[str, Any]] = []
    for w in widgets:
        wid = str(w.get("id", ""))
        item = by_id.get(wid)
        if item:
            w = {**w, "grid_position": {
                "x": int(item.get("x", 0)),
                "y": int(item.get("y", 0)),
                "w": int(item.get("w", 4)),
                "h": int(item.get("h", 3)),
            }}
        updated.append(w)
    return updated


def dashboard_to_detail(row: Dashboard) -> dict[str, Any]:
    layout = row.layout if isinstance(row.layout, list) else []
    widgets = row.widgets if isinstance(row.widgets, list) else []
    if not layout and widgets:
        layout = widgets_to_layout(widgets)
    return {
        "id": row.id,
        "title": row.title,
        "description": row.description,
        "layout": layout,
        "widgets": widgets,
        "is_public": row.is_public,
        "public_slug": row.public_slug,
        "theme": row.theme,
        "refresh_interval": row.refresh_interval,
        "view_count": row.view_count,
        "created_at": row.created_at,
        "updated_at": row.updated_at,
    }


def clone_dashboard_row(row: Dashboard, *, new_user_id: uuid.UUID | None = None) -> dict[str, Any]:
    layout = row.layout if isinstance(row.layout, list) else []
    widgets = row.widgets if isinstance(row.widgets, list) else []
    return {
        "user_id": new_user_id or row.user_id,
        "title": f"{row.title} (copy)",
        "description": row.description,
        "layout": layout,
        "widgets": widgets,
        "is_public": False,
        "theme": row.theme,
        "refresh_interval": row.refresh_interval,
        "view_count": 0,
    }
