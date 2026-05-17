from datetime import datetime
from typing import Any, Literal, Optional
from uuid import UUID

from pydantic import BaseModel, Field

from models.dashboard import DashboardTheme


class WidgetChartConfig(BaseModel):
    chart_type: str = "bar"
    x_col: str = ""
    y_col: str = ""
    group_by: Optional[str] = None
    aggregation: Optional[str] = None
    title: str = ""
    color_scheme: str = "corporate"
    show_ai_insight: bool = False
    show_grid_lines: bool = True
    show_legend: bool = True
    show_tooltip: bool = True
    horizontal_bar: bool = False


class GridPosition(BaseModel):
    x: int = 0
    y: int = 0
    w: int = 4
    h: int = 3


class DashboardWidget(BaseModel):
    id: str
    type: Literal["chart", "metric", "table", "text"]
    dataset_id: Optional[str] = None
    chart_config: Optional[WidgetChartConfig] = None
    text_content: Optional[str] = None
    grid_position: GridPosition = Field(default_factory=GridPosition)


class LayoutItem(BaseModel):
    i: str
    x: int
    y: int
    w: int
    h: int
    minW: Optional[int] = None
    minH: Optional[int] = None


class DashboardCreate(BaseModel):
    title: str = "Untitled Dashboard"
    description: Optional[str] = None
    theme: DashboardTheme = DashboardTheme.dark


class DashboardUpdate(BaseModel):
    title: Optional[str] = None
    description: Optional[str] = None
    layout: Optional[list[LayoutItem | dict[str, Any]]] = None
    widgets: Optional[list[DashboardWidget | dict[str, Any]]] = None
    theme: Optional[DashboardTheme] = None
    refresh_interval: Optional[int] = None


class DashboardSummary(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    is_public: bool
    public_slug: str
    theme: DashboardTheme
    view_count: int
    widget_count: int = 0
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardDetail(BaseModel):
    id: UUID
    title: str
    description: Optional[str] = None
    layout: list[dict[str, Any]] = Field(default_factory=list)
    widgets: list[dict[str, Any]] = Field(default_factory=list)
    is_public: bool
    public_slug: str
    theme: DashboardTheme
    refresh_interval: Optional[int] = None
    view_count: int
    created_at: datetime
    updated_at: datetime

    model_config = {"from_attributes": True}


class DashboardListResponse(BaseModel):
    items: list[DashboardSummary]
    total: int
    page: int = 1
    limit: int = 12


class DeleteDashboardResponse(BaseModel):
    id: UUID
    deleted: bool


class PublishDashboardResponse(BaseModel):
    is_public: bool
    public_slug: str
    public_url: Optional[str] = None


class PublicDashboardResponse(BaseModel):
    title: str
    description: Optional[str] = None
    layout: list[dict[str, Any]] = Field(default_factory=list)
    widgets: list[dict[str, Any]] = Field(default_factory=list)
    theme: DashboardTheme
    refresh_interval: Optional[int] = None
    view_count: int
    public_slug: str
