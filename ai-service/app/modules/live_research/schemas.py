"""Public schemas for the live research module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field

# "live_web" is the new source type for fresh public web pages fetched
# at chat time (DuckDuckGo results, G2/Crunchbase pages, etc.).
SourceType = Literal["website", "document", "live_web", "public_source"]


class LiveResearchRequest(BaseModel):
    business_id: str = Field(..., description="Tenant scope.")
    question: str = Field(..., min_length=2)
    company_name: str | None = Field(
        None, description="If provided, used to search public sources."
    )
    company_url: str | None = Field(
        None, description="If provided, the canonical site to re-crawl."
    )
    top_k: int = Field(6, ge=1, le=20)
    include_live_web: bool = Field(
        True,
        description="If true, also fetch fresh public sources at query time.",
    )


class LiveResearchCitation(BaseModel):
    source_type: SourceType
    source_id: str = Field(..., description="URL or document_id.")
    section_title: str | None = None
    filename: str | None = None
    page_number: int | None = None
    score: float
    snippet: str


class LiveResearchResponse(BaseModel):
    answer: str
    citations: list[LiveResearchCitation] = Field(default_factory=list)
    model: str
    asked_at: datetime
    sources_scanned: int = Field(
        0, description="How many distinct sources we pulled from."
    )
    research_strategy: str = Field(
        "", description="Human-readable summary of what we searched for."
    )
    is_advice_mode: bool = Field(
        False,
        description=(
            "True when the question was open-ended (e.g. 'how can I improve my website'). "
            "The LLM was instructed to fall back to industry best practices."
        ),
    )
