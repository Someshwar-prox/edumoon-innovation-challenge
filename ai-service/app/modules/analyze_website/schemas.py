"""Public schemas for the website analysis module."""
from __future__ import annotations

from datetime import datetime

from pydantic import BaseModel, Field


class Service(BaseModel):
    name: str
    description: str = ""


class Product(BaseModel):
    name: str
    description: str = ""


class FAQ(BaseModel):
    question: str
    answer: str


class ContactInfo(BaseModel):
    email: str | None = None
    phone: str | None = None
    address: str | None = None
    social: dict[str, str] = Field(default_factory=dict)


class WebsiteProfile(BaseModel):
    company_summary: str = ""
    services: list[Service] = Field(default_factory=list)
    products: list[Product] = Field(default_factory=list)
    faqs: list[FAQ] = Field(default_factory=list)
    contact: ContactInfo = Field(default_factory=ContactInfo)


class CrawlWarning(BaseModel):
    url: str
    reason: str


class WebsiteAnalysisResult(BaseModel):
    analysis_id: str
    business_id: str
    url: str
    pages_crawled: int
    sections_indexed: int
    profile: WebsiteProfile
    crawled_urls: list[str]
    warnings: list[CrawlWarning] = Field(default_factory=list)
    created_at: datetime
    llm_model: str | None = None
