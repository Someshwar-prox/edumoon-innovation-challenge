"""Public schemas for the readiness report module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

Confidence = Literal["low", "medium", "high"]


class Subscores(BaseModel):
    accessibility: int = Field(0, ge=0, le=25)
    structured_data: int = Field(0, ge=0, le=25)
    semantic_structure: int = Field(0, ge=0, le=25)
    content_clarity: int = Field(0, ge=0, le=25)


class AutomationSuggestion(BaseModel):
    title: str
    description: str = ""
    severity: str = "medium"


class Breakdown(BaseModel):
    accessibility: int = Field(0, ge=0, le=25)
    structured_data: int = Field(0, ge=0, le=25)
    semantic_structure: int = Field(0, ge=0, le=25)
    content_clarity: int = Field(0, ge=0, le=25)


class ReadinessReport(BaseModel):
    report_id: str
    business_id: str
    score: int = Field(0, ge=0, le=100)
    breakdown: Breakdown
    confidence: int = Field(0, ge=0, le=100)
    strengths: list[str] = Field(default_factory=list)
    weaknesses: list[str] = Field(default_factory=list)
    recommendations: list[AutomationSuggestion] = Field(default_factory=list)
    created_at: datetime
    llm_model: str | None = None

