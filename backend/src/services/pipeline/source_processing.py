"""Durable source-processing lifecycle ledger.

The pipeline has several source-specific entrypoints today. This helper gives
them one shared, RAG-side status contract without moving high-churn writes into
the PM APP database.
"""

from __future__ import annotations

import logging
from dataclasses import dataclass, field
from datetime import datetime, timezone
from typing import Any, Dict, Optional

from ..supabase_helpers import get_rag_write_client

logger = logging.getLogger(__name__)


# Terminal status for documents the pipeline *deliberately* does not embed
# (interview-title meetings, sub-minimum low-content docs). This is NOT a
# failure: the source-sync health map and /pipeline-health must render these as
# a clean, terminal outcome, not a critical error. Kept distinct from
# `failed_permanent` (which means "we tried and could not, do not retry").
INTENTIONALLY_EXCLUDED_STATUS = "intentionally_excluded"

FINAL_STATUSES = {
    "complete",
    "failed_permanent",
    "skipped_unchanged",
    INTENTIONALLY_EXCLUDED_STATUS,
}
PROJECT_ASSIGNED_STATUSES = {
    "project_assigned",
    "text_extracted",
    "indexed_for_rag",
    "signals_extracted",
    "project_intelligence_updated",
    "actions_routed",
    "complete",
}


@dataclass(frozen=True)
class SourceProcessingContext:
    source_system: str
    source_item_id: str
    content_hash: str = ""
    source_document_id: Optional[str] = None
    project_id: Optional[int] = None
    source_title: Optional[str] = None
    source_url: Optional[str] = None
    occurred_at: Optional[str] = None
    metadata: Dict[str, Any] = field(default_factory=dict)


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _clean_metadata(metadata: Optional[Dict[str, Any]]) -> Dict[str, Any]:
    if not isinstance(metadata, dict):
        return {}
    return {str(key): value for key, value in metadata.items() if value is not None}


def record_source_processing_status(
    context: SourceProcessingContext,
    *,
    status: str,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Dict[str, Any]] = None,
) -> None:
    """Upsert one source lifecycle status row.

    This is deliberately best-effort: source ingestion should not fail solely
    because the observability ledger is temporarily unavailable. The error is
    logged with enough context to make the failure visible in backend logs.
    """
    if not context.source_system or not context.source_item_id:
        logger.warning(
            "[SourceProcessing] missing source identity for status=%s source_system=%r source_item_id=%r",
            status,
            context.source_system,
            context.source_item_id,
        )
        return

    now = _utc_now_iso()
    combined_metadata = {**_clean_metadata(context.metadata), **_clean_metadata(metadata)}
    payload: Dict[str, Any] = {
        "source_system": context.source_system,
        "source_item_id": str(context.source_item_id),
        "content_hash": context.content_hash or "",
        "source_document_id": context.source_document_id,
        "project_id": context.project_id,
        "status": status,
        "source_title": context.source_title,
        "source_url": context.source_url,
        "occurred_at": context.occurred_at,
        "updated_at": now,
        "completed_at": now if status in FINAL_STATUSES else None,
        "error_code": error_code,
        "error_message": error_message[:2000] if error_message else None,
        "metadata": combined_metadata,
    }
    if status == "failed_retryable":
        payload["retry_count"] = 1

    try:
        get_rag_write_client().table("source_processing_jobs").upsert(
            payload,
            on_conflict="source_system,source_item_id,content_hash",
        ).execute()
    except Exception as exc:  # noqa: BLE001 - do not take down source sync for ledger writes
        logger.warning(
            "[SourceProcessing] could not record status=%s for %s/%s: %s",
            status,
            context.source_system,
            context.source_item_id,
            exc,
        )


def status_for_project_assignment(project_id: Optional[int]) -> str:
    return "project_assigned" if project_id else "project_assignment_review"
