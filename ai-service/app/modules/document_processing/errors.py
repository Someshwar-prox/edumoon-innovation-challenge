"""Exception hierarchy for the document processing module.

Per-file failures (unsupported type, too large) are caught by the service
and converted into SkippedDocument entries instead of propagating.
"""
from __future__ import annotations


class DocumentProcessingError(Exception):
    status_code: int = 500
    code: str = "internal_error"


class UnsupportedFileType(DocumentProcessingError):
    status_code = 415
    code = "unsupported_file_type"


class FileTooLarge(DocumentProcessingError):
    status_code = 413
    code = "file_too_large"


class InvalidRequest(DocumentProcessingError):
    status_code = 400
    code = "invalid_request"


class VectorDBUnreachable(DocumentProcessingError):
    status_code = 503
    code = "vector_db_unreachable"
