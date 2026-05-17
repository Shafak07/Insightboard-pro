import sqlalchemy as sa
from alembic import op
from sqlalchemy.dialects.postgresql import JSONB

revision = "20240516_datasets"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    bind = op.get_bind()
    insp = sa.inspect(bind)
    if "datasets" in insp.get_table_names(schema="public"):
        fks = insp.get_foreign_keys("datasets", schema="public")
        if any(fk.get("referred_table") == "profiles" for fk in fks):
            return
        # Table exists without FK — fixed in 20240517_profiles

    op.create_table(
        "datasets",
        sa.Column("id", sa.Uuid(), nullable=False),
        sa.Column("user_id", sa.Uuid(), nullable=False),
        sa.Column("name", sa.String(255), nullable=False),
        sa.Column("description", sa.Text(), nullable=True),
        sa.Column("file_name", sa.String(512), nullable=False),
        sa.Column("file_size", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("row_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("column_count", sa.Integer(), nullable=False, server_default="0"),
        sa.Column("columns_metadata", JSONB(), nullable=True),
        sa.Column("eda_profile", JSONB(), nullable=True),
        sa.Column(
            "status",
            sa.String(32),
            nullable=False,
            server_default="processing",
        ),
        sa.Column(
            "storage_path", sa.String(1024), nullable=False, server_default=""
        ),
        sa.Column("error_message", sa.Text(), nullable=True),
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
    op.create_index("ix_datasets_user_id", "datasets", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_datasets_user_id", table_name="datasets")
    op.drop_table("datasets")
