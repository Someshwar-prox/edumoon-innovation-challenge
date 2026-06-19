"""Public schemas for the readiness report module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Confidence = Literal["low", "medium", "high"]


class Subscores(BaseModel):
    digital_presence: int = Field(0, ge=0, le=100)
    data_maturity: int = Field(0, ge=0, le=100)
    customer_support: int = Field(0, ge=0, le=100)
    automation: int = Field(0, ge=0, le=100)
    tooling: int = Field(0, ge=0, le=100)


class AutomationSuggestion(BaseModel):
    title: str
    description: str = ""
    estimated_hours_saved_per_week: int = Field(0, ge=0)


class ROIEstimate(BaseModel):
    suggestion_title: str
    estimated_annual_savings_usd: int = Field(0, ge=0)
    confidence: Confidence = "medium"


class SourcesUsed(BaseModel):
    website_sections: int = Field(0, ge=0)
    document_chunks: int = Field(0, ge=0)


class ReadinessReport(BaseModel):
    report_id: str
    business_id: str
    score: int = Field(0, ge=0, le=100)
    subscores: Subscores
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    opportunities: list[str] = Field(default_factory=list)
    automation_suggestions: list[AutomationSuggestion] = Field(default_factory=list)
    roi_estimates: list[ROIEstimate] = Field(default_factory=list)
    sources_used: SourcesUsed
    created_at: datetime
    llm_model: str | None = None
