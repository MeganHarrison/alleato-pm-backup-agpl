"""Incremental project attribution backfill for ingested communications."""

from __future__ import annotations

import os
from datetime import datetime
from typing import Any, Dict, Iterable, List

from supabase import Client

from ..supabase_helpers import get_rag_write_client
from .project_assignment import ProjectAssigner
from .source_project_attribution import (
    build_project_attribution_evidence,
    participants_for_document,
)

SOURCE_FILTERS = {
    "microsoft_graph": {"teams_message", "email", "document"},
    "fireflies": None,
}
BACKFILL_TAG = "project_backfill:incremental_assignment_v1"
REVIEW_REQUIRED_METHOD = "review_required:communication_project_backfill"


def _append_tag(existing: str | None, tag: str) -> str:
    tags = [item.strip() for item in (existing or "").split(",") if item.strip()]
    if tag not in tags:
        tags.append(tag)
    return ",".join(tags)


def _is_target_document(document: Dict[str, Any]) -> bool:
    source = document.get("source")
    allowed_categories = SOURCE_FILTERS.get(source)
    if allowed_categories is None:
        return source in SOURCE_FILTERS
    return document.get("category") in allowed_categories


def _iter_unassigned_documents(
    client: Client,
    limit: int,
    since: datetime | None = None,
    source_filter: str | None = None,
    categories: List[str] | None = None,
) -> Iterable[Dict[str, Any]]:
    sources = [source_filter] if source_filter else list(SOURCE_FILTERS.keys())
    query = (
        client.table("document_metadata")
        .select(
            "id,title,source,category,content,summary,overview,participants,participants_array,host_email,organizer_email,tags,project_id,created_at",
        )
        .is_("project_id", "null")
        .in_("source", sources)
        .order("created_at", desc=True)
        .limit(limit)
    )
    if since is not None:
        query = query.gte("created_at", since.isoformat())
    if categories:
        query = query.in_("category", categories)
    response = query.execute()

    for document in response.data or []:
        if _is_target_document(document):
            yield document


def _matched_fields_for_evidence(attribution_evidence: Dict[str, Any]) -> List[str]:
    content_source = attribution_evidence.get("content_source")
    fields = ["document_metadata.title"]
    if content_source == "document_chunks":
        fields.append("document_chunks.text")
    elif content_source in {"document_metadata", "summary_metadata"}:
        fields.append("document_metadata.content")
    return fields


def _write_pending_review_candidate(
    document: Dict[str, Any],
    *,
    method: str,
    confidence: float,
    attribution_evidence: Dict[str, Any],
) -> None:
    """Stage unresolved source attribution for review instead of leaving a silent gap."""
    document_id = document.get("id")
    if not document_id:
        return

    bounded_confidence = max(0.0, min(1.0, float(confidence or 0.0)))
    rag_client = get_rag_write_client()
    rag_client.table("document_attribution_candidates").delete().eq(
        "source_document_id", str(document_id)
    ).eq("attribution_method", REVIEW_REQUIRED_METHOD).execute()
    rag_client.table("document_attribution_candidates").insert(
        {
            "source_document_id": str(document_id),
            "candidate_project_id": None,
            "candidate_project_name": None,
            "confidence": bounded_confidence,
            "attribution_method": REVIEW_REQUIRED_METHOD,
            "evidence_terms": [method] if method else [],
            "matched_fields": _matched_fields_for_evidence(attribution_evidence),
            "reasoning": (
                "Shared communication project backfill could not infer a project "
                "with enough confidence; explicit attribution review is required."
            ),
            "status": "pending_review",
            "evidence": {
                "source": document.get("source"),
                "category": document.get("category"),
                "title": attribution_evidence.get("title"),
                "content_source": attribution_evidence.get("content_source"),
                "assignment_method": method,
            },
        }
    ).execute()


def _sync_project_assignment_to_rag(document_id: str, project_id: int) -> None:
    """Keep RAG metadata and chunks aligned with app-side project assignment."""
    rag_client = get_rag_write_client()
    rag_client.table("rag_document_metadata").update(
        {"project_id": int(project_id)}
    ).eq("id", str(document_id)).execute()
    chunk_rows = (
        rag_client.table("document_chunks")
        .select("chunk_id,metadata")
        .eq("document_id", str(document_id))
        .limit(1000)
        .execute()
        .data
        or []
    )
    for chunk in chunk_rows:
        chunk_id = chunk.get("chunk_id")
        if not chunk_id:
            continue
        metadata = chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
        rag_client.table("document_chunks").update(
            {"metadata": {**metadata, "project_id": int(project_id)}}
        ).eq("chunk_id", str(chunk_id)).execute()


def run_incremental_project_backfill(
    client: Client,
    *,
    limit: int | None = None,
    min_confidence: float | None = None,
    since: datetime | None = None,
    source_filter: str | None = None,
    categories: List[str] | None = None,
) -> Dict[str, Any]:
    """Assign project_id on recent unassigned communication documents.

    This is intentionally bounded so it can run after sync jobs without turning
    every scheduler tick into a full historical scan.
    """

    resolved_limit = limit or int(os.getenv("COMM_PROJECT_BACKFILL_LIMIT", "250"))
    resolved_min_confidence = min_confidence or float(
        os.getenv("COMM_PROJECT_BACKFILL_MIN_CONFIDENCE", "0.70")
    )

    assigner = ProjectAssigner(client)
    stats: Dict[str, Any] = {
        "scanned": 0,
        "assigned": 0,
        "skipped_low_confidence": 0,
        "review_staged": 0,
        "failed": 0,
        "methods": {},
        "errors": [],
    }

    for document in _iter_unassigned_documents(
        client,
        resolved_limit,
        since=since,
        source_filter=source_filter,
        categories=categories,
    ):
        stats["scanned"] += 1
        try:
            attribution_evidence = build_project_attribution_evidence(document)
            project_id, method, confidence = assigner.assign_project(
                meeting_title=str(attribution_evidence.get("title") or ""),
                participants=participants_for_document(document),
                content=str(attribution_evidence.get("content") or "")[:3000],
                existing_project_id=None,
            )

            if not project_id or confidence < resolved_min_confidence:
                stats["skipped_low_confidence"] += 1
                _write_pending_review_candidate(
                    document,
                    method=method,
                    confidence=confidence,
                    attribution_evidence=attribution_evidence,
                )
                stats["review_staged"] += 1
                continue

            project = (
                client.table("projects")
                .select("name")
                .eq("id", int(project_id))
                .single()
                .execute()
                .data
            )
            project_name = (project or {}).get("name")
            client.table("document_metadata").update(
                {
                    "project_id": int(project_id),
                    "project": project_name,
                    "tags": _append_tag(document.get("tags"), BACKFILL_TAG),
                }
            ).eq("id", document["id"]).execute()
            _sync_project_assignment_to_rag(document["id"], int(project_id))

            get_rag_write_client().table("document_attribution_candidates").insert(
                {
                    "source_document_id": document["id"],
                    "candidate_project_id": int(project_id),
                    "candidate_project_name": project_name,
                    "confidence": min(0.99, confidence),
                    "attribution_method": method,
                    "evidence_terms": [method],
                    "reasoning": (
                        "Auto-assigned by incremental communications project backfill "
                        "after Graph/Fireflies sync."
                    ),
                    "status": "auto_assigned",
                }
            ).execute()

            stats["assigned"] += 1
            stats["methods"][method] = stats["methods"].get(method, 0) + 1
        except Exception as exc:
            stats["failed"] += 1
            stats["errors"].append({"document_id": document.get("id"), "error": str(exc)})

    return stats
