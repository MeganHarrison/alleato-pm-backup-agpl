"""Canonical PM-app writers for source-linked Project Intelligence timeline rows."""

from __future__ import annotations

import re
from typing import Any, Dict, Optional

from src.services.ops.db_pressure_guard import enforce_pm_app_final_projection_guard


def _single_row(result: Any) -> Optional[Dict[str, Any]]:
    data = getattr(result, "data", None)
    if isinstance(data, list):
        return data[0] if data else None
    return data if isinstance(data, dict) else None


def _append_unique(values: Any, value: Any) -> list[Any]:
    result = list(values or [])
    if value is not None and value not in result:
        result.append(value)
    return result


def looks_like_change_event_signal(*, title: str, content: str, summary: str) -> bool:
    haystack = f"{title} {content} {summary}".lower()
    return bool(re.search(
        r"\b(change event|change order|pco|cco|scope change|cost exposure|extra work|delay claim|backcharge)\b",
        haystack,
    ))


def _timeline_event_type(signal_type: str) -> str:
    return {
        "decision": "decision",
        "risk": "risk",
        "blocker": "issue",
        "financial_exposure": "cost_exposure",
        "schedule_risk": "schedule_impact",
        "task": "progress_update",
        "project_update": "progress_update",
    }.get(signal_type, "document")


def _timeline_priority(signal_type: str) -> str:
    if signal_type in {"blocker", "schedule_risk", "financial_exposure"}:
        return "high"
    if signal_type in {"risk", "decision"}:
        return "medium"
    return "low"


def upsert_project_timeline_event(
    supabase: Any,
    *,
    project_id: int,
    source_synthesis: Dict[str, Any],
    signal: Dict[str, Any],
    document: Dict[str, Any],
    source_content: str,
    source_occurred_at: Optional[str],
    compiler_version: str,
    updated_at: str,
) -> Dict[str, Any]:
    signal_type = str(signal.get("signal_type") or "project_update")
    source_document_id = str(document["id"])
    is_change = looks_like_change_event_signal(
        title=str(document.get("title") or ""),
        content=source_content,
        summary=str(signal.get("summary") or ""),
    )
    existing = _single_row(
        supabase.table("project_intelligence_timeline_events")
        .select("id")
        .eq("project_id", int(project_id))
        .eq("source_document_id", source_document_id)
        .eq("source_synthesis_id", source_synthesis.get("id"))
        .limit(1)
        .execute()
    )
    payload = {
        "project_id": int(project_id),
        "event_at": source_occurred_at or updated_at,
        "event_type": "change_event_signal" if is_change else _timeline_event_type(signal_type),
        "title": signal.get("title") or document.get("title") or "Project update",
        "summary": signal.get("summary"),
        "why_it_matters": signal.get("why_it_matters"),
        "current_status": "needs_decision" if signal_type == "decision" else "monitoring",
        "owner_label": None,
        "priority": _timeline_priority(signal_type),
        "source_synthesis_id": source_synthesis.get("id"),
        "source_document_id": source_document_id,
        "related_event_ids": [],
        "related_record_type": "document_metadata",
        "related_record_id": source_document_id,
        "confidence": source_synthesis.get("confidence") or "unknown",
        "metadata": {
            "normalized_signal_key": signal.get("normalized_signal_key"),
            "source_family": source_synthesis.get("source_family"),
            "compiler_version": compiler_version,
        },
        "updated_at": updated_at,
    }
    enforce_pm_app_final_projection_guard(
        "project_intelligence_timeline_projection",
        row_counts={"project_intelligence_timeline_events": 1},
    )
    if existing:
        return _single_row(
            supabase.table("project_intelligence_timeline_events").update(payload).eq("id", existing["id"]).execute()
        ) or {**existing, **payload}
    return _single_row(supabase.table("project_intelligence_timeline_events").insert(payload).execute()) or payload


