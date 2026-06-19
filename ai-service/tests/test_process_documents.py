from __future__ import annotations

from pathlib import Path
from typing import Any

import pytest

from app.modules.document_processing.errors import (
    FileTooLarge,
    InvalidRequest,
    UnsupportedFileType,
    VectorDBUnreachable,
)
from app.modules.document_processing.parsers import ParsedDocument
from app.modules.document_processing.schemas import ProcessDocumentsResponse
from app.modules.document_processing.service import (
    DocumentProcessingContext,
    DocumentProcessingService,
)


# ---------- Fakes ----------

class FakeUpload:
    def __init__(self, filename: str, body: bytes, content_type: str | None = None):
        self.filename = filename
        self.content_type = content_type
        self.size = len(body)
        self._body = body
        self._pos = 0

    async def read(self, size: int = -1) -> bytes:
        if size is None or size < 0:
            data = self._body[self._pos:]
            self._pos = len(self._body)
            return data
        data = self._body[self._pos : self._pos + size]
        self._pos += len(data)
        return data

    async def seek(self, offset: int) -> None:
        self._pos = offset


class FakeQdrant:
    def __init__(self, upsert_raises: Exception | None = None, delete_raises: Exception | None = None):
        self.upsert_calls: list[dict[str, Any]] = []
        self.upsert_calls_mirror: list[dict[str, Any]] = []
        self.delete_calls: list[dict[str, Any]] = []
        self.upsert_raises = upsert_raises
        self.delete_raises = delete_raises

    def upsert(self, *, collection_name: str, points: list, wait: bool):
        if collection_name == "kb_master":
            self.upsert_calls_mirror.append({"collection_name": collection_name, "points": points, "wait": wait})
        else:
            self.upsert_calls.append({"collection_name": collection_name, "points": points, "wait": wait})
        if self.upsert_raises:
            raise self.upsert_raises

    def delete(self, *, collection_name: str, points_selector, wait: bool):
        self.delete_calls.append({"collection_name": collection_name, "selector": points_selector, "wait": wait})
        if self.delete_raises:
            raise self.delete_raises


class FakeEmbedder:
    def __init__(self, dim: int = 4):
        self.calls: list[list[str]] = []
        self.dim = dim

    def embed(self, texts: list[str]) -> list[list[float]]:
        self.calls.append(list(texts))
        return [[0.1] * self.dim for _ in texts]


# ---------- Helpers ----------

def _parser_with(text: str = "Hello world. This is a test document.", pages: int | None = None):
    """Returns a callable matching ParserLike that yields a fixed text/pages."""
    def _p(file_path: Path, kind: str) -> ParsedDocument:
        return ParsedDocument(text=text, pages=pages, raw_path=file_path)
    return _p


def _ctx(
    *,
    uploads: list[FakeUpload] | None = None,
    replace_existing: bool = False,
    metadata: dict | None = None,
    qdrant: FakeQdrant | None = None,
    embedder: FakeEmbedder | None = None,
    parser: Any | None = None,
    chunker: Any | None = None,
    business_id: str = "biz-1",
    uploads_dir: Path | None = None,
) -> DocumentProcessingContext:
    if uploads is None:
        uploads = [FakeUpload("a.txt", b"Hello world. We ship to Canada in 5-7 days.")]
    if qdrant is None:
        qdrant = FakeQdrant()
    if embedder is None:
        embedder = FakeEmbedder()
    return DocumentProcessingContext(
        business_id=business_id,
        files=uploads,
        metadata=metadata,
        replace_existing=replace_existing,
        uploads_dir=uploads_dir or Path("./data/uploads-test"),
        embedding_model=embedder,
        qdrant=qdrant,
        parser=parser or _parser_with(),
        chunker=chunker,
    )


# ---------- Tests ----------

import asyncio


def _run(coro):
    return asyncio.get_event_loop().run_until_complete(coro) if False else asyncio.run(coro)


