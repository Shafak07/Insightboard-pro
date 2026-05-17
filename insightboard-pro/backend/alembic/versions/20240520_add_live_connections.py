"""Add live_connections table."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects import postgresql

revision = "20240520_live_connections"
down_revision = "20240519_dashboards"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.execute(
        """
        DO $$ BEGIN
            CREATE TYPE public.live_connection_status AS ENUM ('active', 'paused', 'error');
        EXCEPTION
            WHEN duplicate_object THEN NULL;
        END $$;
        """
    )

    op.create_table(
        "live_connections",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("api_url", sa.Text(), nullable=False),
        sa.Column("method", sa.String(10), nullable=False, server_default="GET"),
        sa.Column("headers", postgresql.JSONB(astext_type=sa.Text()), nullable=True),
        sa.Column("request_body", sa.Text(), nullable=True),
        sa.Column("refresh_interval", sa.Integer(), nullable=False, server_default="60"),
        sa.Column("chart_x_field", sa.String(255), nullable=True),
        sa.Column("chart_y_field", sa.String(255), nullable=True),
        sa.Column("last_fetched_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column(
            "status",
            postgresql.ENUM(
                "active",
                "paused",
                "error",
                name="live_connection_status",
                create_type=False,
            ),
            nullable=False,
            server_default="active",
        ),
        sa.Column("last_error", sa.Text(), nullable=True),
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
    )
    op.create_index("ix_live_connections_user_id", "live_connections", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_live_connections_user_id", table_name="live_connections")
    op.drop_table("live_connections")
    op.execute("DROP TYPE IF EXISTS public.live_connection_status")
