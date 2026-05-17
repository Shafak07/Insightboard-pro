import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class DashboardTheme(str, enum.Enum):
    dark = "dark"
    light = "light"
    system = "system"


class Dashboard(Base):
    __tablename__ = "dashboards"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    title: Mapped[str] = mapped_column(String(255), nullable=False, default="Untitled Dashboard")
    description: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    layout: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    widgets: Mapped[list[dict[str, Any]]] = mapped_column(JSONB, nullable=False, default=list)
    is_public: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    public_slug: Mapped[str] = mapped_column(String(8), nullable=False, unique=True, index=True)
    theme: Mapped[DashboardTheme] = mapped_column(
        ENUM(
            DashboardTheme,
            name="dashboard_theme",
            create_type=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=DashboardTheme.dark,
    )
    refresh_interval: Mapped[Optional[int]] = mapped_column(Integer, nullable=True)
    view_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