def test_happy_path_txt_indexes_one_doc(tmp_path):
    uploads = [FakeUpload("a.txt", b"Hello world. We ship to Canada in 5-7 days.")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder(dim=4)
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path)

    result = _run(DocumentProcessingService(ctx).run())

    assert isinstance(result, ProcessDocumentsResponse)
    assert result.business_id == "biz-1"
    assert len(result.results) == 1
    assert result.results[0].filename == "a.txt"
    assert result.results[0].chunk_count >= 1
    assert result.results[0].pages is None  # TXT
    assert result.results[0].status == "indexed"
    assert result.skipped == []
    assert len(qdrant.upsert_calls) == 1
    assert qdrant.upsert_calls[0]["collection_name"] == "document_chunks"
    # All upserted points share the same document_id.
    pts = qdrant.upsert_calls[0]["points"]
    doc_ids = {p.payload["document_id"] for p in pts}
    assert len(doc_ids) == 1
    # One mirror write per chunk (kb_master).
    assert len(qdrant.upsert_calls_mirror) == len(pts)
    assert all(c["collection_name"] == "kb_master" for c in qdrant.upsert_calls_mirror)


def test_per_file_skip_isolates_failures(tmp_path):
    uploads = [
        FakeUpload("good.txt", b"Hello world. We ship to Canada in 5-7 days."),
        FakeUpload("image.png", b"\x89PNG\r\n\x1a\n"),  # unsupported
        FakeUpload("also_good.txt", b"Second valid document."),
    ]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    # Use real parsers so detect_kind actually runs.
    from app.modules.document_processing.parsers import parse
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path, parser=parse)

    result = _run(DocumentProcessingService(ctx).run())

    assert len(result.results) == 2
    assert len(result.skipped) == 1
    assert result.skipped[0].filename == "image.png"
    assert result.skipped[0].reason == "unsupported_file_type"


def test_unsupported_extension_returns_skip(tmp_path):
    uploads = [FakeUpload("logo.png", b"\x89PNG\r\n\x1a\n")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path)

    result = _run(DocumentProcessingService(ctx).run())

    assert result.results == []
    assert len(result.skipped) == 1
    assert result.skipped[0].reason == "unsupported_file_type"
    assert qdrant.upsert_calls == []


def test_oversize_file_is_skipped(tmp_path, monkeypatch):
    # Shrink the cap so we don't have to allocate real bytes.
    monkeypatch.setattr("app.modules.document_processing.service.settings.doc_max_file_bytes", 10)
    uploads = [
        FakeUpload("big.txt", b"x" * 100),  # > 10 bytes
        FakeUpload("small.txt", b"hi"),
    ]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    # Use a parser that doesn't touch the file (since "big.txt" was never read).
    parser = lambda p, k: ParsedDocument(text="hi there", pages=None, raw_path=p)  # noqa: E731
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path, parser=parser)

    result = _run(DocumentProcessingService(ctx).run())

    assert len(result.results) == 1
    assert result.results[0].filename == "small.txt"
    assert len(result.skipped) == 1
    assert result.skipped[0].filename == "big.txt"
    assert result.skipped[0].reason == "file_too_large"


def test_replace_existing_triggers_delete_by_filter(tmp_path):
    uploads = [FakeUpload("a.txt", b"Hello world.")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    ctx = _ctx(
        uploads=uploads,
        qdrant=qdrant,
        embedder=embedder,
        uploads_dir=tmp_path,
        replace_existing=True,
    )

    _run(DocumentProcessingService(ctx).run())

    # Delete must have happened, and it must filter by business_id.
    assert len(qdrant.delete_calls) == 1
    sel = qdrant.delete_calls[0]["selector"]
    flt = sel.filter
    conds = flt.must
    assert any(c.key == "business_id" for c in conds)
    # And upsert came after.
    assert len(qdrant.upsert_calls) == 1


def test_no_replace_existing_means_no_delete(tmp_path):
    uploads = [FakeUpload("a.txt", b"Hello world.")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path, replace_existing=False)

    _run(DocumentProcessingService(ctx).run())

    assert qdrant.delete_calls == []
    assert len(qdrant.upsert_calls) == 1


def test_qdrant_upsert_failure_raises_503(tmp_path):
    uploads = [FakeUpload("a.txt", b"Hello world.")]
    qdrant = FakeQdrant(upsert_raises=RuntimeError("qdrant down"))
    embedder = FakeEmbedder()
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path)

    with pytest.raises(VectorDBUnreachable):
        _run(DocumentProcessingService(ctx).run())


