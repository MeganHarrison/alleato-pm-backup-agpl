"""Multi-source RAG/source health watchdog.

This is the scheduled gate for source freshness, embedding coverage, compiler
backlog, and alert persistence across Fireflies, Microsoft Graph, Teams,
SharePoint, and task extraction.
"""

from __future__ import annotations

import json
import os
import re
import sys
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List

import httpx

from src.services.health.source_sync_health import (
    get_source_sync_health,
    persist_source_sync_alerts,
    reserve_health_digest_notification,
    resolve_health_digest_notification,
    update_source_health_snapshot,
)
from src.services.supabase_helpers import get_supabase_client
from src.services.supabase_helpers import get_rag_read_client


WATCHED_SOURCES = {
    "fireflies",
    "outlook_email",
    "teams_message",
    "teams_chat_export",
    "sharepoint_file",
    "task_extraction",
    "vectorization",
    "intelligence_compiler",
}

DEFAULT_ALERT_TEAMS_USER_ID = "1854b4b0-3e8e-4d69-86df-32cdb3c80ee0"
LIFECYCLE_LOOKBACK_HOURS = int(os.getenv("RAG_HEALTH_LIFECYCLE_LOOKBACK_HOURS", "24"))
LIFECYCLE_PROCESSING_GRACE_MINUTES = int(os.getenv("RAG_HEALTH_LIFECYCLE_PROCESSING_GRACE_MINUTES", "60"))
MAX_PACKET_AGE_HOURS = int(os.getenv("RAG_HEALTH_MAX_PACKET_AGE_HOURS", "36"))
GRAPH_CONVERSATION_HEALTH_LOOKBACK_DAYS = int(os.getenv("RAG_HEALTH_GRAPH_CONVERSATION_LOOKBACK_DAYS", "30"))
GRAPH_CONVERSATION_HEALTH_LIMIT = int(os.getenv("RAG_HEALTH_GRAPH_CONVERSATION_LIMIT", "5000"))
LIFECYCLE_LOOKUP_BATCH_SIZE = 25
TERMINAL_DOCUMENT_STATUSES = {
    "intentionally_excluded",
    "deleted_no_transcript",
    "metadata_only",
    "not_vectorizable",
    "skipped",
    "skipped_low_content",
    "graph_content_missing",
    "graph_content_empty",
    "no_chunks",
    "ocr_failed",
}
GRAPH_CONVERSATION_ALLOWED_SOURCE_TYPES = {
    "outlook": {"email"},
    "teams_dm": {"teams_dm"},
    "teams_channel": {"teams_channel", "teams_message"},
}
SEARCHABLE_MEETING_CHUNK_SOURCE_TYPES = {
    "meeting_transcript",
    "meeting_summary",
    "meeting_segment_summary",
    "meeting_notes",
    "meeting_section",
}
NON_PROJECT_APPLICABLE_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bread\.ai\b",
        r"\bnotetaker\b",
        r"\bmeeting recorder\b",
        r"\bmeeting recording\b",
        r"\btranscript is ready\b",
        r"\bjoined your meeting\b",
        r"\bundeliverable\b",
        r"\becoshield pest solutions?\b",
        r"\bpest solutions?\b",
        r"\bfishing trip\b",
        r"\bamazon\.com/checkout\b",
        r"\binsulation4less\.com\b",
        r"\bhandcrafted hose co\b",
        r"\bprotection for automatic storage and retrieval systems\b",
        r"\bi was so shocked\b",
        r"\bdrone broken\b",
        r"\bpractice hours\b",
        r"\bcanceled:\s*",
        r"\bcancelled:\s*",
    ]
]
MULTI_PROJECT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\bweekly huddle\b",
        r"\boac meeting\b",
        r"\bhuddle agenda\b",
        r"\bdaily agenda\b",
        r"\bsprinkler division\s+[\u2013-]\s+daily huddle\b",
        r"\bweekly touch base\b",
    ]
]
INTERNAL_PROJECT_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\btimesheets?\b",
        r"\btimecards?\b",
        r"\bsalary\b",
        r"\bpto\b",
        r"\bpayroll\b",
        r"\be-payroll\b",
        r"\bhealth insurance\b",
        r"\boperating agreement\b",
        r"\bteam strategy\b",
        r"\bcompany announcements?\b",
        r"\bindiana office\b",
        r"\blunch\b",
        r"\bcredit card\b",
        r"\bbill\.com\b",
        r"\bvendor\b",
        r"\blaptop\b",
        r"\binterview\b",
        r"\bpaternity leave\b",
        r"\byearly review\b",
        r"\bcancellations\b",
        r"\bpolicy #\d",
        r"\bgathering content for marketing\b",
        r"\bpending invoices in notion\b",
        r"\btransaction coding\b",
        r"\bbusiness trust\b",
        r"\btrust funding\b",
        r"\btrust governance\b",
        r"\btrust income\b",
        r"\bextraordinary dividends?\b",
        r"\bholding company\b",
        r"\bmanagement service agreements?\b",
        r"\btax compliance\b",
    ]
]
PROJECT_SIGNAL_PATTERNS = [
    re.compile(pattern, re.IGNORECASE)
    for pattern in [
        r"\brfi\b",
        r"\bsubmittal\b",
        r"\bchange order\b",
        r"\bchange event\b",
        r"\bpay app\b",
        r"\binvoice\b",
        r"\bdrawings?\b",
        r"\bpermit\b",
        r"\bbid set\b",
        r"\bpricing\b",
        r"\bcompleted service\b",
        r"\bsprinkler\b",
        r"\bpenetration\b",
    ]
]


def _iso(value: datetime) -> str:
    return value.astimezone(timezone.utc).isoformat()


def _parse_datetime(value: Any) -> datetime | None:
    if not value:
        return None
    if isinstance(value, datetime):
        return value if value.tzinfo else value.replace(tzinfo=timezone.utc)
    try:
        parsed = datetime.fromisoformat(str(value).replace("Z", "+00:00"))
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return None


def _newest(values: List[Any]) -> str | None:
    parsed = [value for value in (_parse_datetime(value) for value in values) if value]
    if not parsed:
        return None
    return _iso(max(parsed))


