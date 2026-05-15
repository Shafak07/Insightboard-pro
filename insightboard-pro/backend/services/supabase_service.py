from supabase import Client, create_client

from core.config import get_settings

settings = get_settings()


def get_supabase_client() -> Client | None:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
