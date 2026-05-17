import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from core.config import get_settings
from core.db_connect import get_sync_connect_args

settings = get_settings()
engine = create_engine(
    settings.database_url_sync,
    connect_args=get_sync_connect_args(settings.database_url_sync),
)

with engine.connect() as conn:
    rows = conn.execute(
        text(
            """
            SELECT column_name, data_type
            FROM information_schema.columns
            WHERE table_schema = 'public' AND table_name = 'datasets'
            ORDER BY ordinal_position
            """
        )
    ).fetchall()
    for name, dtype in rows:
        print(f"{name}: {dtype}")

    count = conn.execute(
        text("SELECT COUNT(*) FROM datasets")
    ).scalar()
    print(f"\nrow_count: {count}")

    if count:
        sample = conn.execute(
            text("SELECT id, status::text, file_name FROM datasets LIMIT 5")
        ).fetchall()
        for row in sample:
            print("sample:", row)

    enum_row = conn.execute(
        text(
            """
            SELECT t.typname
            FROM pg_type t
            JOIN pg_attribute a ON a.atttypid = t.oid
            JOIN pg_class c ON c.oid = a.attrelid
            WHERE c.relname = 'datasets'
              AND a.attname = 'status'
              AND NOT a.attisdropped
            """
        )
    ).fetchone()
    print("status_pg_type:", enum_row[0] if enum_row else None)