def _coverage_status(count: int, total: int) -> str:
    if total == 0:
        return "unknown"
    if count == total:
        return "healthy"
    if count > 0:
        return "warning"
    return "critical"


def _is_past_lifecycle_processing_grace(row: Dict[str, Any], now: datetime) -> bool:
    created_at = _parse_datetime(row.get("created_at"))
    if not created_at:
        return True
    return created_at <= now - timedelta(minutes=LIFECYCLE_PROCESSING_GRACE_MINUTES)


def _source_family(row: Dict[str, Any]) -> str | None:
    source = str(row.get("source") or "").lower()
    category = str(row.get("category") or "").lower()
    doc_type = str(row.get("type") or "").lower()
    row_id = str(row.get("id") or "").lower()
    source_item_id = str(row.get("source_item_id") or "").lower()

    if source == "fireflies":
        return "meetings"
    if source != "microsoft_graph":
        return None
    if category == "teams_message" or "teams" in doc_type:
        return "teams"
    if category == "email" or doc_type in {"email", "email_attachment"} or row_id.startswith("outlook_"):
        return "emails"
    if (
        row_id.startswith("sharepoint_")
        or source_item_id.startswith("sharepoint_")
        or source_item_id.startswith("sites/")
        or "sharepoint" in source_item_id
        or "driveitem" in source_item_id
        or category == "document"
    ):
        return "sharepoint"
    return None


def _stage_alert(
    *,
    family: str,
    stage: str,
    severity: str,
    count: int,
    total: int,
    owner: str,
    latest_at: str | None,
    total_excluded: int = 0,
    message: str | None = None,
) -> Dict[str, Any]:
    exclusion_text = ""
    if total_excluded:
        exclusion_text = f" Excluded from this stage: {total_excluded}."
    alert_text = (
        f"{message} Owner: {owner}. Latest: {latest_at or 'never'}.{exclusion_text}"
        if message
        else (
            f"{family}: {stage} coverage is {count}/{total}. "
            f"Owner: {owner}. Latest: {latest_at or 'never'}.{exclusion_text}"
        )
    )
    return {
        "severity": severity,
        "code": f"rag_lifecycle_{stage}",
        "source": family,
        "resourceId": f"rag-lifecycle:{family}",
        "message": alert_text,
        "detectedAt": _iso(datetime.now(timezone.utc)),
    }


def _is_terminal_vectorization_status(status: Any) -> bool:
    return str(status or "").strip().lower() in TERMINAL_DOCUMENT_STATUSES


def _is_terminal_vectorization_row(
    row: Dict[str, Any],
    rag_metadata_by_id: Dict[str, Dict[str, Any]],
) -> bool:
    if _is_terminal_vectorization_status(row.get("status")):
        return True
    rag_metadata = rag_metadata_by_id.get(str(row.get("id") or ""))
    if not rag_metadata:
        return False
    return (
        _is_terminal_vectorization_status(rag_metadata.get("embedding_status"))
        or _is_terminal_vectorization_status(rag_metadata.get("parsing_status"))
    )


def _latest_job_metadata_by_document_id(job_rows: List[Dict[str, Any]]) -> Dict[str, Dict[str, Any]]:
    def sort_key(item: Dict[str, Any]) -> tuple[int, int, str]:
        metadata = item.get("metadata")
        metadata = metadata if isinstance(metadata, dict) else {}
        read_proof = metadata.get("read_proof") if isinstance(metadata, dict) else None
        has_full_read_proof = (
            isinstance(read_proof, dict)
            and read_proof.get("status") == "full_source_read"
            and read_proof.get("scope") == "full_transcript"
        )
        has_task_extraction_outcome = bool(metadata.get("task_extraction_status"))
        return (
            1 if has_full_read_proof else 0,
            1 if has_task_extraction_outcome else 0,
            str(item.get("updated_at") or ""),
        )

    metadata_by_id: Dict[str, Dict[str, Any]] = {}
    for row in sorted(job_rows, key=sort_key, reverse=True):
        document_id = str(row.get("source_document_id") or "")
        if not document_id or document_id in metadata_by_id:
            continue
        metadata = row.get("metadata")
        clean_metadata = metadata if isinstance(metadata, dict) else {}
        metadata_by_id[document_id] = {**clean_metadata, "_updated_at": row.get("updated_at")}
    return metadata_by_id


def _merge_source_synthesis_metadata(
    metadata_by_id: Dict[str, Dict[str, Any]],
    source_synthesis_rows: List[Dict[str, Any]],
) -> Dict[str, Dict[str, Any]]:
    for row in source_synthesis_rows:
        document_id = str(row.get("source_document_id") or "")
        synthesis_id = row.get("id")
        if not document_id or not synthesis_id:
            continue
        metadata = metadata_by_id.setdefault(document_id, {})
        metadata.setdefault("source_synthesis_id", synthesis_id)
        metadata.setdefault("project_id", row.get("project_id"))
        synthesis_metadata = row.get("metadata")
        synthesis_metadata = synthesis_metadata if isinstance(synthesis_metadata, dict) else {}
        synthesis_type = str(synthesis_metadata.get("deterministic_signal_type") or "")
        if synthesis_type:
            metadata.setdefault("source_synthesis_signal_type", synthesis_type)
        synthesis_tasks = row.get("tasks") if isinstance(row.get("tasks"), list) else []
        if synthesis_type == "task" or synthesis_tasks:
            metadata.setdefault("task_extraction_status", "task_signal_staged")
        elif synthesis_type:
            metadata.setdefault("task_extraction_status", "no_actionable_tasks")
        metadata["_updated_at"] = row.get("updated_at") or row.get("created_at") or metadata.get("_updated_at")
    return metadata_by_id


def _is_project_required_row(row: Dict[str, Any], job_metadata_by_id: Dict[str, Dict[str, Any]]) -> bool:
    if row.get("project_id") is not None:
        return True
    metadata = job_metadata_by_id.get(str(row.get("id") or "")) or {}
    if metadata.get("project_required") is True:
        return True
    if metadata.get("project_required") is False:
        return False
    applicability = str(metadata.get("project_applicability") or "")
    if applicability in {"internal_project", "multi_project_review", "not_project_applicable"}:
        return False
    if applicability in {"single_project", "project_assignment_review"}:
        return True
    fallback = _classify_project_applicability(row)
    return bool(fallback.get("project_required"))


