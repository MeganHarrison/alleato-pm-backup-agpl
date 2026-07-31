"""Incremental project attribution backfill for ingested communications."""

from __future__ import annotations

import os
from collections.abc import Iterable
from datetime import datetime
from typing import Any

from supabase import Client

from ..supabase_helpers import get_rag_write_client
from .project_assignment import AssignmentTarget, ProjectAssigner
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


def _is_target_document(document: dict[str, Any]) -> bool:
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
    categories: list[str] | None = None,
) -> Iterable[dict[str, Any]]:
    sources = [source_filter] if source_filter else list(SOURCE_FILTERS.keys())
    query = (
        client.table("document_metadata")
        .select(
            "id,title,source,category,content,summary,overview,participants,participants_array,host_email,organizer_email,tags,project_id,business_area_id,created_at",
        )
        .is_("project_id", "null")
        .is_("business_area_id", "null")
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


def _matched_fields_for_evidence(attribution_evidence: dict[str, Any]) -> list[str]:
    content_source = attribution_evidence.get("content_source")
    fields = ["document_metadata.title"]
    if content_source == "document_chunks":
        fields.append("document_chunks.text")
    elif content_source in {"document_metadata", "summary_metadata"}:
        fields.append("document_metadata.content")
    return fields


def _write_pending_review_candidate(
    document: dict[str, Any],
    *,
    method: str,
    confidence: float,
    attribution_evidence: dict[str, Any],
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


def sync_document_assignment_to_rag(
    document_id: str,
    *,
    project_id: int | None,
    business_area_id: int | None,
) -> None:
    """Keep RAG metadata and chunks aligned with one exact typed assignment."""
    if project_id is not None and business_area_id is not None:
        raise ValueError(
            "communication assignment cannot contain both project_id and business_area_id"
        )

    rag_client = get_rag_write_client()
    rag_rows = (
        rag_client.table("rag_document_metadata")
        .select("id,source_metadata")
        .eq("id", str(document_id))
        .limit(1)
        .execute()
        .data
        or []
    )
    if not rag_rows:
        raise RuntimeError(
            f"communication assignment found no RAG metadata row for {document_id}"
        )

    source_metadata = rag_rows[0].get("source_metadata")
    if not isinstance(source_metadata, dict):
        source_metadata = {}
    else:
        source_metadata = dict(source_metadata)
    source_metadata.pop("business_area_id", None)
    if business_area_id is not None:
        source_metadata["business_area_id"] = int(business_area_id)

    rag_client.table("rag_document_metadata").update(
        {
            "project_id": int(project_id) if project_id is not None else None,
            "source_metadata": source_metadata,
        }
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
        metadata = (
            chunk.get("metadata") if isinstance(chunk.get("metadata"), dict) else {}
        )
        metadata = dict(metadata)
        metadata.pop("project_id", None)
        metadata.pop("business_area_id", None)
        if project_id is not None:
            metadata["project_id"] = int(project_id)
        if business_area_id is not None:
            metadata["business_area_id"] = int(business_area_id)
        rag_client.table("document_chunks").update({"metadata": metadata}).eq(
            "chunk_id", str(chunk_id)
        ).execute()


def build_target_catalog_payload(
    client: Client,
    target: AssignmentTarget,
) -> tuple[dict[str, Any], str]:
    if target.business_area_id is not None:
        area = (
            client.table("business_areas")
            .select("id,name,is_restricted")
            .eq("id", int(target.business_area_id))
            .single()
            .execute()
            .data
        )
        if not area:
            raise RuntimeError(
                f"communication assignment Business Area {target.business_area_id} is unavailable"
            )
        area_name = str(area.get("name") or "").strip()
        if not area_name:
            raise RuntimeError(
                f"communication assignment Business Area {target.business_area_id} has no name"
            )
        return (
            {
                "project_id": None,
                "business_area_id": int(target.business_area_id),
                "project": None,
                "access_level": (
                    "restricted" if area.get("is_restricted") is True else "team"
                ),
            },
            area_name,
        )

    if target.project_id is None:
        raise ValueError("communication assignment target has no typed destination")
    project = (
        client.table("projects")
        .select("name")
        .eq("id", int(target.project_id))
        .single()
        .execute()
        .data
    )
    project_name = str((project or {}).get("name") or "").strip()
    if not project_name:
        raise RuntimeError(
            f"communication assignment project {target.project_id} is unavailable"
        )
    return (
        {
            "project_id": int(target.project_id),
            "business_area_id": None,
            "project": project_name,
        },
        project_name,
    )


def run_incremental_project_backfill(
    client: Client,
    *,
    limit: int | None = None,
    min_confidence: float | None = None,
    since: datetime | None = None,
    source_filter: str | None = None,
    categories: list[str] | None = None,
) -> dict[str, Any]:
    """Assign one project-or-Business-Area scope to recent communications.

    This is intentionally bounded so it can run after sync jobs without turning
    every scheduler tick into a full historical scan.
    """

    resolved_limit = limit or int(os.getenv("COMM_PROJECT_BACKFILL_LIMIT", "250"))
    resolved_min_confidence = min_confidence or float(
        os.getenv("COMM_PROJECT_BACKFILL_MIN_CONFIDENCE", "0.70")
    )

    assigner = ProjectAssigner(client)
    stats: dict[str, Any] = {
        "scanned": 0,
        "assigned": 0,
        "assigned_projects": 0,
        "assigned_business_areas": 0,
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
            target = assigner.assign_scope(
                meeting_title=str(attribution_evidence.get("title") or ""),
                participants=participants_for_document(document),
                content=str(attribution_evidence.get("content") or "")[:3000],
                existing_project_id=None,
            )

            if (
                target.project_id is None and target.business_area_id is None
            ) or target.confidence < resolved_min_confidence:
                stats["skipped_low_confidence"] += 1
                _write_pending_review_candidate(
                    document,
                    method=target.method,
                    confidence=target.confidence,
                    attribution_evidence=attribution_evidence,
                )
                stats["review_staged"] += 1
                continue

            scope_payload, target_name = build_target_catalog_payload(client, target)
            client.table("document_metadata").update(
                {
                    **scope_payload,
                    "tags": _append_tag(document.get("tags"), BACKFILL_TAG),
                }
            ).eq("id", document["id"]).execute()
            sync_document_assignment_to_rag(
                document["id"],
                project_id=target.project_id,
                business_area_id=target.business_area_id,
            )

            get_rag_write_client().table("document_attribution_candidates").insert(
                {
                    "source_document_id": document["id"],
                    "candidate_project_id": target.project_id,
                    "candidate_project_name": (
                        target_name if target.project_id is not None else None
                    ),
                    "confidence": min(0.99, target.confidence),
                    "attribution_method": target.method,
                    "evidence_terms": [target.method],
                    "reasoning": (
                        "Auto-assigned by incremental communications typed-scope backfill "
                        "after Graph/Fireflies sync."
                    ),
                    "status": "auto_assigned",
                    "evidence": {
                        "target_type": (
                            "business_area"
                            if target.business_area_id is not None
                            else "project"
                        ),
                        "business_area_id": target.business_area_id,
                        "legacy_project_id": target.legacy_project_id,
                        "target_name": target_name,
                    },
                }
            ).execute()

            stats["assigned"] += 1
            if target.business_area_id is not None:
                stats["assigned_business_areas"] += 1
            else:
                stats["assigned_projects"] += 1
            stats["methods"][target.method] = stats["methods"].get(target.method, 0) + 1
        except Exception as exc:
            stats["failed"] += 1
            stats["errors"].append(
                {"document_id": document.get("id"), "error": str(exc)}
            )

    return stats
