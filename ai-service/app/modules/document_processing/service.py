"""Service layer for the document processing module.

Stateless, testable. Per-file failures become SkippedDocument entries;
only batch-level errors propagate as DocumentProcessingError.
"""
from __future__ import annotations

import hashlib
import logging
import time
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from functools import lru_cache
from pathlib import Path
from typing import Any, Protocol

from qdrant_client.http import models as qmodels

from app.core.config import settings
from app.core.kb_mirror import mirror_to_kb_master
from app.core.qdrant import COLLECTION_DOCUMENT_CHUNKS
from app.modules.document_processing.chunker import recursive_chunk
from app.modules.document_processing.errors import (
    DocumentProcessingError,
    FileTooLarge,
    InvalidRequest,
    UnsupportedFileType,
    VectorDBUnreachable,
)
from app.modules.document_processing.parsers import ParsedDocument, detect_kind, parse
from app.modules.document_processing.schemas import (
    IndexedDocument,
    ProcessDocumentsResponse,
    SkippedDocument,
)

log = logging.getLogger(__name__)


class UploadFileLike(Protocol):
    filename: str
    content_type: str | None
    size: int | None

    async def read(self, size: int = -1) -> bytes: ...
    async def seek(self, offset: int) -> None: ...


class EmbeddingLike(Protocol):
    def embed(self, texts: list[str]) -> list[list[float]]: ...


class QdrantLike(Protocol):
    def upsert(self, *, collection_name: str, points: list, wait: bool) -> Any: ...
    def delete(self, *, collection_name: str, points_selector: Any, wait: bool) -> Any: ...


class ParserLike(Protocol):
    def __call__(self, file_path: Path, kind: str) -> ParsedDocument: ...


class ChunkerLike(Protocol):
    def __call__(self, text: str, *, size: int, overlap: int) -> list[str]: ...


@dataclass
class DocumentProcessingContext:
    business_id: str
    files: list[UploadFileLike]
    metadata: dict | None
    replace_existing: bool
    uploads_dir: Path
    embedding_model: EmbeddingLike | None
    qdrant: QdrantLike | None
    parser: ParserLike | None = None
    chunker: ChunkerLike | None = None


@lru_cache(maxsize=1)
def _token_encoder():
    import tiktoken  # noqa: WPS433
    return tiktoken.get_encoding("cl100k_base")


def _count_tokens(text: str) -> int:
    return len(_token_encoder().encode(text))