def _matches_any(text: str, patterns: List[re.Pattern[str]]) -> bool:
    return any(pattern.search(text) for pattern in patterns)


def _classify_project_applicability(row: Dict[str, Any]) -> Dict[str, Any]:
    """Fallback classifier for scheduled health when no stored lifecycle metadata exists."""
    if row.get("project_id") is not None:
        return {
            "project_applicability": "single_project",
            "project_required": True,
            "project_applicability_reason": "source_has_project_id",
        }

    title = str(row.get("title") or row.get("source_title") or "")
    category = str(row.get("category") or "")
    doc_type = str(row.get("type") or "")
    family = str(row.get("family") or "")
    status = str(row.get("status") or "")
    text_sample = str(row.get("content") or row.get("text_sample") or row.get("textSample") or "")
    haystack = "\n".join([title, category, doc_type, family, text_sample])

    if (
        family == "teams"
        and re.match(r"^teams dm conversation:\s*19:", title, re.IGNORECASE)
        and not text_sample.strip()
    ):
        return {
            "project_applicability": "not_project_applicable",
            "project_required": False,
            "project_applicability_reason": "teams_anonymized_thread_has_no_extractable_text",
        }

    if status == "skipped_low_content":
        return {
            "project_applicability": "not_project_applicable",
            "project_required": False,
            "project_applicability_reason": "terminal_status_skipped_low_content",
        }

    if _matches_any(haystack, NON_PROJECT_APPLICABLE_PATTERNS):
        return {
            "project_applicability": "not_project_applicable",
            "project_required": False,
            "project_applicability_reason": "matched_non_project_pattern",
        }
    if _matches_any(haystack, MULTI_PROJECT_PATTERNS):
        return {
            "project_applicability": "multi_project_review",
            "project_required": False,
            "project_applicability_reason": "matched_multi_project_pattern",
        }
    if _matches_any(haystack, INTERNAL_PROJECT_PATTERNS):
        return {
            "project_applicability": "internal_project",
            "project_required": False,
            "project_applicability_reason": "matched_internal_pattern",
        }
    if _matches_any(haystack, PROJECT_SIGNAL_PATTERNS):
        return {
            "project_applicability": "project_assignment_review",
            "project_required": True,
            "project_applicability_reason": "matched_project_signal_pattern",
        }
    return {
        "project_applicability": "project_assignment_review",
        "project_required": True,
        "project_applicability_reason": "no_project_id_and_no_exclusion_pattern",
    }


def _has_task_extraction_outcome(document_id: str, task_ids: set[str], job_metadata_by_id: Dict[str, Dict[str, Any]]) -> bool:
    if document_id in task_ids:
        return True
    metadata = job_metadata_by_id.get(document_id) or {}
    status = str(metadata.get("task_extraction_status") or "").strip().lower()
    return status in {"tasks_created", "no_actionable_tasks", "task_signal_staged"}


def _counts_task_extraction_outcome(
    *,
    family: str,
    document_id: str,
    task_ids: set[str],
    evidence_ids: set[str],
    job_metadata_by_id: Dict[str, Dict[str, Any]],
) -> bool:
    if _has_task_extraction_outcome(document_id, task_ids, job_metadata_by_id):
        return True
    return family == "meetings" and document_id in evidence_ids


def _has_project_intelligence_outcome(
    document_id: str,
    evidence_ids: set[str],
    job_metadata_by_id: Dict[str, Dict[str, Any]],
) -> bool:
    if document_id in evidence_ids:
        return True
    metadata = job_metadata_by_id.get(document_id) or {}
    return bool(
        metadata.get("source_synthesis_id")
        or metadata.get("signal_candidate_id")
        or metadata.get("packet_refresh_job_id")
        or metadata.get("packet_id")
    )


def _has_full_transcript_read_proof(document_id: str, job_metadata_by_id: Dict[str, Dict[str, Any]]) -> bool:
    metadata = job_metadata_by_id.get(document_id) or {}
    read_proof = metadata.get("read_proof")
    if not isinstance(read_proof, dict):
        return False
    return (
        read_proof.get("status") == "full_source_read"
        and read_proof.get("scope") == "full_transcript"
    )


def _has_project_attribution_review(
    document_id: str,
    attribution_review_ids: set[str],
) -> bool:
    return document_id in attribution_review_ids


def _counts_project_intelligence_outcome(
    *,
    family: str,
    document_id: str,
    evidence_ids: set[str],
    job_metadata_by_id: Dict[str, Dict[str, Any]],
) -> bool:
    if not _has_project_intelligence_outcome(document_id, evidence_ids, job_metadata_by_id):
        return False
    if family != "meetings":
        return True
    metadata = job_metadata_by_id.get(document_id) or {}
    return (
        document_id in evidence_ids
        or _has_full_transcript_read_proof(document_id, job_metadata_by_id)
        or bool(metadata.get("source_synthesis_signal_type"))
        or (
            bool(metadata.get("packet_id"))
            and metadata.get("path") == "project_intelligence.refresh_project_intelligence"
        )
    )


def _graph_conversation_kind(row: Dict[str, Any]) -> str | None:
    source_metadata = row.get("source_metadata")
    source_metadata = source_metadata if isinstance(source_metadata, dict) else {}
    document_kind = str(source_metadata.get("document_kind") or "")
    doc_type = str(row.get("type") or "")
    row_id = str(row.get("id") or "")

    if document_kind == "outlook_conversation" or doc_type == "outlook_conversation" or row_id.startswith("outlook_conversation_"):
        return "outlook"
    if document_kind == "teams_dm_conversation" or doc_type == "teams_dm_conversation" or row_id.startswith("teamsdm_"):
        return "teams_dm"
    if document_kind in {"teams_channel_thread", "teams_message"} or doc_type == "teams_message" or row_id.startswith("teams_"):
        return "teams_channel"
    return None


def _graph_conversation_alert_source(kind: str) -> str:
    if kind == "outlook":
        return "emails"
    return "teams"


