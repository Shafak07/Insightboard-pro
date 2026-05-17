from functools import lru_cache

from supabase import Client, create_client

from core.config import get_settings

settings = get_settings()


@lru_cache
def _legacy_jwt_key_usable() -> bool:
    """supabase-py only accepts legacy JWT-shaped service keys, not sb_secret_*."""
    key = (settings.supabase_service_role_key or "").strip()
    return key.startswith("eyJ")


def get_supabase_client() -> Client | None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    if not _legacy_jwt_key_usable():
        return None
    try:
        return create_client(settings.supabase_url, settings.supabase_service_role_key)
    except Exception:
        return None
