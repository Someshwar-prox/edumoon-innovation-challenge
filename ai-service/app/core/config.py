"""Centralised settings, loaded from .env. Import `settings` here."""
from __future__ import annotations

from functools import lru_cache
from pathlib import Path

from pydantic import Field, model_validator
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

    # Qdrant (Cloud). Local-binary Qdrant is no longer supported.
    qdrant_url: str = ""
    qdrant_api_key: str = ""

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

    # Groq API Keys by feature
    groq_api_key_description: str = ""
    groq_api_key_widget: str = ""
    groq_api_key_onboarding: str = ""
    groq_api_key_voice: str = ""
    groq_api_key_report: str = ""
    groq_api_key_research: str = ""
    groq_api_key: str = ""
    groq_api_keys: str = ""
    
    groq_model: str = "llama-3.1-70b-versatile"
    groq_temperature: float = 0.5
    groq_max_tokens: int = 1024
    groq_timeout_seconds: int = 30

    # Crawler
    crawler_max_pages: int = 8
    crawler_timeout_seconds: int = 20
    crawler_user_agent: str = "AIBridge-Crawler/0.1 (+https://aibridge.local)"

    # Chatbot
    chat_top_k: int = 6
    chat_score_threshold: float = 0.30
    chat_max_context_chars: int = 16000
    # When the user has never crawled/uploaded anything for a business,
    # the chatbot used to error out with "no indexed content". With this
    # flag ON, the chatbot will kick off a one-shot BFS crawl of the
    # business's website (if `company_url` was supplied) and seed the
    # kb_master collection BEFORE running the live-web augmentation.
    # Net effect: the chatbot always has *something* to work with, even
    # for a brand-new business whose owner hasn't touched onboarding.
    # Set CHAT_AUTO_CRAWL_ON_EMPTY_KB=false to disable (e.g. if Qdrant
    # billing is tight and you don't want surprise upserts).
    chat_auto_crawl_on_empty_kb: bool = True

    # Supabase Storage (cardless durable upload storage).
    # ai-service receives the storage path from the gateway in the multipart
    # `metadata` field; it does NOT re-upload — the gateway already wrote the
    # durable copy. This block just lets ai-service fetch the original bytes
    # back when it needs to re-extract.
    supabase_url: str = ""
    supabase_service_role_key: str = ""
    supabase_bucket: str = "cluster"

    # Live-web augmentation. When enabled, /v1/chat and /v1/live-research
    # fan out to DuckDuckGo + a few public sources at query time and
    # mix the live hits into the LLM context. Costs ~1-2s of network per
    # request. Default ON for demos; set LIVE_WEB_ENABLED=false to disable.
    live_web_enabled: bool = True
    live_web_max_queries: int = 5
    live_web_max_hits: int = 12
    live_web_per_query_fetch: int = 4
    live_web_snippet_chars: int = 400
    live_web_fetch_chars: int = 6000
    # Cap per hit (chars) when the LLM is consuming context. Wikipedia
    # extracts can be very long — without a per-hit cap, one 5000-char
    # extract eats most of the context budget.
    live_web_per_hit_context_cap: int = 2500

    @model_validator(mode="after")
    def _require_qdrant(self) -> "Settings":
        if not self.qdrant_url or "YOUR-CLUSTER" in self.qdrant_url:
            raise RuntimeError(
                "QDRANT_URL is missing or still placeholder. "
                "Set it in ai-service/.env to your Qdrant Cloud cluster URL "
                "(https://<cluster-id>.<region>.cloud.qdrant.io:6333)."
            )
        return self

    @property
    def doc_allowed_exts_list(self) -> tuple[str, ...]:
        return tuple(
            ext.strip().lower() for ext in self.doc_allowed_exts.split(",") if ext.strip()
        )

    def get_groq_api_key_list(self, feature: str = "general") -> list[str]:
        keys: list[str] = []
        feature_key = getattr(self, f"groq_api_key_{feature}", None)
        if feature_key:
            keys.extend(k.strip() for k in feature_key.split(",") if k.strip() and k.strip() != "replace-me")
            
        if not keys:
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