def _graph_conversation_chunk_alerts(
    conversation_rows: List[Dict[str, Any]],
    chunk_rows: List[Dict[str, Any]],
    *,
    now: datetime,
    truncated: bool = False,
) -> Dict[str, Any]:
    chunks_by_document: Dict[str, List[Dict[str, Any]]] = {}
    for chunk in chunk_rows:
        document_id = str(chunk.get("document_id") or "")
        if not document_id:
            continue
        chunks_by_document.setdefault(document_id, []).append(chunk)

    summaries: Dict[str, Dict[str, Any]] = {
        kind: {
            "kind": kind,
            "docs": 0,
            "chunks": 0,
            "embeddedChunks": 0,
            "docsWithoutChunks": 0,
            "embeddedDocsWithoutChunks": 0,
            "sourceTypes": set(),
            "badDocs": [],
            "embeddedNoChunkDocs": [],
        }
        for kind in GRAPH_CONVERSATION_ALLOWED_SOURCE_TYPES
    }
    alerts: List[Dict[str, Any]] = []

    for row in conversation_rows:
        kind = _graph_conversation_kind(row)
        if kind not in summaries:
            continue
        document_id = str(row.get("id") or "")
        doc_chunks = chunks_by_document.get(document_id, [])
        source_types = {
            str(chunk.get("source_type") or "")
            for chunk in doc_chunks
            if chunk.get("source_type") is not None
        }
        bad_source_types = sorted(
            source_type
            for source_type in source_types
            if source_type not in GRAPH_CONVERSATION_ALLOWED_SOURCE_TYPES[kind]
        )
        summary = summaries[kind]
        summary["docs"] += 1
        summary["chunks"] += len(doc_chunks)
        summary["embeddedChunks"] += len(doc_chunks)
        summary["sourceTypes"].update(source_types)
        if not doc_chunks:
            summary["docsWithoutChunks"] += 1
            if str(row.get("embedding_status") or "").lower() == "embedded":
                summary["embeddedDocsWithoutChunks"] += 1
                summary["embeddedNoChunkDocs"].append(document_id)
        if bad_source_types:
            summary["badDocs"].append(
                {
                    "id": document_id,
                    "title": row.get("title"),
                    "sourceTypes": bad_source_types,
                    "embeddingStatus": row.get("embedding_status"),
                }
            )

    for kind, summary in summaries.items():
        bad_docs = summary["badDocs"]
        if bad_docs:
            examples = ", ".join(
                f"{doc['id']} ({','.join(doc['sourceTypes'])})"
                for doc in bad_docs[:5]
            )
            alerts.append(
                {
                    "severity": "critical",
                    "code": "graph_conversation_chunk_source_type_drift",
                    "source": _graph_conversation_alert_source(kind),
                    "resourceId": f"graph-conversation-chunks:{kind}",
                    "message": (
                        f"Graph-owned {kind} conversation docs have disallowed document_chunks.source_type values. "
                        f"Affected docs: {len(bad_docs)}. Examples: {examples}. "
                        "Owner: Graph embedder. Prevention: rerun the Graph conversation chunk ownership verifier and repair/reset scoped docs."
                    ),
                    "detectedAt": _iso(now),
                }
            )
        no_chunk_docs = summary["embeddedNoChunkDocs"]
        if no_chunk_docs:
            examples = ", ".join(no_chunk_docs[:5])
            alerts.append(
                {
                    "severity": "critical",
                    "code": "graph_conversation_embedded_without_chunks",
                    "source": _graph_conversation_alert_source(kind),
                    "resourceId": f"graph-conversation-chunks:{kind}:missing",
                    "message": (
                        f"Graph-owned {kind} conversation docs are marked embedded but have no document_chunks rows. "
                        f"Affected docs: {len(no_chunk_docs)}. Examples: {examples}. "
                        "Owner: Graph embedder. Prevention: reset scoped RAG embedding_status to NULL so the Graph embedder reclassifies them."
                    ),
                    "detectedAt": _iso(now),
                }
            )

    if truncated:
        alerts.append(
            {
                "severity": "warning",
                "code": "graph_conversation_health_sample_truncated",
                "source": "teams",
                "resourceId": "graph-conversation-chunks:sample",
                "message": (
                    f"Graph conversation health scan hit the {GRAPH_CONVERSATION_HEALTH_LIMIT} row sample limit. "
                    "Increase RAG_HEALTH_GRAPH_CONVERSATION_LIMIT if source-type drift is suspected outside the sample."
                ),
                "detectedAt": _iso(now),
            }
        )

    clean_summaries = []
    for summary in summaries.values():
        clean_summaries.append(
            {
                **summary,
                "sourceTypes": sorted(summary["sourceTypes"]),
                "badDocs": summary["badDocs"][:10],
                "embeddedNoChunkDocs": summary["embeddedNoChunkDocs"][:10],
            }
        )

    return {
        "status": "degraded" if any(alert.get("severity") == "critical" for alert in alerts) else "healthy",
        "lookbackDays": GRAPH_CONVERSATION_HEALTH_LOOKBACK_DAYS,
        "limit": GRAPH_CONVERSATION_HEALTH_LIMIT,
        "truncated": truncated,
        "summaries": clean_summaries,
        "alerts": alerts,
    }


def _load_graph_conversation_chunk_health(rag_client: Any, now: datetime) -> Dict[str, Any]:
    cutoff = _iso(now - timedelta(days=GRAPH_CONVERSATION_HEALTH_LOOKBACK_DAYS))
    conversation_rows = (
        rag_client.table("rag_document_metadata")
        .select("id,title,type,category,source,source_metadata,embedding_status,updated_at")
        .eq("source", "microsoft_graph")
        .gte("updated_at", cutoff)
        .order("updated_at", desc=True)
        .limit(GRAPH_CONVERSATION_HEALTH_LIMIT + 1)
        .execute()
    ).data or []
    truncated = len(conversation_rows) > GRAPH_CONVERSATION_HEALTH_LIMIT
    conversation_rows = conversation_rows[:GRAPH_CONVERSATION_HEALTH_LIMIT]
    conversation_rows = [
        row
        for row in conversation_rows
        if _graph_conversation_kind(row)
    ]
    conversation_ids = [str(row.get("id")) for row in conversation_rows if row.get("id")]
    chunk_rows: List[Dict[str, Any]] = []
    batch_size = 100
    for start in range(0, len(conversation_ids), batch_size):
        batch = conversation_ids[start:start + batch_size]
        chunk_rows.extend((
            rag_client.table("document_chunks")
            .select("document_id,chunk_id,source_type,updated_at")
            .in_("document_id", batch)
            .limit(1000)
            .execute()
        ).data or [])

    return _graph_conversation_chunk_alerts(
        conversation_rows,
        chunk_rows,
        now=now,
        truncated=truncated,
    )


