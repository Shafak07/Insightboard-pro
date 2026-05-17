from typing import Any, Optional
from uuid import UUID

from pydantic import BaseModel, Field


class RecommendedChart(BaseModel):
    chart_type: str
    x_column: str
    y_column: str
    reason: str = ""


class DatasetAISummary(BaseModel):
    executive_summary: str = ""
    key_findings: list[str] = Field(default_factory=list)
    data_quality_issues: list[str] = Field(default_factory=list)
    recommended_charts: list[RecommendedChart] = Field(default_factory=list)
    business_questions: list[str] = Field(default_factory=list)
    anomalies: list[str] = Field(default_factory=list)
    quality_score: Optional[float] = None


class ChartInsightRequest(BaseModel):
    chart_type: str
    chart_data: list[dict[str, Any]] = Field(default_factory=list)
    x_col: str
    y_col: str
    chart_title: Optional[str] = None


class ChartInsightResponse(BaseModel):
    insight: str


class AskQuestionRequest(BaseModel):
    dataset_id: UUID
    question: str = Field(min_length=2, max_length=2000)


class AskQuestionResponse(BaseModel):
    answer: str
    sql_query: str = ""
    confidence: float = Field(ge=0.0, le=1.0, default=0.5)
    follow_up_questions: list[str] = Field(default_factory=list)
