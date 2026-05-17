from datetime import datetime
from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, ConfigDict

from models.dataset import DatasetStatus


class DatasetSummary(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    file_name: str
    row_count: int
    column_count: int
    status: DatasetStatus
    created_at: datetime


class DatasetDetail(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: UUID
    name: str
    description: Optional[str] = None
    file_name: str
    file_size: int
    row_count: int
    column_count: int
    columns_metadata: Optional[list[dict[str, Any]]] = None
    eda_profile: Optional[dict[str, Any]] = None
    status: DatasetStatus
    storage_path: str
    error_message: Optional[str] = None
    created_at: datetime
    updated_at: datetime
    sample_data: Optional[list[dict[str, Any]]] = None


class UploadResponse(BaseModel):
    dataset_id: UUID
    status: str = "processing"


class DatasetListResponse(BaseModel):
    items: list[DatasetSummary]
    total: int
    page: int
    limit: int


class PaginatedRowsResponse(BaseModel):
    rows: list[dict[str, Any]]
    total_rows: int
    page: int
    limit: int
    sort_by: Optional[str] = None
    sort_dir: str = "asc"


class ChartDataResponse(BaseModel):
    """Optimized payload for chart builder (single round-trip)."""

    rows: list[dict[str, Any]]
    total_rows: int
    columns_metadata: Optional[list[dict[str, Any]]] = None
    correlations: Optional[dict[str, Any]] = None
    source: str = "storage"
    aggregated: bool = False
    x_col: Optional[str] = None
    y_col: Optional[str] = None
