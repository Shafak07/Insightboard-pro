"""Ensure public.profiles rows exist for authenticated users."""

from __future__ import annotations

import uuid

from sqlalchemy import text
from sqlalchemy.ext.asyncio import AsyncSession

from core.sync_db import sync_session_scope


def get_profile_sync(user_id: str) -> dict[str, str | None] | None:
    """Load profile row from Postgres (avoids supabase-py with sb_* API keys)."""
    with sync_session_scope() as session:
        row = session.execute(
            text(
                """
                SELECT full_name, avatar_url, plan::text AS plan
                FROM public.profiles
                WHERE id = :id
                """
            ),
            {"id": uuid.UUID(user_id)},
        ).mappings().first()
    if row is None:
        return None
    return {
        "full_name": row["full_name"],
        "avatar_url": row["avatar_url"],
        "plan": row["plan"] or "free",
    }


async def ensure_profile_async(
    db: AsyncSession,
    user_id: str,
    email: str,
    full_name: str | None = None,
    avatar_url: str | None = None,
) -> None:
    await db.execute(
        text(
            """
            INSERT INTO public.profiles (id, email, full_name, avatar_url)
            VALUES (:id, :email, :full_name, :avatar_url)
            ON CONFLICT (id) DO UPDATE SET
              email = EXCLUDED.email,
              full_name = COALESCE(EXCLUDED.full_name, public.profiles.full_name),
              avatar_url = COALESCE(EXCLUDED.avatar_url, public.profiles.avatar_url),
              updated_at = NOW()
            """
        ),
        {
            "id": uuid.UUID(user_id),
            "email": email,
            "full_name": full_name,
            "avatar_url": avatar_url,
        },
    )


def ensure_profile_sync(
    user_id: str,
    email: str,
    full_name: str | None = None,
    avatar_url: str | None = None,
) -> None:
    with sync_session_scope() as session:
        session.execute(
            text(
                """
                INSERT INTO public.profiles (id, email, full_name, avatar_url)
                VALUES (:id, :email, :full_name, :avatar_url)
                ON CONFLICT (id) DO NOTHING
                """
            ),
            {
                "id": uuid.UUID(user_id),
                "email": email,
                "full_name": full_name,
                "avatar_url": avatar_url,
            },
        )
