"""Health endpoint — always returns 200 as long as the process is up."""
from __future__ import annotations

from fastapi import APIRouter

from app import __version__

router = APIRouter(tags=["health"])


@router.get(
    "/health",
    summary="Liveness probe. Returns 200 as long as the process is up.",
)
async def health() -> dict[str, str]:
    return {"status": "ok", "service": "ai-service", "version": __version__}
