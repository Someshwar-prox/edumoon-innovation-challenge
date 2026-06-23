"""Aggregate /v1 routers and mount them on the FastAPI app."""
from __future__ import annotations

from fastapi import APIRouter

from app.modules.analyze_website.routes import router as analyze_website_router
from app.modules.chatbot.routes import router as chatbot_router
from app.modules.document_processing.routes import router as document_processing_router
from app.modules.live_research.routes import router as live_research_router
from app.modules.readiness_report.routes import router as readiness_report_router

from .routes.health import router as health_router
from .routes.reset import router as reset_knowledge_router

v1_router = APIRouter(prefix="/v1")

v1_router.include_router(health_router)
v1_router.include_router(analyze_website_router)
v1_router.include_router(document_processing_router)
v1_router.include_router(readiness_report_router)
v1_router.include_router(chatbot_router)
v1_router.include_router(live_research_router)
v1_router.include_router(reset_knowledge_router)


def register_routers(app) -> None:
    app.include_router(v1_router)
