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

class GenerateDescriptionRequest(BaseModel):
    url: str | None = Field(None, description="Optional website URL to fetch context.")
    name: str | None = Field(None, description="Optional business name to seed the prompt.")

class GenerateDescriptionResponse(BaseModel):
    description: str


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
    widget_id: str | None = Field(None, description="Optional — secondary scope tag (today memory is keyed by business_id).")
    widget_name: str | None = Field(None, description="Optional name of the widget.")
    widget_description: str | None = Field(None, description="Optional description of the widget.")
    top_k: int = Field(6, ge=1, le=50)
    score_threshold: float = Field(0.30, ge=0.0, le=1.0)
    include_live_web: bool = Field(
        False,
        description=(
            "Off by default — saves 1-3s of network per request. The "
            "gateway flips this on for `include_live_web=true` requests. "
            "Fan out to DuckDuckGo + public sources at query time and merge "
            "live-web hits into the LLM context with their own citations."
        ),
    )
    company_name: str | None = Field(
        None, description="Optional — used to build brand-aware live-web queries and pin the system prompt to the actual business."
    )
    company_url: str | None = Field(
        None, description="Optional — used for site: searches and the homepage fetch."
    )
    recent_messages: list[dict] | None = Field(
        None,
        description=(
            "Last few messages from the same session, so the advisor "
            "remembers the user's prior turns. Each entry: {role: 'user'|'assistant', content: str}."
        ),
    )
    chat_mode: Literal["text", "voice"] = Field(
        "text", description="Hint to the LLM to generate a shorter response if 'voice'."
    )


class ErrorDetail(BaseModel):
    code: str
    message: str
    details: dict | None = None


class ErrorResponse(BaseModel):
    error: ErrorDetail
