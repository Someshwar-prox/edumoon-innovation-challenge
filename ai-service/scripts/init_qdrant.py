"""Idempotent: creates any missing Qdrant collections + payload indexes."""
from __future__ import annotations

import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
sys.path.insert(0, str(ROOT))

from qdrant_client import QdrantClient
from qdrant_client.http import models

from app.core.config import settings
from app.core.qdrant import (
    COLLECTION_ANALYTICS,
    COLLECTION_CHAT_LOGS,
    COLLECTION_DOCUMENT_CHUNKS,
    COLLECTION_KB_MASTER,
    COLLECTION_REPORTS,
    COLLECTION_WEBSITE_PAGES,
)


def _vector_config() -> models.VectorParams:
    return models.VectorParams(
        size=settings.embedding_dim,
        distance=models.Distance.COSINE,
        on_disk=False,
    )


def _payload_indexes(collection: str) -> list[tuple[str, "models.PayloadSchemaType"]]:
    common: list[tuple[str, "models.PayloadSchemaType"]] = [
        ("business_id", models.PayloadSchemaType.KEYWORD),
        ("source_type", models.PayloadSchemaType.KEYWORD),
    ]
    extras: dict[str, list[tuple[str, "models.PayloadSchemaType"]]] = {
        COLLECTION_WEBSITE_PAGES: [("url", models.PayloadSchemaType.KEYWORD)],
        COLLECTION_DOCUMENT_CHUNKS: [
            ("document_id", models.PayloadSchemaType.KEYWORD),
            ("chunk_index", models.PayloadSchemaType.INTEGER),
        ],
        COLLECTION_REPORTS: [("report_id", models.PayloadSchemaType.KEYWORD)],
        COLLECTION_KB_MASTER: [("origin_collection", models.PayloadSchemaType.KEYWORD)],
        COLLECTION_CHAT_LOGS: [("session_id", models.PayloadSchemaType.KEYWORD)],
        COLLECTION_ANALYTICS: [("event_type", models.PayloadSchemaType.KEYWORD)],
    }
    return common + extras.get(collection, [])


COLLECTION_DEFS: dict[str, dict] = {
    COLLECTION_WEBSITE_PAGES: {
        "purpose": "Page sections crawled from a business website.",
        "vectors": _vector_config(),
    },
    COLLECTION_DOCUMENT_CHUNKS: {
        "purpose": "Chunks extracted from uploaded PDF/DOCX/TXT documents.",
        "vectors": _vector_config(),
    },
    COLLECTION_REPORTS: {
        "purpose": "AI readiness report snapshots.",
        "vectors": _vector_config(),
    },
    COLLECTION_KB_MASTER: {
        "purpose": "Unified per-business knowledge base mirroring website + documents.",
        "vectors": _vector_config(),
    },
    COLLECTION_CHAT_LOGS: {
        "purpose": "Embedded chat questions for history / topic clustering.",
        "vectors": _vector_config(),
    },
    COLLECTION_ANALYTICS: {
        "purpose": "Event descriptions for the Insights module.",
        "vectors": _vector_config(),
    },
}


def ensure_collections(client: QdrantClient) -> list[str]:
    existing = {c.name for c in client.get_collections().collections}
    created: list[str] = []
    for name, cfg in COLLECTION_DEFS.items():
        if name in existing:
            print(f"[skip] {name} already exists")
            continue
        client.create_collection(
            collection_name=name,
            vectors_config=cfg["vectors"],
            optimizers_config=models.OptimizersConfigDiff(default_segment_number=2),
            hnsw_config=models.HnswConfigDiff(m=16, ef_construct=128),
        )
        for field_name, field_type in _payload_indexes(name):
            client.create_payload_index(
                collection_name=name,
                field_name=field_name,
                field_schema=field_type,
                wait=True,
            )
        print(f"[create] {name} — {cfg['purpose']}")
        created.append(name)
    return created


def main() -> int:
    print(f"Connecting to Qdrant at {settings.qdrant_url} …")
    client = QdrantClient(
        host=settings.qdrant_host,
        port=settings.qdrant_port,
        api_key=settings.qdrant_api_key or None,
        prefer_grpc=settings.qdrant_prefer_grpc,
        timeout=30,
    )

    try:
        client.get_collections()
    except Exception as exc:  # pragma: no cover - manual script
        print(f"[error] Could not reach Qdrant at {settings.qdrant_url}: {exc}")
        print("        Start a local Qdrant server first.")
        return 1

    created = ensure_collections(client)
    if created:
        print(f"\nCreated {len(created)} collection(s).")
    else:
        print("\nAll collections already present — nothing to do.")
    return 0


if __name__ == "__main__":  # pragma: no cover
    raise SystemExit(main())
