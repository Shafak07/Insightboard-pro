from typing import Generic, Literal, TypeVar

from pydantic import BaseModel, Field

T = TypeVar("T")


class ApiResponse(BaseModel, Generic[T]):
    success: bool = True
    data: T | None = None
    message: str | None = None
    error: str | None = None


class HealthStatus(BaseModel):
    status: Literal["ok", "degraded", "error"]
    version: str
    services: dict[str, bool] = Field(default_factory=dict)
