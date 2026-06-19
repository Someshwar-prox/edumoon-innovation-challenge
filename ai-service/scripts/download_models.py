"""Downloads the embedding model into data/models/ for offline use."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from app.core.config import settings


def main() -> int:
    target_dir = settings.models_dir / settings.embedding_model.replace("/", "__")
    target_dir.mkdir(parents=True, exist_ok=True)

    from sentence_transformers import SentenceTransformer

    print(f"Downloading {settings.embedding_model} to {target_dir} …")
    model = SentenceTransformer(
        settings.embedding_model,
        device=settings.embedding_device,
        cache_folder=str(settings.models_dir),
    )
    model.save(str(target_dir))
    print(f"Done. Model files at: {target_dir}")
    print(f"Vector size = {model.get_sentence_embedding_dimension()}")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