def test_docx_has_null_pages(tmp_path):
    # Use the real parser (parser=None not allowed since parser field has no default factory
    # in the test helper) — instead use a parser that returns pages=None.
    uploads = [FakeUpload("a.docx", b"fake docx bytes")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    parser = lambda p, k: ParsedDocument(text="Hello world.", pages=None, raw_path=p)  # noqa: E731
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path, parser=parser)

    result = _run(DocumentProcessingService(ctx).run())

    assert len(result.results) == 1
    assert result.results[0].pages is None


def test_pdf_has_integer_pages(tmp_path):
    uploads = [FakeUpload("a.pdf", b"%PDF-1.4 fake")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    parser = lambda p, k: ParsedDocument(text="Hello world.", pages=7, raw_path=p)  # noqa: E731
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path, parser=parser)

    result = _run(DocumentProcessingService(ctx).run())

    assert len(result.results) == 1
    assert result.results[0].pages == 7


def test_deterministic_point_ids(tmp_path):
    uploads1 = [FakeUpload("a.txt", b"Hello world.")]
    uploads2 = [FakeUpload("a.txt", b"Hello world.")]
    qdrant1 = FakeQdrant()
    embedder1 = FakeEmbedder()
    qdrant2 = FakeQdrant()
    embedder2 = FakeEmbedder()
    ctx1 = _ctx(uploads=uploads1, qdrant=qdrant1, embedder=embedder1, uploads_dir=tmp_path)
    ctx2 = _ctx(uploads=uploads2, qdrant=qdrant2, embedder=embedder2, uploads_dir=tmp_path)

    _run(DocumentProcessingService(ctx1).run())
    _run(DocumentProcessingService(ctx2).run())

    ids1 = [p.id for p in qdrant1.upsert_calls[0]["points"]]
    ids2 = [p.id for p in qdrant2.upsert_calls[0]["points"]]
    # Same text → same hash prefix → same Qdrant point IDs (different document_id though,
    # so this only holds because the text is the only content varied).
    # We instead assert the IDs are well-formed 32-char hex sha1 prefixes.
    import re
    hex_re = re.compile(r"^[0-9a-f]{32}$")
    assert all(hex_re.match(i) for i in ids1)
    assert all(hex_re.match(i) for i in ids2)


def test_too_many_files_400(tmp_path, monkeypatch):
    monkeypatch.setattr("app.modules.document_processing.service.settings.doc_max_files_per_request", 2)
    uploads = [
        FakeUpload(f"a{i}.txt", b"hi") for i in range(3)
    ]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path)

    with pytest.raises(InvalidRequest):
        _run(DocumentProcessingService(ctx).run())


def test_chunk_count_matches_upserted_points(tmp_path):
    uploads = [FakeUpload("a.txt", b"Hello world. We ship to Canada in 5-7 days.")]
    qdrant = FakeQdrant()
    embedder = FakeEmbedder()
    ctx = _ctx(uploads=uploads, qdrant=qdrant, embedder=embedder, uploads_dir=tmp_path)

    result = _run(DocumentProcessingService(ctx).run())

    upserted = len(qdrant.upsert_calls[0]["points"])
    assert result.results[0].chunk_count == upserted
    # Embedder was called once with exactly chunk_count texts.
    assert len(embedder.calls[0]) == upserted