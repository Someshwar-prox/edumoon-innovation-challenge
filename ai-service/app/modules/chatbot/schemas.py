"""Public schemas for the chatbot module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


SourceType = Literal["website", "document"]


class Citation(BaseModel):
    source_type: SourceType
    source_id: str = Field(..., description="URL for website, document_id for document.")
    section_title: str | None = Field(None, description="Website only.")
    filename: str | None = Field(None, description="Document only.")
    page_number: int | None = Field(None, description="Document PDF only; None for DOCX/TXT and website.")
    score: float
    snippet: str = Field(..., description="Truncated text of the matched chunk.")


class ChatResponse(BaseModel):
    answer: str
    citations: list[Citation] = Field(default_factory=list)
    model: str = Field(..., description="LLM model used to generate the answer.")
    asked_at: datetime
