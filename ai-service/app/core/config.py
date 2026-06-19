"""Centralised settings, loaded from .env. Import `settings` here."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field
from pydantic_settings import BaseSettings, SettingsConfigDict


class Settings(BaseSettings):
    model_config = SettingsConfigDict(
        env_file=".env",
        env_file_encoding="utf-8",
        case_sensitive=False,
        extra="ignore",
    )

    # Server
    app_host: str = "127.0.0.1"
    app_port: int = 8000
    app_env: str = "development"

    # Paths
    data_dir: Path = Path("./data")
    models_dir: Path = Path("./data/models")
    uploads_dir: Path = Path("./data/uploads")
    cache_dir: Path = Path("./data/cache")

    # Qdrant
    qdrant_host: str = "127.0.0.1"
    qdrant_port: int = 6333
    qdrant_grpc_port: int = 6334
    qdrant_api_key: str | None = None
    qdrant_prefer_grpc: bool = False

    # Embeddings
    embedding_model: str = "BAAI/bge-small-en-v1.5"
    embedding_dim: int = 384
    embedding_device: str = "cpu"
    embedding_batch_size: int = 32
    embedding_max_seq_length: int = 512

    # Chunking
    chunk_size: int = 500
    chunk_overlap: int = 80

    # Document processing
    doc_max_file_bytes: int = 25 * 1024 * 1024
    doc_max_files_per_request: int = 10
    doc_allowed_exts: str = ".pdf,.docx,.txt"

    # Groq. GROQ_API_KEYS is a comma-separated list for failover; GROQ_API_KEY
    # is the legacy single-key entry point and gets folded into the list.
    groq_api_key: str = ""
    groq_api_keys: str = ""
    groq_model: str = "llama-3.1-70b-versatile"
    groq_temperature: float = 0.2
    groq_max_tokens: int = 1024
    groq_timeout_seconds: int = 30

    # Crawler
    crawler_max_pages: int = 8
    crawler_timeout_seconds: int = 20
    crawler_user_agent: str = "AIBridge-Crawler/0.1 (+https://aibridge.local)"

    # Chatbot
    chat_top_k: int = 6
    chat_score_threshold: float = 0.30
    chat_max_context_chars: int = 6000

    @property
    def qdrant_url(self) -> str:
        return f"http://{self.qdrant_host}:{self.qdrant_port}"

    @property
    def doc_allowed_exts_list(self) -> tuple[str, ...]:
        return tuple(
            ext.strip().lower() for ext in self.doc_allowed_exts.split(",") if ext.strip()
        )

    @property
    def groq_api_key_list(self) -> list[str]:
        keys: list[str] = []
        if self.groq_api_keys:
            keys.extend(k.strip() for k in self.groq_api_keys.split(","))
        if self.groq_api_key:
            keys.append(self.groq_api_key.strip())
        return [k for k in keys if k and k != "replace-me"]


@lru_cache(maxsize=1)
def get_settings() -> Settings:
    settings = Settings()
    for path in (settings.data_dir, settings.models_dir, settings.uploads_dir, settings.cache_dir):
        path.mkdir(parents=True, exist_ok=True)
    return settings


settings = get_settings()
