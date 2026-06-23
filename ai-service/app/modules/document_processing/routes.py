"""Module 2 router — POST /v1/process-documents."""
from __future__ import annotations

import json
import logging
from pathlib import Path

from fastapi import APIRouter, File, Form, Request, UploadFile
from fastapi.responses import JSONResponse

from app.api.schemas import ErrorResponse
from app.core.config import settings
from app.core.storage import (
    SupabaseStorageError,
    download_object as supabase_download,
    is_configured as supabase_configured,
    parse_storage_hint,
)
from app.modules.document_processing.errors import (
    DocumentProcessingError,
    InvalidRequest,
)
from app.modules.document_processing.schemas import ProcessDocumentsResponse
from app.modules.document_processing.service import (
    DocumentProcessingContext,
    DocumentProcessingService,
)

log = logging.getLogger(__name__)

router = APIRouter(tags=["document-processing"])


@router.post(
    "/process-documents",
    summary="Parse, chunk, embed, and store uploaded PDF/DOCX/TXT documents.",
    description="Parses each file, chunks, embeds with BGE, and upserts into document_chunks. Per-file failures are isolated into skipped[]. See docs/API_CONTRACTS.md §2.",
    response_model=ProcessDocumentsResponse,
    responses={
        400: {"model": ErrorResponse, "description": "Invalid request (bad metadata JSON, too many files)."},
        413: {"model": ErrorResponse, "description": "File too large."},
        415: {"model": ErrorResponse, "description": "Unsupported file type."},
        503: {"model": ErrorResponse, "description": "Qdrant unreachable."},
    },
)
async def process_documents(
    request: Request,
    business_id: str = Form(..., description="UUID owned by the gateway."),
    files: list[UploadFile] = File(..., description="1-10 files. Accepts .pdf, .docx, .txt."),
    metadata: str | None = Form(None, description="Optional JSON-encoded tags."),
    replace_existing: bool = Form(False, description="Drop prior vectors for this business first."),
) -> ProcessDocumentsResponse | JSONResponse:
    parsed_metadata: dict | None = None
    if metadata:
        try:
            parsed_metadata = json.loads(metadata)
            if not isinstance(parsed_metadata, dict):
                raise InvalidRequest("metadata must be a JSON object")
        except json.JSONDecodeError as exc:
            return _error_response(InvalidRequest(f"metadata is not valid JSON: {exc}"))

    uploads_dir = Path(settings.uploads_dir)

    # If the gateway sent a storage hint, ai-service pulls the original file
    # from Supabase Storage and swaps it into `files` so the existing
    # processing pipeline doesn't need to know about storage at all.
    storage_hint = parse_storage_hint(parsed_metadata)
    if storage_hint and supabase_configured() and not files:
        try:
            body = await supabase_download(storage_hint["path"])
        except SupabaseStorageError as exc:
            log.error(
                "could not fetch stored document",
                extra={"path": storage_hint["path"], "err": str(exc)},
            )
            return JSONResponse(
                status_code=502,
                content={
                    "error": {
                        "code": "storage_unreachable",
                        "message": f"Could not fetch {storage_hint['path']} from storage",
                    }
                },
            )
        # Reconstruct an UploadFile-shaped object from the bytes.
        from fastapi import UploadFile as _UF
        import io
        reconstructed = _UF(
            filename=storage_hint["path"].rsplit("/", 1)[-1],
            file=io.BytesIO(body),
        )
        files = [reconstructed]

    ctx = DocumentProcessingContext(
        business_id=business_id,
        files=files,
        metadata=parsed_metadata,
        replace_existing=replace_existing,
        uploads_dir=uploads_dir,
        embedding_model=request.app.state.embedding_model,
        qdrant=request.app.state.qdrant,
    )

    try:
        result = await DocumentProcessingService(ctx).run()
    except DocumentProcessingError as exc:
        return _error_response(exc)
    except Exception as exc:  # noqa: BLE001
        log.exception("process_documents crashed", extra={"business_id": business_id})
        return JSONResponse(
            status_code=500,
            content={"error": {"code": "internal_error", "message": str(exc)}},
        )

    return result


def _error_response(exc: DocumentProcessingError) -> JSONResponse:
    log.warning(
        "process_documents failed: %s",
        str(exc),
        extra={"code": exc.code, "status": exc.status_code},
    )
    return JSONResponse(
        status_code=exc.status_code,
        content={"error": {"code": exc.code, "message": str(exc)}},
    )