def _load_recent_rag_lifecycle_alerts(app_client: Any) -> Dict[str, Any]:
    """Return lifecycle coverage and alerts for the minimum trusted RAG path.

    This deliberately duplicates the operator-facing source-sync matrix at the
    backend health layer so scheduled cron alerts do not depend on someone
    opening the admin page.
    """
    now = datetime.now(timezone.utc)
    cutoff = _iso(now - timedelta(hours=LIFECYCLE_LOOKBACK_HOURS))
    packet_cutoff = _iso(now - timedelta(hours=MAX_PACKET_AGE_HOURS))
    rag_client = get_rag_read_client()
    graph_conversation_health = _load_graph_conversation_chunk_health(rag_client, now)

    app_source_rows = (
        app_client.table("document_metadata")
        .select("id,title,source,category,type,status,project_id,source_item_id,fireflies_id,created_at,date,source_last_modified_at,deleted_at,content")
        .is_("deleted_at", "null")
        .gte("created_at", cutoff)
        .in_("source", ["fireflies", "microsoft_graph"])
        .order("created_at", desc=True)
        .limit(2000)
        .execute()
    ).data or []

    app_source_ids = {str(row.get("id")) for row in app_source_rows if row.get("id")}
    rag_email_source_rows = (
        rag_client.table("rag_document_metadata")
        .select("id,title,source,type,source_system,source_item_id,source_web_url,created_at,updated_at,project_id,parsing_status")
        .eq("source", "microsoft_graph")
        .in_("type", ["email", "email_attachment"])
        .gte("updated_at", cutoff)
        .order("updated_at", desc=True)
        .limit(2000)
        .execute()
    ).data or []
    rag_only_email_rows = [
        {
            "id": row.get("id"),
            "title": row.get("title"),
            "source": row.get("source"),
            "category": "email_attachment" if row.get("type") == "email_attachment" else "email",
            "type": row.get("type"),
            "status": row.get("parsing_status") or "raw_ingested",
            "project_id": row.get("project_id"),
            "source_item_id": row.get("source_item_id"),
            "fireflies_id": None,
            "created_at": row.get("created_at"),
            "date": row.get("created_at"),
            "source_last_modified_at": row.get("updated_at"),
            "deleted_at": None,
            "content": None,
            "rag_only": True,
        }
        for row in rag_email_source_rows
        if row.get("id") and str(row.get("id")) not in app_source_ids
    ]

    source_rows = [*app_source_rows, *rag_only_email_rows]
    source_rows = [
        {**row, "family": _source_family(row)}
        for row in source_rows
        if _source_family(row)
    ]
    source_ids = [str(row.get("id")) for row in source_rows if row.get("id")]

    def _batched(values: List[str], size: int = LIFECYCLE_LOOKUP_BATCH_SIZE) -> List[List[str]]:
        return [values[index:index + size] for index in range(0, len(values), size)]

    chunk_rows: List[Dict[str, Any]] = []
    task_rows: List[Dict[str, Any]] = []
    evidence_rows: List[Dict[str, Any]] = []
    rag_metadata_rows: List[Dict[str, Any]] = []
    job_rows: List[Dict[str, Any]] = []
    source_synthesis_rows: List[Dict[str, Any]] = []
    attribution_candidate_rows: List[Dict[str, Any]] = []
    if source_ids:
        for batch in _batched(source_ids):
            rag_metadata_rows.extend((
                rag_client.table("rag_document_metadata")
                .select("id,embedding_status,parsing_status")
                .in_("id", batch)
                .limit(1000)
                .execute()
            ).data or [])
            job_rows.extend((
                rag_client.table("source_processing_jobs")
                .select("source_document_id,metadata,updated_at")
                .in_("source_document_id", batch)
                .order("updated_at", desc=True)
                .limit(1000)
                .execute()
            ).data or [])
            source_synthesis_rows.extend((
                rag_client.table("source_syntheses")
                .select("id,source_document_id,synthesis_status,project_id,tasks,metadata,created_at,updated_at")
                .in_("source_document_id", batch)
                .eq("synthesis_status", "succeeded")
                .order("updated_at", desc=True)
                .limit(1000)
                .execute()
            ).data or [])
            attribution_candidate_rows.extend((
                rag_client.table("document_attribution_candidates")
                .select("source_document_id,status,candidate_project_id,updated_at,created_at")
                .in_("source_document_id", batch)
                .in_("status", ["pending_review", "approved", "auto_assigned"])
                .order("updated_at", desc=True)
                .limit(1000)
                .execute()
            ).data or [])
            chunk_rows.extend((
                rag_client.table("document_chunks")
                .select("document_id,source_type,updated_at,text")
                .in_("document_id", batch)
                .not_.is_("embedding", "null")
                .limit(1000)
                .execute()
            ).data or [])
            task_rows.extend((
                app_client.table("tasks")
                .select("metadata_id,project_id,created_at")
                .in_("metadata_id", batch)
                .gte("created_at", cutoff)
                .limit(1000)
                .execute()
            ).data or [])
            evidence_rows.extend((
                app_client.table("insight_card_evidence")
                .select("source_document_id,created_at")
                .in_("source_document_id", batch)
                .gte("created_at", cutoff)
                .limit(1000)
                .execute()
            ).data or [])

    packet_rows = (
        app_client.table("intelligence_packets")
        .select("id,generated_at")
        .eq("packet_type", "current")
        .gte("generated_at", packet_cutoff)
        .order("generated_at", desc=True)
        .limit(100)
        .execute()
    ).data or []

    embedded_ids = {str(row.get("document_id")) for row in chunk_rows if row.get("document_id")}
    embedded_meeting_ids = {
        str(row.get("document_id"))
        for row in chunk_rows
        if row.get("document_id") and row.get("source_type") in SEARCHABLE_MEETING_CHUNK_SOURCE_TYPES
    }
    rag_metadata_by_id = {
        str(row.get("id")): row
        for row in rag_metadata_rows
        if row.get("id")
    }
    job_metadata_by_id = _latest_job_metadata_by_document_id(job_rows)
    _merge_source_synthesis_metadata(job_metadata_by_id, source_synthesis_rows)
    chunk_text_by_document_id: Dict[str, str] = {}
    for chunk in chunk_rows:
        document_id = str(chunk.get("document_id") or "")
        if not document_id:
            continue
        text = str(chunk.get("text") or "")
        if not text:
            continue
        existing = chunk_text_by_document_id.get(document_id)
        chunk_text_by_document_id[document_id] = f"{existing}\n{text}" if existing else text
    task_ids = {str(row.get("metadata_id")) for row in task_rows if row.get("metadata_id")}
    evidence_ids = {
        str(row.get("source_document_id"))
        for row in evidence_rows
        if row.get("source_document_id")
    }
    attribution_review_ids = {
        str(row.get("source_document_id"))
        for row in attribution_candidate_rows
        if row.get("source_document_id")
        and row.get("status") == "pending_review"
        and row.get("candidate_project_id") is None
    }
    has_fresh_packets = bool(packet_rows)
    latest_packet_at = _newest([row.get("generated_at") for row in packet_rows])
    family_labels = {
        "meetings": "Meeting transcripts",
        "teams": "Teams messages",
        "emails": "Emails",
        "sharepoint": "SharePoint files",
    }
    family_summaries: List[Dict[str, Any]] = []
    lifecycle_alerts: List[Dict[str, Any]] = [*graph_conversation_health.get("alerts", [])]

    for family, label in family_labels.items():
        rows = [
            {
                **row,
                "content": row.get("content") or chunk_text_by_document_id.get(str(row.get("id") or "")),
            }
            for row in source_rows
            if row.get("family") == family
        ]
        ids = {str(row.get("id")) for row in rows if row.get("id")}
        total = len(rows)
        vectorization_excluded_rows = [
            row
            for row in rows
            if _is_terminal_vectorization_row(row, rag_metadata_by_id)
        ]
        vectorization_excluded_ids = {
            str(row.get("id"))
            for row in vectorization_excluded_rows
            if row.get("id")
        }
        processing_grace_ids = {
            str(row.get("id"))
            for row in rows
            if row.get("id") and not _is_past_lifecycle_processing_grace(row, now)
        }
        downstream_excluded_ids = vectorization_excluded_ids | processing_grace_ids
        vectorization_required_ids = ids - downstream_excluded_ids
        project_required_ids = {
            str(row.get("id"))
            for row in rows
            if row.get("id")
            and str(row.get("id")) not in downstream_excluded_ids
            and _is_project_required_row(row, job_metadata_by_id)
        }
        project_assigned_ids = {
            str(row.get("id"))
            for row in rows
            if row.get("id")
            and str(row.get("id")) in project_required_ids
            and row.get("project_id") is not None
        }
        project_attribution_handled_ids = {
            row_id
            for row_id in project_required_ids
            if row_id in project_assigned_ids
            or _has_project_attribution_review(row_id, attribution_review_ids)
        }
        task_required_ids = project_required_ids - attribution_review_ids
        task_required_ids = {
            row_id
            for row_id in task_required_ids
            if not any(str(row.get("id")) == row_id and row.get("rag_only") for row in rows)
        }
        vectorized_ids = embedded_meeting_ids if family == "meetings" else embedded_ids
        vectorized_count = sum(1 for row_id in vectorization_required_ids if row_id in vectorized_ids)
        vectorized_message = (
            f"{vectorized_count}/{len(vectorization_required_ids)} Fireflies metadata rows have "
            "embedded searchable meeting chunks and are searchable by the AI assistant."
            if family == "meetings"
            else f"{vectorized_count}/{len(vectorization_required_ids)} have embedded chunks and are searchable by the AI assistant."
        )
        stages = [
            {
                "stage": "synced",
                "count": total,
                "total": total,
                "status": "healthy" if total else "unknown",
                "owner": "source adapter",
                "latestAt": _newest([row.get("source_last_modified_at") or row.get("date") or row.get("created_at") for row in rows]),
            },
            {
                "stage": "vectorized",
                "count": vectorized_count,
                "total": len(vectorization_required_ids),
                "excluded": len(downstream_excluded_ids),
                "graceExcluded": len(processing_grace_ids),
                "owner": "RAG embedder",
                "latestAt": _newest([
                    row.get("updated_at")
                    for row in chunk_rows
                    if str(row.get("document_id")) in vectorization_required_ids
                    and (family != "meetings" or row.get("source_type") in SEARCHABLE_MEETING_CHUNK_SOURCE_TYPES)
                ]),
                "message": vectorized_message,
            },
            {
                "stage": "project_assigned",
                "count": sum(
                    1
                    for row_id in project_required_ids
                    if row_id in project_attribution_handled_ids
                ),
                "total": len(project_required_ids),
                "excluded": total - len(project_required_ids),
                "owner": "project attribution",
                "latestAt": _newest([row.get("created_at") for row in rows]),
                "reviewRequired": len(attribution_review_ids & project_required_ids),
                "message": (
                    f"{len(project_attribution_handled_ids)}/{len(project_required_ids)} sources are assigned "
                    "or explicitly queued for attribution review."
                ),
            },
            {
                "stage": "tasks_extracted",
                "count": sum(
                    1
                    for row_id in task_required_ids
                    if _counts_task_extraction_outcome(
                        family=family,
                        document_id=row_id,
                        task_ids=task_ids,
                        evidence_ids=evidence_ids,
                        job_metadata_by_id=job_metadata_by_id,
                    )
                ),
                "total": len(task_required_ids),
                "excluded": total - len(task_required_ids),
                "owner": "task extractor",
                "latestAt": _newest(
                    [row.get("created_at") for row in task_rows if str(row.get("metadata_id")) in task_required_ids]
                    + [
                        metadata.get("_updated_at")
                        for row_id, metadata in job_metadata_by_id.items()
                        if row_id in task_required_ids
                        and _counts_task_extraction_outcome(
                            family=family,
                            document_id=row_id,
                            task_ids=task_ids,
                            evidence_ids=evidence_ids,
                            job_metadata_by_id=job_metadata_by_id,
                        )
                    ]
                ),
            },
            {
                "stage": "project_intelligence_updated",
                "count": sum(
                    1
                    for row_id in project_assigned_ids
                    if _counts_project_intelligence_outcome(
                        family=family,
                        document_id=row_id,
                        evidence_ids=evidence_ids,
                        job_metadata_by_id=job_metadata_by_id,
                    )
                ),
                "total": len(project_assigned_ids),
                "excluded": total - len(project_required_ids),
                "owner": "Project Intelligence runner",
                "latestAt": _newest(
                    [row.get("created_at") for row in evidence_rows if str(row.get("source_document_id")) in project_assigned_ids]
                    + [
                        metadata.get("_updated_at")
                        for row_id, metadata in job_metadata_by_id.items()
                        if row_id in project_assigned_ids
                        and _has_project_intelligence_outcome(row_id, evidence_ids, job_metadata_by_id)
                    ]
                ) or latest_packet_at,
                "forceCritical": not has_fresh_packets,
            },
        ]

        for stage in stages:
            status = _coverage_status(int(stage["count"]), int(stage["total"]))
            if stage.get("forceCritical"):
                status = "critical"
            stage["status"] = status
            if status in {"warning", "critical"}:
                lifecycle_alerts.append(
                    _stage_alert(
                        family=family,
                        stage=str(stage["stage"]),
                        severity="critical" if status == "critical" else "warning",
                        count=int(stage["count"]),
                        total=int(stage["total"]),
                        owner=str(stage["owner"]),
                        latest_at=stage.get("latestAt"),
                        total_excluded=int(stage.get("excluded") or 0),
                        message=stage.get("message"),
                    )
                )

        family_summaries.append(
            {
                "family": family,
                "label": label,
                "totalSources": total,
                "stages": stages,
            }
        )

    return {
        "generatedAt": _iso(now),
        "lookbackHours": LIFECYCLE_LOOKBACK_HOURS,
        "maxPacketAgeHours": MAX_PACKET_AGE_HOURS,
        "status": "degraded" if lifecycle_alerts else "healthy",
        "sources": family_summaries,
        "alerts": lifecycle_alerts,
        "graphConversationChunks": graph_conversation_health,
        "latestPacketAt": latest_packet_at,
    }