def upsert_timeline_event_source(
    supabase: Any,
    *,
    timeline_event: Dict[str, Any],
    source_synthesis: Dict[str, Any],
    document: Dict[str, Any],
    signal: Dict[str, Any],
    source_occurred_at: Optional[str],
    compiler_version: str,
) -> Dict[str, Any]:
    existing = _single_row(
        supabase.table("project_intelligence_timeline_event_sources")
        .select("id")
        .eq("timeline_event_id", timeline_event["id"])
        .eq("source_document_id", str(document["id"]))
        .limit(1)
        .execute()
    )
    payload = {
        "timeline_event_id": timeline_event["id"],
        "source_synthesis_id": source_synthesis.get("id"),
        "source_document_id": str(document["id"]),
        "source_family": source_synthesis.get("source_family"),
        "source_title": document.get("title"),
        "source_excerpt": signal.get("excerpt"),
        "source_url": source_synthesis.get("source_url"),
        "source_occurred_at": source_occurred_at,
        "confidence": source_synthesis.get("confidence") or "unknown",
        "metadata": {"compiler_version": compiler_version},
    }
    enforce_pm_app_final_projection_guard(
        "project_intelligence_timeline_source_projection",
        row_counts={"project_intelligence_timeline_event_sources": 1},
    )
    if existing:
        return _single_row(
            supabase.table("project_intelligence_timeline_event_sources").update(payload).eq("id", existing["id"]).execute()
        ) or {**existing, **payload}
    return _single_row(supabase.table("project_intelligence_timeline_event_sources").insert(payload).execute()) or payload


def upsert_change_event_candidate(
    supabase: Any,
    *,
    project_id: int,
    source_synthesis: Dict[str, Any],
    timeline_event: Dict[str, Any],
    signal: Dict[str, Any],
    document: Dict[str, Any],
    source_content: str,
    updated_at: str,
) -> Optional[Dict[str, Any]]:
    if not looks_like_change_event_signal(
        title=str(document.get("title") or ""),
        content=source_content,
        summary=str(signal.get("summary") or ""),
    ):
        return None
    title = f"Potential change: {signal.get('title') or document.get('title') or 'source update'}"[:180]
    existing = _single_row(
        supabase.table("change_event_candidates")
        .select("id,source_synthesis_ids,timeline_event_ids")
        .eq("project_id", int(project_id))
        .eq("title", title)
        .in_("status", ["candidate", "reviewing", "draft_created"])
        .limit(1)
        .execute()
    )
    payload = {
        "project_id": int(project_id),
        "title": title,
        "description": signal.get("summary"),
        "reason": "Source language suggests a potential scope, cost, schedule, or change-order exposure.",
        "potential_cost_impact": None,
        "potential_schedule_impact": None,
        "source_synthesis_ids": [source_synthesis.get("id")] if source_synthesis.get("id") else [],
        "timeline_event_ids": [timeline_event.get("id")] if timeline_event.get("id") else [],
        "confidence": source_synthesis.get("confidence") or "unknown",
        "missing_information": [
            "Confirm whether this is already covered by contract scope.",
            "Confirm cost and schedule impact before creating a formal change event.",
        ],
        "status": "candidate",
        "metadata": {
            "source_document_id": str(document["id"]),
            "normalized_signal_key": signal.get("normalized_signal_key"),
        },
        "updated_at": updated_at,
    }
    enforce_pm_app_final_projection_guard(
        "change_event_candidate_projection",
        row_counts={"change_event_candidates": 1},
    )
    if existing:
        payload["source_synthesis_ids"] = _append_unique(existing.get("source_synthesis_ids"), source_synthesis.get("id"))
        payload["timeline_event_ids"] = _append_unique(existing.get("timeline_event_ids"), timeline_event.get("id"))
        return _single_row(
            supabase.table("change_event_candidates").update(payload).eq("id", existing["id"]).execute()
        ) or {**existing, **payload}
    return _single_row(supabase.table("change_event_candidates").insert(payload).execute()) or payload
