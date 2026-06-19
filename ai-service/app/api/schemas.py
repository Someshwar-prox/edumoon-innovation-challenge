"""Request/response schemas shared across the AI service API surface."""
from __future__ import annotations

from typing import Literal

from pydantic import BaseModel, Field, HttpUrl


class AnalyzeWebsiteRequest(BaseModel):
    business_id: str = Field(..., description="UUID owned by the gateway.")
    url: HttpUrl = Field(..., description="http(s) URL of the business website.")
    max_pages: int = Field(8, ge=1, le=50, description="Cap on BFS crawl size.")
    force_recrawl: bool = Field(False, description="Re-crawl even if cached.")


# /v1/process-documents takes multipart/form-data (business_id, files,
# metadata, replace_existing). Declared inline on the route with Form/File.


FocusArea = Literal[
    "digital_presence",
    "data_maturity",
    "customer_support",
    "automation",
    "tooling",
]


class GenerateReportRequest(BaseModel):
    business_id: str = Field(..., description="UUID owned by the gateway.")
    focus_areas: list[FocusArea] | None = Field(
        None, description="Subset of focus areas; default = all."
    )
    include_documents: bool = Field(True, description="Include uploaded docs in the analysis.")
    language: str = Field("en", description="Output language for prose sections.")


class ChatRequest(BaseModel):
    business_id: str = Field(..., description="UUID owned by the gateway.")
    question: str = Field(..., min_length=1, max_length=1000)
    session_id: str | None = Field(None, description="Optional widget session id.")
    top_k: int = Field(6, ge=1, le=50)
    score_threshold: float = Field(0.30, ge=0.0, le=1.0)


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