def _teams_alert_text(report: Dict[str, Any]) -> str:
    critical = report.get("criticalAlerts", [])
    warning = report.get("warningAlerts", [])
    lifecycle = report.get("ragLifecycle", {})
    lines = [
        "RAG pipeline health is degraded.",
        f"Checked: {report.get('generatedAt')}",
        f"Critical: {len(critical)} | Warning: {len(warning)}",
    ]
    latest_packet = lifecycle.get("latestPacketAt")
    if latest_packet:
        lines.append(f"Newest current Project Intelligence packet: {latest_packet}")
    lines.append("")
    lines.append("Top issues:")
    top_alerts = [*critical, *warning][:8]
    for alert in top_alerts:
        lines.append(f"- [{alert.get('severity')}] {alert.get('message')}")
    if not top_alerts:
        # Degraded with no discrete alert rows (e.g. a watched source is warning
        # on an unprocessed backlog below the aggregate threshold). List the
        # unhealthy sources so the DM still carries actionable context.
        for source in report.get("unhealthySources", [])[:8]:
            detail = source.get("lastErrorMessage") or f"status {source.get('status')}"
            lines.append(f"- [{source.get('status')}] {source.get('resourceName') or source.get('source')}: {detail}")
    return "\n".join(lines)


def _post_teams_alert(report: Dict[str, Any]) -> Dict[str, Any]:
    base_url = (
        os.getenv("NEXT_PUBLIC_APP_URL")
        or os.getenv("APP_BASE_URL")
        or "https://projects.alleatogroup.com"
    ).rstrip("/")
    service_key = os.getenv("NOTIFICATION_SERVICE_KEY")
    user_id = os.getenv("RAG_HEALTH_ALERT_TEAMS_USER_ID", DEFAULT_ALERT_TEAMS_USER_ID)
    if not service_key:
        return {"status": "blocked", "channel": "teams", "reason": "NOTIFICATION_SERVICE_KEY not set"}
    try:
        response = httpx.post(
            f"{base_url}/api/bot/proactive/teams",
            headers={"Authorization": f"Bearer {service_key}"},
            json={"userId": user_id, "message": _teams_alert_text(report)},
            timeout=15,
        )
        if response.status_code >= 400:
            return {
                "status": "failed",
                "channel": "teams",
                "httpStatus": response.status_code,
                "detail": response.text[:300],
            }
        payload = response.json()
        return {
            "status": "sent" if payload.get("sent") else "blocked",
            "channel": "teams",
            "detail": payload.get("reason") or "sent",
        }
    except Exception as exc:
        return {"status": "failed", "channel": "teams", "error": str(exc)}