class DocumentProcessingService:
    def __init__(self, ctx: DocumentProcessingContext) -> None:
        self.ctx = ctx
        self.job_id = str(uuid.uuid4())
        self._t0 = time.perf_counter()

    async def run(self) -> ProcessDocumentsResponse:
        log_ctx = {
            "job_id": self.job_id,
            "business_id": self.ctx.business_id,
            "n_files": len(self.ctx.files),
            "stage": "start",
        }
        log.info("processing started", extra=log_ctx)

        if len(self.ctx.files) > settings.doc_max_files_per_request:
            raise InvalidRequest(
                f"too many files: {len(self.ctx.files)} > {settings.doc_max_files_per_request}"
            )

        results: list[IndexedDocument] = []
        skipped: list[SkippedDocument] = []

        if self.ctx.replace_existing and self.ctx.qdrant is not None:
            self._delete_existing(log_ctx)

        for upload in self.ctx.files:
            try:
                indexed = await self._process_one(upload, log_ctx)
                if indexed is not None:
                    results.append(indexed)
            except UnsupportedFileType as exc:
                skipped.append(SkippedDocument(filename=upload.filename or "", reason=exc.code))
                log.warning("skip: unsupported", extra={**log_ctx, "file_name": upload.filename, "reason": str(exc)})
            except FileTooLarge as exc:
                skipped.append(SkippedDocument(filename=upload.filename or "", reason=exc.code))
                log.warning("skip: too large", extra={**log_ctx, "file_name": upload.filename, "reason": str(exc)})
            except DocumentProcessingError:
                raise
            except Exception:
                log.exception(
                    "skip: parse_failed",
                    extra={**log_ctx, "file_name": upload.filename, "stage": "parse"},
                )
                skipped.append(SkippedDocument(filename=upload.filename or "", reason="parse_failed"))

        response = ProcessDocumentsResponse(
            business_id=self.ctx.business_id,
            results=results,
            skipped=skipped,
            created_at=datetime.now(timezone.utc),
        )
        log.info(
            "processing done",
            extra={
                **log_ctx,
                "stage": "done",
                "indexed": len(results),
                "skipped": len(skipped),
                "duration_ms": int((time.perf_counter() - self._t0) * 1000),
            },
        )
        return response

    async def _process_one(
        self,
        upload: UploadFileLike,
        log_ctx: dict,
    ) -> IndexedDocument | None:
        filename = upload.filename or "unnamed"
        t = time.perf_counter()

        body = await upload.read()
        size_bytes = len(body)

        if size_bytes > settings.doc_max_file_bytes:
            raise FileTooLarge(f"{filename}: {size_bytes} bytes > {settings.doc_max_file_bytes}")

        log.info(
            "file saved",
            extra={**log_ctx, "stage": "save", "file_name": filename, "size_bytes": size_bytes,
                   "duration_ms": int((time.perf_counter() - t) * 1000)},
        )

        safe_name = Path(filename).name or "upload.bin"
        target_dir = self.ctx.uploads_dir / self.ctx.business_id
        target_dir.mkdir(parents=True, exist_ok=True)
        on_disk = target_dir / f"{uuid.uuid4().hex}_{safe_name}"
        on_disk.write_bytes(body)

        try:
            kind = detect_kind(filename, upload.content_type)
            parser = self.ctx.parser or parse
            t = time.perf_counter()
            parsed = parser(on_disk, kind)
            log.info(
                "parsed",
                extra={**log_ctx, "stage": "parse", "file_name": filename, "kind": kind,
                       "pages": parsed.pages, "chars": len(parsed.text),
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )

            if not parsed.text:
                log.warning("skip: empty", extra={**log_ctx, "file_name": filename, "stage": "parse"})
                return None

            chunker = self.ctx.chunker or recursive_chunk
            t = time.perf_counter()
            chunks = chunker(parsed.text, size=settings.chunk_size, overlap=settings.chunk_overlap)
            log.info(
                "chunked",
                extra={**log_ctx, "stage": "chunk", "file_name": filename,
                       "chunks": len(chunks),
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )

            if not chunks:
                log.warning("skip: no_chunks", extra={**log_ctx, "file_name": filename, "stage": "chunk"})
                return None

            token_estimate = sum(_count_tokens(c) for c in chunks)
            document_id = str(uuid.uuid4())

            if self.ctx.embedding_model is None or self.ctx.qdrant is None:
                return IndexedDocument(
                    document_id=document_id,
                    filename=filename,
                    size_bytes=size_bytes,
                    pages=parsed.pages,
                    chunk_count=len(chunks),
                    token_estimate=token_estimate,
                )

            t = time.perf_counter()
            vectors = self.ctx.embedding_model.embed(chunks)
            log.info(
                "embedded",
                extra={**log_ctx, "stage": "embed", "file_name": filename,
                       "chunks": len(vectors),
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )

            t = time.perf_counter()
            self._upsert_chunks(
                document_id=document_id,
                filename=filename,
                chunks=chunks,
                vectors=vectors,
                log_ctx=log_ctx,
            )
            log.info(
                "upserted",
                extra={**log_ctx, "stage": "upsert", "file_name": filename,
                       "chunks": len(vectors),
                       "duration_ms": int((time.perf_counter() - t) * 1000)},
            )

            return IndexedDocument(
                document_id=document_id,
                filename=filename,
                size_bytes=size_bytes,
                pages=parsed.pages,
                chunk_count=len(chunks),
                token_estimate=token_estimate,
            )
        finally:
            try:
                on_disk.unlink(missing_ok=True)
            except OSError:
                pass

    def _upsert_chunks(
        self,
        *,
        document_id: str,
        filename: str,
        chunks: list[str],
        vectors: list[list[float]],
        log_ctx: dict,
    ) -> None:
        assert self.ctx.qdrant is not None

        points = []
        for chunk_idx, (chunk_text, vec) in enumerate(zip(chunks, vectors)):
            sid = hashlib.sha1(
                f"{self.ctx.business_id}|{document_id}|{chunk_idx}|{chunk_text[:80]}".encode()
            ).hexdigest()[:32]
            points.append(qmodels.PointStruct(
                id=sid,
                vector=vec,
                payload={
                    "business_id": self.ctx.business_id,
                    "source_type": "document",
                    "document_id": document_id,
                    "chunk_index": chunk_idx,
                    "filename": filename,
                    "text": chunk_text[:2000],
                    "metadata": self.ctx.metadata or {},
                },
            ))

        try:
            self.ctx.qdrant.upsert(
                collection_name=COLLECTION_DOCUMENT_CHUNKS,
                points=points,
                wait=True,
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorDBUnreachable(f"qdrant upsert failed: {exc}") from exc

        for chunk_idx, (chunk_text, vec) in enumerate(zip(chunks, vectors)):
            mirror_to_kb_master(
                self.ctx.qdrant,
                business_id=self.ctx.business_id,
                source_type="document",
                source_id=document_id,
                origin_collection=COLLECTION_DOCUMENT_CHUNKS,
                vector=vec,
                extra_payload={
                    "document_id": document_id,
                    "filename": filename,
                    "text": chunk_text[:2000],
                    "metadata": self.ctx.metadata or {},
                },
                chunk_index=chunk_idx,
            )

    def _delete_existing(self, log_ctx: dict) -> None:
        assert self.ctx.qdrant is not None
        flt = qmodels.Filter(must=[
            qmodels.FieldCondition(
                key="business_id",
                match=qmodels.MatchValue(value=self.ctx.business_id),
            )
        ])
        try:
            self.ctx.qdrant.delete(
                collection_name=COLLECTION_DOCUMENT_CHUNKS,
                points_selector=qmodels.FilterSelector(filter=flt),
                wait=True,
            )
            log.info(
                "deleted existing",
                extra={**log_ctx, "stage": "delete", "collection": COLLECTION_DOCUMENT_CHUNKS},
            )
        except Exception as exc:  # noqa: BLE001
            raise VectorDBUnreachable(f"qdrant delete failed: {exc}") from exc
