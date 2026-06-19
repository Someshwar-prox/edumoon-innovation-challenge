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


@asynccontextmanager
async def lifespan(app: FastAPI):
    configure_logging()
    # Eager-init the singletons so a misconfigured env fails loud at startup
    # rather than on the first request.
    app.state.embedding_model = get_embedding_model()
    app.state.qdrant = get_qdrant()
    app.state.groq = get_groq()
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