def _compact_alert(alert: Dict[str, Any]) -> Dict[str, Any]:
    return {
        "severity": alert.get("severity"),
        "code": alert.get("code"),
        "source": alert.get("source"),
        "resourceId": alert.get("resourceId"),
        "message": alert.get("message"),
        "detectedAt": alert.get("detectedAt"),
    }


def _trigger_remediation_task(report: Dict[str, Any]) -> Dict[str, Any]:
    """Optionally dispatch to an external task runner.

    Render gets the immediate failing cron and persisted Supabase alert either
    way. A webhook lets Trigger.dev/Codex/another cloud task runner attach later
    without changing health detection.
    """
    webhook_url = os.getenv("RAG_HEALTH_REMEDIATION_WEBHOOK_URL")
    if not webhook_url:
        return {"triggered": False, "reason": "RAG_HEALTH_REMEDIATION_WEBHOOK_URL not set"}

    headers = {"Content-Type": "application/json"}
    token = os.getenv("RAG_HEALTH_REMEDIATION_WEBHOOK_TOKEN")
    if token:
        headers["Authorization"] = f"Bearer {token}"

    payload = {
        "event": "rag_source_health_degraded",
        "repository": "MeganHarrison/alleato-pm",
        "branch": "main",
        "report": report,
    }
    response = httpx.post(webhook_url, headers=headers, json=payload, timeout=20)
    response.raise_for_status()
    return {"triggered": True, "statusCode": response.status_code}


