"""Align datasets table with SQLAlchemy model (file_name, storage_path)."""

from __future__ import annotations

import sqlalchemy as sa
from alembic import op

revision = "20240518_align_datasets"
down_revision = "20240517_profiles"
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {c["name"] for c in insp.get_columns("datasets", schema="public")}

    if "file_name" not in columns:
        op.add_column(
            "datasets",
            sa.Column("file_name", sa.String(512), nullable=False, server_default=""),
        )

    if "storage_path" not in columns:
        op.add_column(
            "datasets",
            sa.Column(
                "storage_path",
                sa.String(1024),
                nullable=False,
                server_default="",
            ),
        )

    if "file_path" in columns:
        op.execute(
            """
            UPDATE datasets
            SET
              storage_path = CASE
                WHEN COALESCE(storage_path, '') = '' THEN COALESCE(file_path, '')
                ELSE storage_path
              END,
              file_name = CASE
                WHEN COALESCE(file_name, '') = '' THEN
                  COALESCE(
                    NULLIF(regexp_replace(file_path, '^.+/', ''), ''),
                    file_path,
                    'unknown.csv'
                  )
                ELSE file_name
              END
            """
        )
        op.drop_column("datasets", "file_path")

    op.alter_column("datasets", "file_name", server_default=None)
    op.alter_column("datasets", "storage_path", server_default=None)


def downgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    columns = {c["name"] for c in insp.get_columns("datasets", schema="public")}

    if "file_path" not in columns:
        op.add_column("datasets", sa.Column("file_path", sa.Text(), nullable=True))
        op.execute(
            """
            UPDATE datasets
            SET file_path = CASE
              WHEN COALESCE(storage_path, '') <> '' THEN storage_path
              ELSE file_name
            END
            """
        )

    if "storage_path" in columns:
        op.drop_column("datasets", "storage_path")
    if "file_name" in columns:
        op.drop_column("datasets", "file_name")
