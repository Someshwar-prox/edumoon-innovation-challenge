from app import __version__
from app.api.router import register_routers
from app.core.config import settings
from app.core.embedding import get_embedding_model
from app.core.groq_client import get_groq
from app.core.logging_config import configure_logging
from app.core.qdrant import get_qdrant

from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

import httpx
import logging as _logging
import threading

_log = _logging.getLogger(__name__)
_live_collection_ensured = False
_live_collection_lock = threading.Lock()


def _ensure_live_collection_once() -> None:
    """Call ensure_live_collection() at most once per process.

    Qdrant returns 409 ("already exists") when you PUT a collection
    that exists. That's a warning, not an error, and spamming it on
    every boot is noisy. We try once, and never again — the collection
    is durable on the cloud cluster.
    """
    global _live_collection_ensured
    with _live_collection_lock:
        if _live_collection_ensured:
            return
        try:
            from app.modules.live_research.service import ensure_live_collection
            ensure_live_collection(get_qdrant())
            _live_collection_ensured = True
        except httpx.HTTPStatusError as exc:
            if exc.response.status_code == 409:
                _log.debug("live_research collection already exists (409)")
                _live_collection_ensured = True
            else:
                _log.warning("ensure_live_collection failed: %s", exc)
        except Exception as exc:  # noqa: BLE001
            _log.warning("ensure_live_collection failed: %s", exc)


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    # Eager-init the singletons so a misconfigured env fails loud at startup
    # rather than on the first request.
    app.state.embedding_model = get_embedding_model()
    app.state.qdrant = get_qdrant()
    app.state.groq = get_groq()
    # Create the live_research collection on the cloud Qdrant cluster.
    # Idempotent — runs at most once per process; the 409 from a
    # pre-existing collection is silently swallowed.
    _ensure_live_collection_once()
    yield


app = FastAPI(
    title="AIBridge AI Service",
    version=__version__,
    description=(
        "Microservice powering website analysis, document processing, "
        "AI readiness reports, and the RAG chatbot. "
        "See docs/API_CONTRACTS.md for the contract."
    ),
    lifespan=lifespan,
)

# Permissive CORS so the local static frontend (frontend/) can hit the API
# from a different origin (e.g. http://127.0.0.1:5500). The real gateway
# already authenticates; loosening CORS here only affects which browsers
# can reach us, not what they can do.
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=False,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/", tags=["meta"])
async def root() -> dict[str, str]:
    return {
        "service": "ai-service",
        "version": __version__,
        "docs": "/docs",
        "api": "/v1",
        "health": "/v1/health",
    }


register_routers(app)


if __name__ == "__main__":  # pragma: no cover
    import uvicorn

    uvicorn.run(
        "app.main:app",
        host=settings.app_host,
        port=settings.app_port,
        reload=settings.app_env == "development",
    )
