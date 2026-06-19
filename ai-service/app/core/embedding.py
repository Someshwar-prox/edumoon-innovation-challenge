"""sentence-transformers wrapper. Loads BGE-small-en-v1.5 once."""
from __future__ import annotations

import logging
from functools import lru_cache
from typing import Sequence

from app.core.config import settings

log = logging.getLogger(__name__)


class EmbeddingModel:
    def __init__(self, model_path: str, device: str, batch_size: int) -> None:
        from sentence_transformers import SentenceTransformer  # noqa: WPS433

        self._model = SentenceTransformer(model_path, device=device)
        self._batch_size = batch_size
        self.dim = self._model.get_sentence_embedding_dimension()
        log.info("embedding model loaded", extra={"dim": self.dim, "path": model_path, "device": device})

    def embed(self, texts: Sequence[str]) -> list[list[float]]:
        if not texts:
            return []
        vectors = self._model.encode(
            list(texts),
            batch_size=self._batch_size,
            convert_to_numpy=True,
            normalize_embeddings=True,
            show_progress_bar=False,
        )
        return [v.tolist() for v in vectors]

    def embed_query(self, query: str) -> list[float]:
        # BAAI/bge requires this exact prefix at query time for retrieval to
        # work properly; do NOT add it at ingestion.
        prefixed = f"Represent this sentence for searching relevant passages: {query}"
        return self.embed([prefixed])[0]


@lru_cache(maxsize=1)
def get_embedding_model() -> EmbeddingModel:
    return EmbeddingModel(
        model_path=str(settings.models_dir / "BAAI__bge-small-en-v1.5"),
        device=settings.embedding_device,
        batch_size=settings.embedding_batch_size,
    )
