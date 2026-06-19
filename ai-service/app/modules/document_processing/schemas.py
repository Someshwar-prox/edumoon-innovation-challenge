"""Public schemas for the document processing module."""
from __future__ import annotations

from datetime import datetime
from typing import Literal

from pydantic import BaseModel, Field


class IndexedDocument(BaseModel):
    document_id: str = Field(..., description="UUID generated server-side.")
    filename: str
    size_bytes: int
    pages: int | None = Field(None, description="None for DOCX/TXT.")
    chunk_count: int
    token_estimate: int
    status: Literal["indexed"] = "indexed"


class SkippedDocument(BaseModel):
    filename: str
    reason: str = Field(
        ...,
        description="Machine-readable reason — typically an error code from errors.py.",
    )


class ProcessDocumentsResponse(BaseModel):
    business_id: str
    results: list[IndexedDocument] = Field(default_factory=list)
    skipped: list[SkippedDocument] = Field(default_factory=list)
    created_at: datetime
