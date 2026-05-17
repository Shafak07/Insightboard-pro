from logging.config import fileConfig

from alembic import context
from sqlalchemy import create_engine, pool
from sqlalchemy.engine import Connection

from core.config import get_settings
from core.database import Base
from core.db_connect import get_sync_connect_args

config = context.config
settings = get_settings()

if config.config_file_name is not None:
    fileConfig(config.config_file_name)

target_metadata = Base.metadata

# Do not use config.set_main_option("sqlalchemy.url", ...) — ConfigParser treats
# '%' in URL-encoded passwords as interpolation syntax.

# Register models for Alembic autogenerate
import models.dataset  # noqa: E402, F401
import models.profile  # noqa: E402, F401


def get_url() -> str:
    return settings.database_url_sync


def run_migrations_offline() -> None:
    context.configure(
        url=get_url(),
        target_metadata=target_metadata,
        literal_binds=True,
        dialect_opts={"paramstyle": "named"},
    )
    with context.begin_transaction():
        context.run_migrations()


def do_run_migrations(connection: Connection) -> None:
    context.configure(connection=connection, target_metadata=target_metadata)
    with context.begin_transaction():
        context.run_migrations()


def run_migrations_online() -> None:
    # Sync psycopg2 is more reliable than asyncpg for Alembic on Windows + Supabase.
    url = get_url()
    connectable = create_engine(
        url,
        poolclass=pool.NullPool,
        connect_args=get_sync_connect_args(url),
    )
    with connectable.connect() as connection:
        do_run_migrations(connection)


if context.is_offline_mode():
    run_migrations_offline()
else:
    run_migrations_online()
