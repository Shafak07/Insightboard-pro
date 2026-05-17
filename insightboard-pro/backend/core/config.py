import os
import tempfile
from functools import lru_cache
from pathlib import Path
from typing import List
from urllib.parse import parse_qsl, urlencode, urlparse, urlunparse

from pydantic import Field, field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict


# backend/core/config.py -> backend/core -> backend -> insightboard-pro/
ROOT_ENV_FILE = Path(__file__).resolve().parent.parent.parent / ".env"


def _default_upload_dir() -> str:
    return os.path.join(tempfile.gettempdir(), "insightboard_uploads")


def _strip_quotes(value: str) -> str:
    return value.strip().strip('"').strip("'")


def _ensure_driver(url: str, driver: str) -> str:
    """postgresql:// → postgresql+asyncpg:// or postgresql+psycopg2://"""
    if not url:
        return url
    if f"+{driver}" in url:
        return url
    if url.startswith("postgresql://"):
        return url.replace("postgresql://", f"postgresql+{driver}://", 1)
    if url.startswith("postgres://"):
        return url.replace("postgres://", f"postgresql+{driver}://", 1)
    return url


def _strip_prisma_pooler_params(url: str) -> str:
    """Remove Prisma-only query flags; SQLAlchemy does not use pgbouncer=true."""
    if not url:
        return url
    parsed = urlparse(url)
    query = [(k, v) for k, v in parse_qsl(parsed.query, keep_blank_values=True) if k != "pgbouncer"]
    return urlunparse(parsed._replace(query=urlencode(query)))


def _with_ssl_param(url: str, **ssl_params: str) -> str:
    if not url:
        return url
    parsed = urlparse(url)
    query = [
        (k, v)
        for k, v in parse_qsl(parsed.query, keep_blank_values=True)
        if k not in ("ssl", "sslmode")
    ]
    for key, value in ssl_params.items():
        query.append((key, value))
    new_query = urlencode(query)
    return urlunparse(parsed._replace(query=new_query))


def _uses_transaction_pooler(url: str) -> bool:
    parsed = urlparse(url)
    if parsed.port == 6543:
        return True
    return any(k == "pgbouncer" and v.lower() == "true" for k, v in parse_qsl(parsed.query))


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=ROOT_ENV_FILE,
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # ── Application ────────────────────────────────────────
    app_name: str = "InsightBoard"
    app_env: str = "development"
    debug: bool = True
    api_v1_prefix: str = "/api/v1"

    # ── Backend ────────────────────────────────────────────
    backend_host: str = "0.0.0.0"
    backend_port: int = 8000
    secret_key: str = Field(default="change-me-in-production")
    cors_origins: str = "http://localhost:3000"

    # ── Database (Supabase / Prisma-style) ─────────────────
    # DATABASE_URL — pooler :6543 for the app (transaction mode)
    database_url: str = ""
    # DIRECT_URL — pooler :5432 for migrations & sync workers (session mode)
    direct_url: str = ""

    # ── Redis ──────────────────────────────────────────────
    redis_host: str = "localhost"
    redis_port: int = 6379
    redis_url: str = "redis://localhost:6379/0"
    cache_ttl_seconds: int = 300

    # ── Celery ─────────────────────────────────────────────
    celery_broker_url: str = "redis://localhost:6379/1"
    celery_result_backend: str = "redis://localhost:6379/2"

    # ── Supabase ───────────────────────────────────────────
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    supabase_jwt_secret: str = ""
    supabase_datasets_bucket: str = "datasets"

    # ── Upload ─────────────────────────────────────────────
    upload_temp_dir: str = Field(default_factory=_default_upload_dir)
    max_upload_bytes: int = 50 * 1024 * 1024  # 50MB

    # ── LLM (Groq preferred; OpenAI optional fallback) ─────
    groq_api_key: str = ""
    groq_model: str = "llama-3.3-70b-versatile"
    groq_base_url: str = "https://api.groq.com/openai/v1"
    openai_api_key: str = ""
    openai_model: str = "gpt-4o-mini"

    @field_validator("database_url", "direct_url", mode="before")
    @classmethod
    def normalize_db_urls(cls, v: str | None) -> str:
        if v is None:
            return ""
        return _strip_quotes(str(v))

    @field_validator("cors_origins", mode="before")
    @classmethod
    def parse_cors(cls, v: str | List[str]) -> str:
        if isinstance(v, list):
            return ",".join(v)
        return v

    @property
    def cors_origins_list(self) -> List[str]:
        return [o.strip() for o in self.cors_origins.split(",") if o.strip()]

    @property
    def is_production(self) -> bool:
        return self.app_env.lower() == "production"

    @property
    def database_url_async(self) -> str:
        """FastAPI — Supabase DATABASE_URL (pooler :6543)."""
        url = _ensure_driver(_strip_prisma_pooler_params(self.database_url), "asyncpg")
        return _with_ssl_param(url, ssl="require")

    @property
    def database_url_sync(self) -> str:
        """Alembic & Celery — Supabase DIRECT_URL (pooler :5432), like Prisma migrations."""
        source = self.direct_url.strip() or self.database_url
        url = _ensure_driver(_strip_prisma_pooler_params(source), "psycopg2")
        return _with_ssl_param(url, sslmode="require")

    @property
    def uses_supabase_transaction_pooler(self) -> bool:
        """True when DATABASE_URL targets Supabase transaction pooler (port 6543)."""
        return _uses_transaction_pooler(self.database_url)


@lru_cache
def get_settings() -> Settings:
    return Settings()
