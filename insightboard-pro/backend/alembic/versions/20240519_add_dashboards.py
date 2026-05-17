"""Add dashboards table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20240519_dashboards"
down_revision = "20240518_align_datasets"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE public.dashboard_theme AS ENUM ('dark', 'light', 'system');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.create_table(
        "dashboards",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("title", sa.String(255), nullable=False, server_default="Untitled Dashboard"),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("layout", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("widgets", postgresql.JSONB(astext_type=sa.Text()), nullable=False, server_default="[]"),
        sa.Column("is_public", sa.Boolean(), nullable=False, server_default="false"),
        sa.Column("public_slug", sa.String(8), nullable=False),
        sa.Column(
            "theme",
            postgresql.ENUM(
                "dark", "light", "system",
                name="dashboard_theme",
                create_type=False,
            ),
            nullable=False,
            server_default="dark",
        ),
        sa.Column("refresh_interval", sa.Integer(), nullable=True),
        sa.Column("view_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.Column(
            "updated_at",
            sa.DateTime(timezone=True),
            server_default=sa.text("now()"),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["user_id"], ["profiles.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("public_slug"),
    )
    op.create_index("ix_dashboards_user_id", "dashboards", ["user_id"])
    op.create_index("ix_dashboards_public_slug", "dashboards", ["public_slug"])


def downgrade() -> None:
    op.drop_index("ix_dashboards_public_slug", table_name="dashboards")
    op.drop_index("ix_dashboards_user_id", table_name="dashboards")
    op.drop_table("dashboards")
    op.execute("DROP TYPE IF EXISTS public.dashboard_theme")
