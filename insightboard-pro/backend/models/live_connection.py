import enum
import uuid
from datetime import datetime
from typing import Any, Optional

from sqlalchemy import DateTime, ForeignKey, Integer, String, Text, Uuid
from sqlalchemy.dialects.postgresql import ENUM, JSONB
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.sql import func

from core.database import Base


class LiveConnectionStatus(str, enum.Enum):
    active = "active"
    paused = "paused"
    error = "error"


class LiveConnection(Base):
    __tablename__ = "live_connections"

    id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True), primary_key=True, default=uuid.uuid4
    )
    user_id: Mapped[uuid.UUID] = mapped_column(
        Uuid(as_uuid=True),
        ForeignKey("profiles.id", ondelete="CASCADE"),
        nullable=False,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(255), nullable=False)
    api_url: Mapped[str] = mapped_column(Text, nullable=False)
    method: Mapped[str] = mapped_column(String(10), nullable=False, default="GET")
    headers: Mapped[Optional[dict[str, Any]]] = mapped_column(JSONB, nullable=True)
    request_body: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    refresh_interval: Mapped[int] = mapped_column(Integer, nullable=False, default=60)
    chart_x_field: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    chart_y_field: Mapped[Optional[str]] = mapped_column(String(255), nullable=True)
    last_fetched_at: Mapped[Optional[datetime]] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    last_row_count: Mapped[int] = mapped_column(Integer, nullable=False, default=0)
    status: Mapped[LiveConnectionStatus] = mapped_column(
        ENUM(
            LiveConnectionStatus,
            name="live_connection_status",
            create_type=False,
            values_callable=lambda e: [m.value for m in e],
        ),
        nullable=False,
        default=LiveConnectionStatus.active,
    )
    last_error: Mapped[Optional[str]] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), nullable=False
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        server_default=func.now(),
        onupdate=func.now(),
        nullable=False,
    )
