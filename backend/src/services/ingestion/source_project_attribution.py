"""Shared source evidence assembly for project attribution."""

from __future__ import annotations

import logging
from typing import Any, Dict, List

from ..supabase_helpers import get_rag_read_client

logger = logging.getLogger(__name__)

DEFAULT_MAX_ATTRIBUTION_CHARS = 12000


def participants_for_document(document: Dict[str, Any]) -> List[str]:
    participants: List[str] = []
    raw_participants = document.get("participants")
    if raw_participants:
        participants.append(str(raw_participants))

    raw_array = document.get("participants_array") or []
    if isinstance(raw_array, list):
        participants.extend(str(item) for item in raw_array if item)

    for field in ("host_email", "organizer_email"):
        value = document.get(field)
        if value:
            participants.append(str(value))

    return participants


def _append_unique(parts: List[str], value: Any) -> None:
    text = str(value or "").strip()
    if text and text not in parts:
        parts.append(text)


def load_source_chunk_text(
    source_document_id: str,
    *,
    rag_client: Any | None = None,
    max_chars: int = DEFAULT_MAX_ATTRIBUTION_CHARS,
) -> str:
    """Load embedded chunk text for a source document when metadata text is thin."""
    if not source_document_id:
        return ""

    client = rag_client or get_rag_read_client()
    try:
        rows = (
            client.table("document_chunks")
            .select("text,chunk_index")
            .eq("document_id", source_document_id)
            .order("chunk_index")
            .limit(50)
            .execute()
            .data
            or []
        )
    except Exception as exc:
        logger.warning(
            "[ProjectAttribution] Could not load chunk text for %s: %s",
            source_document_id,
            exc,
        )
        return ""

    parts: List[str] = []
    total = 0
    for row in rows:
        text = str(row.get("text") or "").strip()
        if not text:
            continue
        remaining = max_chars - total
        if remaining <= 0:
            break
        clipped = text[:remaining]
        parts.append(clipped)
        total += len(clipped)
    return "\n".join(parts)


def build_project_attribution_evidence(
    document: Dict[str, Any],
    *,
    rag_client: Any | None = None,
    max_chars: int = DEFAULT_MAX_ATTRIBUTION_CHARS,
) -> Dict[str, Any]:
    """Normalize source-specific fields into one ProjectAssigner input."""
    parts: List[str] = []
    for field in ("content", "raw_text"):
        _append_unique(parts, document.get(field))

    chunk_text = ""
    primary_text = "\n".join(parts).strip()
    if not primary_text:
        chunk_text = load_source_chunk_text(
            str(document.get("id") or ""),
            rag_client=rag_client,
            max_chars=max_chars,
        )
        _append_unique(parts, chunk_text)

    for field in ("summary", "overview"):
        _append_unique(parts, document.get(field))

    content = "\n".join(parts).strip()[:max_chars]
    summary_text = " ".join(str(document.get(field) or "").strip() for field in ("summary", "overview")).strip()
    return {
        "title": str(document.get("title") or ""),
        "participants": participants_for_document(document),
        "content": content,
        "content_source": (
            "document_metadata"
            if primary_text
            else "document_chunks"
            if chunk_text
            else "summary_metadata"
            if summary_text
            else "empty"
        ),
    }
