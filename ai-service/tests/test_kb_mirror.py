from __future__ import annotations

from typing import Any

from app.core.kb_mirror import mirror_to_kb_master


class FakeQdrant:
    def __init__(self):
        self.calls: list[dict[str, Any]] = []

    def upsert(self, *, collection_name, points, wait):
        self.calls.append({"collection_name": collection_name, "points": points, "wait": wait})


def _vector():
    return [0.1, 0.2, 0.3, 0.4]


def test_mirror_writes_to_kb_master_with_correct_payload():
    qdrant = FakeQdrant()
    mirror_to_kb_master(
        qdrant,
        business_id="biz-1",
        source_type="website",
        source_id="https://example.com/about",
        origin_collection="website_pages",
        vector=_vector(),
        extra_payload={"url": "https://example.com/about", "section_title": "About", "text": "About text"},
    )
    assert len(qdrant.calls) == 1
    call = qdrant.calls[0]
    assert call["collection_name"] == "kb_master"
    assert call["wait"] is True
    pt = call["points"][0]
    assert pt.vector == _vector()
    assert pt.payload["business_id"] == "biz-1"
    assert pt.payload["source_type"] == "website"
    assert pt.payload["source_id"] == "https://example.com/about"
    assert pt.payload["origin_collection"] == "website_pages"
    assert pt.payload["url"] == "https://example.com/about"
    assert pt.payload["section_title"] == "About"
    assert pt.payload["text"] == "About text"


def test_mirror_id_is_deterministic():
    qdrant1 = FakeQdrant()
    qdrant2 = FakeQdrant()
    kwargs = dict(
        business_id="biz-1",
        source_type="document",
        source_id="doc-42",
        origin_collection="document_chunks",
        vector=_vector(),
        extra_payload={"document_id": "doc-42", "filename": "FAQ.pdf", "text": "x"},
        chunk_index=3,
    )
    mirror_to_kb_master(qdrant1, **kwargs)
    mirror_to_kb_master(qdrant2, **kwargs)
    id1 = qdrant1.calls[0]["points"][0].id
    id2 = qdrant2.calls[0]["points"][0].id
    assert id1 == id2
    import re
    assert re.match(r"^[0-9a-f]{32}$", id1)


def test_mirror_different_chunk_index_yields_different_id():
    qdrant = FakeQdrant()
    base = dict(
        business_id="biz-1",
        source_type="document",
        source_id="doc-1",
        origin_collection="document_chunks",
        vector=_vector(),
        extra_payload={"document_id": "doc-1", "filename": "FAQ.pdf", "text": "x"},
    )
    mirror_to_kb_master(qdrant, chunk_index=0, **{k: v for k, v in base.items() if k != "chunk_index"})
    mirror_to_kb_master(qdrant, chunk_index=1, **{k: v for k, v in base.items() if k != "chunk_index"})
    assert qdrant.calls[0]["points"][0].id != qdrant.calls[1]["points"][0].id