def run_source_rag_health_check(*, trigger_remediation: bool = True) -> Dict[str, Any]:
    from src.services.ops.db_pressure_guard import enforce_app_db_pressure_guard

    enforce_app_db_pressure_guard("source_rag_health")

    supabase = get_supabase_client()
    health = get_source_sync_health(supabase)
    rag_lifecycle = _load_recent_rag_lifecycle_alerts(supabase)
    combined_alerts = [
        *health.get("alerts", []),
        *rag_lifecycle.get("alerts", []),
    ]

    snapshot_writes = 0
    for source in health.get("sources", [])[:25]:
        update_source_health_snapshot(supabase, source)
        snapshot_writes += 1

    # Only reserve notifications (stamp durable notified_at) when this run will
    # actually attempt Teams delivery. A non-delivering readback
    # (trigger_remediation=False) must not consume a reservation, otherwise the
    # next scheduled cron would see notified_at within RAG_HEALTH_RENOTIFY_HOURS
    # and silently throttle the first real degraded alert for up to that window.
    alert_result = persist_source_sync_alerts(
        supabase, combined_alerts, reserve_notifications=trigger_remediation
    )
    newly_notifiable = list(alert_result.get("notified") or [])

    watched_alerts: List[Dict[str, Any]] = [
        alert
        for alert in combined_alerts
        if str(alert.get("source") or "") in WATCHED_SOURCES
        or str(alert.get("source") or "") in {"meetings", "teams", "emails", "sharepoint"}
    ]
    critical_alerts = [alert for alert in watched_alerts if alert.get("severity") == "critical"]
    warning_alerts = [alert for alert in watched_alerts if alert.get("severity") == "warning"]
    unhealthy_sources = [
        source
        for source in health.get("sources", [])
        if str(source.get("source") or "") in WATCHED_SOURCES
        and source.get("status") in {"critical", "warning", "unknown"}
    ]
    passed = not critical_alerts and not warning_alerts and not unhealthy_sources and not rag_lifecycle.get("alerts")

    report = {
        "passed": passed,
        "status": "healthy" if passed else "degraded",
        "generatedAt": health.get("generatedAt"),
        "snapshotWrites": snapshot_writes,
        "alertPersistence": alert_result,
        "ragLifecycle": rag_lifecycle,
        "counts": health.get("counts", {}),
        "unhealthySources": [
            {
                "source": source.get("source"),
                "resourceId": source.get("resourceId"),
                "resourceName": source.get("resourceName"),
                "status": source.get("status"),
                "staleMinutes": source.get("staleMinutes"),
                "unembeddedCount": source.get("unembeddedCount"),
                "uncompiledCount": source.get("uncompiledCount"),
                "lastErrorMessage": source.get("lastErrorMessage"),
            }
            for source in unhealthy_sources[:20]
        ],
        "criticalAlerts": [_compact_alert(alert) for alert in critical_alerts[:20]],
        "warningAlerts": [_compact_alert(alert) for alert in warning_alerts[:20]],
        "recentRuns": health.get("recentRuns", [])[:10],
    }

    if not report["passed"] and trigger_remediation:
        # Throttle external delivery so the every-5-min cron stops flooding Teams
        # with identical "degraded" DMs while the same known issues persist:
        #  - deliver immediately when at least one discrete alert is new or
        #    re-armed past RAG_HEALTH_RENOTIFY_HOURS (per-alert reservation), and
        #  - otherwise consult a report-level digest reservation, which both
        #    covers degraded-but-no-alert-rows reports (so the first DM still
        #    fires) AND acts as a re-nag heartbeat at most once per window.
        # When a per-alert delivery happens we still stamp the digest so the
        # heartbeat clock resets and the next run does not double-post.
        digest_due = reserve_health_digest_notification(
            supabase, mark_notified=bool(newly_notifiable)
        )
        if newly_notifiable or digest_due:
            report["notification"] = _post_teams_alert(report)
        else:
            report["notification"] = {
                "status": "throttled",
                "channel": "teams",
                "reason": (
                    f"{len(combined_alerts)} active alert(s) and the degraded-health "
                    "digest were already notified within RAG_HEALTH_RENOTIFY_HOURS; "
                    "suppressing duplicate DM."
                ),
            }
        try:
            report["remediation"] = _trigger_remediation_task(report)
        except Exception as exc:
            report["remediation"] = {"triggered": False, "error": str(exc)}
    elif report["passed"]:
        # Recovery clears the digest so the next degradation episode notifies
        # immediately instead of waiting out the heartbeat window.
        resolve_health_digest_notification(supabase)
        report["notification"] = {"status": "skipped", "channel": "teams", "reason": "health passed"}

    report["newlyNotifiableAlerts"] = len(newly_notifiable)
    return report


def main() -> int:
    """Exit 0 whenever the check completes and produces a report.

    A degraded finding is a monitoring *result*, not a script failure — it is
    already delivered via `system_alerts` and the throttled Teams DM
    (`RAG_HEALTH_RENOTIFY_HOURS`). Render has no concept of "ran fine, found a
    real problem" vs. "the cron itself crashed": both surface as an identical
    unthrottled "server failure" email. Returning 1 for every degraded run
    reintroduces, via Render's own alerting, the exact flood that the Teams
    throttle (#98) was built to stop. An unhandled exception anywhere in
    `run_source_rag_health_check` (including a failed Teams delivery) still
    propagates and exits non-zero, so Render alerting is preserved for actual
    execution failures.
    """
    report = run_source_rag_health_check()
    print(json.dumps(report, indent=2, sort_keys=True))
    return 0


if __name__ == "__main__":
    sys.exit(main())
