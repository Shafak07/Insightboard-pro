"""Check profiles/datasets tables and Supabase storage bucket."""

from __future__ import annotations

import sys
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parents[1]))

from sqlalchemy import create_engine, text

from core.config import get_settings
from core.db_connect import get_sync_connect_args


def main() -> None:
    settings = get_settings()
    url = settings.database_url_sync
    engine = create_engine(url, connect_args=get_sync_connect_args(url))

    print("=== Database (DIRECT_URL) ===\n")
    with engine.connect() as conn:
        for schema, name in (("public", "profiles"), ("public", "datasets")):
            exists = conn.execute(
                text(
                    """
                    SELECT EXISTS (
                      SELECT 1 FROM information_schema.tables
                      WHERE table_schema = :schema AND table_name = :name
                    )
                    """
                ),
                {"schema": schema, "name": name},
            ).scalar()
            print(f"  {schema}.{name}: {'YES' if exists else 'NO'}")

        try:
            versions = conn.execute(text("SELECT version_num FROM alembic_version")).fetchall()
            print(f"\n  alembic_version: {[v[0] for v in versions] or '(empty)'}")
        except Exception as exc:
            print(f"\n  alembic_version: (error: {exc})")

        fks = conn.execute(
            text(
                """
                SELECT conname
                FROM pg_constraint
                WHERE conrelid = 'public.datasets'::regclass
                  AND contype = 'f'
                """
            )
        ).fetchall()
        print(f"\n  datasets foreign keys: {[r[0] for r in fks] or '(none)'}")

    print("\n=== Supabase Storage bucket ===\n")
    bucket = settings.supabase_datasets_bucket
    if not settings.supabase_url or not settings.supabase_service_role_key:
        print("  Skipped (SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY missing)")
        return

    try:
        import httpx

        base = f"{settings.supabase_url.rstrip('/')}/storage/v1"
        key = settings.supabase_service_role_key
        headers = {"apikey": key, "Authorization": f"Bearer {key}"}
        with httpx.Client(timeout=30.0) as client:
            resp = client.get(f"{base}/bucket", headers=headers)
            if resp.status_code >= 400:
                print(f"  Error listing buckets: {resp.status_code} {resp.text[:200]}")
                return
            names = [b.get("name", b.get("id", "")) for b in resp.json()]
            exists = bucket in names
            print(f"  Bucket '{bucket}': {'YES' if exists else 'NO'}")
            if names:
                print(f"  All buckets: {', '.join(names)}")
            if not exists:
                from services.storage_service import ensure_datasets_bucket

                ensure_datasets_bucket()
                print(f"  Attempted to create bucket '{bucket}'")
    except Exception as exc:
        print(f"  Error: {exc}")


if __name__ == "__main__":
    main()
