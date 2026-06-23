"""Supabase Storage helper for ai-service.

ai-service is the *consumer* of files the gateway uploaded; it doesn't write
to the bucket itself. The multipart `metadata` field on /v1/process-documents
carries the storage path, and this module lets ai-service fetch the original
bytes when it needs to re-extract text from a stored document.
"""
from __future__ import annotations

import logging
from typing import Any

import httpx

from app.core.config import settings

log = logging.getLogger(__name__)


class SupabaseStorageError(RuntimeError):
    pass


def _auth_headers() -> dict[str, str]:
    if not settings.supabase_url or not settings.supabase_service_role_key:
        raise SupabaseStorageError(
            "SUPABASE_URL / SUPABASE_SERVICE_ROLE_KEY are not set in ai-service/.env",
        )
    return {
        "Authorization": f"Bearer {settings.supabase_service_role_key}",
        "apikey": settings.supabase_service_role_key,
    }


def is_configured() -> bool:
    return bool(settings.supabase_url and settings.supabase_service_role_key)


async def download_object(path: str) -> bytes:
    """Fetch the bytes of an object in the configured bucket.

    Path is the object key, e.g. "<business_id>/<document_id>.pdf".
    Returns the raw file bytes. Raises SupabaseStorageError on any failure.
    """
    if not is_configured():
        raise SupabaseStorageError("Supabase Storage not configured")
    url = f"{settings.supabase_url.rstrip('/')}/storage/v1/object/{settings.supabase_bucket}/{path}"
    async with httpx.AsyncClient(timeout=60.0) as client:
        resp = await client.get(url, headers=_auth_headers())
        if resp.status_code != 200:
            log.error(
                "Supabase download failed",
                extra={"status": resp.status_code, "path": path, "body": resp.text[:200]},
            )
            raise SupabaseStorageError(
                f"Supabase download failed for {path}: HTTP {resp.status_code}",
            )
        return resp.content


def parse_storage_hint(metadata: dict[str, Any] | None) -> dict[str, str] | None:
    """Pull the storage hint out of the multipart `metadata` field.

    The gateway sends metadata like:
        {"storage": {"provider": "supabase", "bucket": "cluster", "path": "..."}}
    Returns the storage hint dict, or None if not present.
    """
    if not metadata:
        return None
    storage = metadata.get("storage")
    if not isinstance(storage, dict):
        return None
    provider = storage.get("provider")
    bucket = storage.get("bucket")
    path = storage.get("path")
    if not (provider and bucket and path):
        return None
    return {"provider": provider, "bucket": bucket, "path": path}
