from datetime import datetime
from typing import Any, Optional

from pydantic import BaseModel, Field, HttpUrl


class LiveConnectRequest(BaseModel):
    name: str = Field(..., min_length=1, max_length=255)
    api_url: HttpUrl
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: Optional[str] = None
    refresh_seconds: int = Field(default=60, ge=30, le=86400)
    chart_x_field: Optional[str] = None
    chart_y_field: Optional[str] = None


class LiveTestRequest(BaseModel):
    api_url: HttpUrl
    method: str = "GET"
    headers: dict[str, str] = Field(default_factory=dict)
    body: Optional[str] = None


class LiveConnectionSummary(BaseModel):
    id: str
    name: str
    api_url: str
    method: str
    refresh_interval: int
    last_fetched_at: Optional[datetime] = None
    last_row_count: int
    status: str
    chart_x_field: Optional[str] = None
    chart_y_field: Optional[str] = None


class LiveConnectResponse(BaseModel):
    connection_id: str


class LiveTestResponse(BaseModel):
    ok: bool
    preview: dict[str, Any]


class LiveSnapshotResponse(BaseModel):
    connection_id: str
    points: list[dict[str, Any]]
    series: list[dict[str, Any]]
