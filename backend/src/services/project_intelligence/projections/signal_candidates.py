"""Canonical signal-candidate staging and promotion for project communications.

This module deliberately has no queue or packet-refresh behavior. Ingestion and
embedding must not trigger the retired per-document intelligence compiler.
"""

from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

from src.services.ops.db_pressure_guard import enforce_pm_app_final_projection_guard
from src.services.project_intelligence.validation import is_synthesized_signal
from src.services.supabase_helpers import get_rag_read_client, get_rag_write_client

ACTIVE_CARD_STATUSES = ("open", "blocked", "needs_review", "stale")
CONFIDENCE_RANK = {"low": 0, "medium": 1, "high": 2}
SIGNAL_CANDIDATE_COLUMNS = (
    "id,source_document_id,source_chunk_id,target_id,project_id,signal_type,"
    "title,summary,why_it_matters,current_status,confidence_score,confidence,"
    "status,suggested_owner_person_id,suggested_owner_label,next_action,"
    "stale_after,source_occurred_at,excerpt,normalized_signal_key,"
    "promoted_insight_card_id,extraction_json,compiler_version,created_at,updated_at"
)


def _utc_now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _single_row(response: Any) -> Optional[Dict[str, Any]]:
    data = getattr(response, "data", None) or []
    if isinstance(data, dict):
        return data
    return data[0] if data else None


def _metadata_dict(value: Any) -> Dict[str, Any]:
    return value if isinstance(value, dict) else {}


def _append_unique(values: Any, item: Any) -> List[Any]:
    result = list(values) if isinstance(values, list) else []
    if item is not None and item not in result:
        result.append(item)
    return result


def _confidence_label(score: float) -> str:
    if score >= 0.85:
        return "high"
    if score >= 0.60:
        return "medium"
    return "low"


def _max_confidence(left: Optional[str], right: Optional[str]) -> str:
    left_value = left if left in CONFIDENCE_RANK else "low"
    right_value = right if right in CONFIDENCE_RANK else "low"
    return left_value if CONFIDENCE_RANK[left_value] >= CONFIDENCE_RANK[right_value] else right_value


def _auto_attribution_status(confidence: str) -> str:
    return "auto_assigned" if confidence == "high" else "needs_review"


def _participants(document: Dict[str, Any]) -> List[str]:
    raw = document.get("participants") or document.get("participants_array")
    if isinstance(raw, list):
        return [str(item).strip() for item in raw if str(item or "").strip()]
    if isinstance(raw, str):
        return [part.strip() for part in re.split(r"[,;|]", raw) if part.strip()]
    metadata = _metadata_dict(document.get("metadata"))
    values = metadata.get("participants") or metadata.get("attendees") or []
    return [str(item).strip() for item in values if str(item or "").strip()] if isinstance(values, list) else []


def _fetch_source_document(client: Any, source_document_id: str) -> Dict[str, Any]:
    row = _single_row(
        client.table("document_metadata")
        .select("id,title,type,category,source,source_system,project_id,date,captured_at,created_at,participants,participants_array,source_metadata")
        .eq("id", source_document_id)
        .limit(1)
        .execute()
    )
    if not row:
        raise ValueError(f"document_metadata row not found: {source_document_id}")
    return row


def _fetch_candidate(candidate_id: str) -> Dict[str, Any]:
    row = _single_row(
        get_rag_read_client().table("source_signal_candidates")
        .select(SIGNAL_CANDIDATE_COLUMNS)
        .eq("id", candidate_id)
        .limit(1)
        .execute()
    )
    if not row:
        raise ValueError(f"source_signal_candidates row not found: {candidate_id}")
    return row


def write_source_signal_candidate(
    client: Any,
    *,
    source_document_id: str,
    signal_type: str,
    title: str,
    summary: str,
    confidence_score: float,
    normalized_signal_key: str,
    compiler_version: str,
    source_chunk_id: Optional[str] = None,
    target_id: Optional[str] = None,
    project_id: Optional[int] = None,
    why_it_matters: Optional[str] = None,
    current_status: str = "open",
    suggested_owner_person_id: Optional[str] = None,
    suggested_owner_label: Optional[str] = None,
    next_action: Optional[str] = None,
    stale_after: Optional[str] = None,
    source_occurred_at: Optional[str] = None,
    excerpt: Optional[str] = None,
    extraction_json: Optional[Dict[str, Any]] = None,
) -> Dict[str, Any]:
    del client
    bounded_score = max(0.0, min(1.0, float(confidence_score)))
    payload = {
        "source_document_id": source_document_id,
        "source_chunk_id": source_chunk_id,
        "target_id": target_id,
        "project_id": project_id,
        "signal_type": signal_type,
        "title": title,
        "summary": summary,
        "why_it_matters": why_it_matters,
        "current_status": current_status,
        "confidence_score": bounded_score,
        "confidence": _confidence_label(bounded_score),
        "status": "candidate" if bounded_score >= 0.85 else "needs_review",
        "suggested_owner_person_id": suggested_owner_person_id,
        "suggested_owner_label": suggested_owner_label,
        "next_action": next_action,
        "stale_after": stale_after,
        "source_occurred_at": source_occurred_at,
        "excerpt": excerpt,
        "normalized_signal_key": normalized_signal_key,
        "extraction_json": extraction_json or {},
        "compiler_version": compiler_version,
    }
    return _single_row(get_rag_write_client().table("source_signal_candidates").insert(payload).execute()) or payload


_SEVERITY_CARD_TYPES = {"risk", "schedule_risk", "financial_exposure", "blocker"}
_SEVERITY_IMPACT = {"low": 1, "medium": 3, "high": 5}
_SEVERITY_LIKELIHOOD = {"low": 0, "medium": 1, "high": 2}


def _derive_card_severity(candidate: Dict[str, Any]) -> Optional[int]:
    if candidate.get("signal_type") not in _SEVERITY_CARD_TYPES:
        return None
    raw = _metadata_dict(candidate.get("extraction_json"))
    explicit = raw.get("severity")
    if isinstance(explicit, (int, float)) and 1 <= explicit <= 5:
        return int(round(explicit))
    impact = _SEVERITY_IMPACT.get(str(raw.get("impact") or "").lower())
    if impact is None:
        return None
    likelihood = _SEVERITY_LIKELIHOOD.get(str(raw.get("likelihood") or "").lower(), 0)
    return max(1, min(5, impact + likelihood - 1))


def _find_card(client: Any, candidate: Dict[str, Any], compiler_version: str) -> Optional[Dict[str, Any]]:
    rows = getattr(
        client.table("insight_cards")
        .select("id,metadata,current_status,confidence,source_count")
        .eq("primary_target_id", candidate["target_id"])
        .eq("card_type", candidate["signal_type"])
        .eq("compiler_version", compiler_version)
        .in_("current_status", list(ACTIVE_CARD_STATUSES))
        .limit(20)
        .execute(),
        "data",
        None,
    ) or []
    key = candidate.get("normalized_signal_key")
    return next((row for row in rows if _metadata_dict(row.get("metadata")).get("normalized_signal_key") == key), None)


def _upsert_card(client: Any, candidate: Dict[str, Any], compiler_version: str) -> Dict[str, Any]:
    existing = _find_card(client, candidate, compiler_version)
    confidence = candidate.get("confidence") or _confidence_label(candidate.get("confidence_score") or 0)
    metadata = _metadata_dict((existing or {}).get("metadata"))
    metadata.update({
        "normalized_signal_key": candidate.get("normalized_signal_key"),
        "last_source_signal_candidate_id": candidate.get("id"),
        "source_signal_candidate_ids": _append_unique(metadata.get("source_signal_candidate_ids"), candidate.get("id")),
    })
    seen_at = candidate.get("source_occurred_at") or _utc_now()
    base = {
        "title": candidate["title"],
        "summary": candidate["summary"],
        "why_it_matters": candidate.get("why_it_matters"),
        "current_status": candidate.get("current_status") or (existing or {}).get("current_status") or "open",
        "suggested_owner_person_id": candidate.get("suggested_owner_person_id"),
        "suggested_owner_label": candidate.get("suggested_owner_label"),
        "next_action": candidate.get("next_action"),
        "last_seen_at": seen_at,
        "stale_after": candidate.get("stale_after"),
        "severity": _derive_card_severity(candidate),
        "metadata": metadata,
    }
    if existing:
        merged_confidence = _max_confidence(existing.get("confidence"), confidence)
        evidence = _single_row(
            client.table("insight_card_evidence").select("id")
            .eq("insight_card_id", existing["id"])
            .eq("source_document_id", candidate["source_document_id"])
            .limit(1).execute()
        )
        payload = {
            **base,
            "confidence": merged_confidence,
            "attribution_status": _auto_attribution_status(merged_confidence),
            "source_count": int(existing.get("source_count") or 0) + (0 if evidence else 1),
            "updated_at": _utc_now(),
        }
        return _single_row(client.table("insight_cards").update(payload).eq("id", existing["id"]).execute()) or {**existing, **payload}
    payload = {
        **base,
        "primary_target_id": candidate["target_id"],
        "card_type": candidate["signal_type"],
        "confidence": confidence,
        "attribution_status": _auto_attribution_status(confidence),
        "first_seen_at": seen_at,
        "occurred_at": seen_at,
        "source_count": 1,
        "compiler_version": compiler_version,
    }
    return _single_row(client.table("insight_cards").insert(payload).execute()) or payload


def _upsert_target_link(client: Any, card: Dict[str, Any], candidate: Dict[str, Any]) -> Dict[str, Any]:
    existing = _single_row(
        client.table("insight_card_targets").select("id")
        .eq("insight_card_id", card["id"]).eq("relationship", "primary").limit(1).execute()
    )
    confidence = candidate.get("confidence") or "low"
    payload = {
        "insight_card_id": card["id"],
        "target_id": candidate["target_id"],
        "relationship": "primary",
        "confidence": confidence,
        "attribution_status": _auto_attribution_status(confidence),
        "matched_terms": [],
        "reason": "Promoted by the canonical project communication projection.",
    }
    if existing:
        return _single_row(client.table("insight_card_targets").update(payload).eq("id", existing["id"]).execute()) or {**existing, **payload}
    return _single_row(client.table("insight_card_targets").insert(payload).execute()) or payload


def _upsert_evidence(client: Any, card: Dict[str, Any], candidate: Dict[str, Any], document: Dict[str, Any]) -> Dict[str, Any]:
    existing = _single_row(
        client.table("insight_card_evidence").select("id")
        .eq("insight_card_id", card["id"])
        .eq("source_document_id", candidate["source_document_id"])
        .limit(1).execute()
    )
    payload = {
        "insight_card_id": card["id"],
        "source_document_id": candidate.get("source_document_id"),
        "source_chunk_id": candidate.get("source_chunk_id"),
        "source_type": document.get("category") or document.get("source"),
        "source_title": document.get("title"),
        "source_occurred_at": candidate.get("source_occurred_at") or document.get("date"),
        "source_message_id": _metadata_dict(document.get("source_metadata")).get("message_id"),
        "participants": _participants(document),
        "excerpt": candidate.get("excerpt"),
        "summary": candidate.get("summary"),
        "relevance_reason": candidate.get("why_it_matters"),
        "evidence_role": "primary",
        "confidence": candidate.get("confidence") or "low",
    }
    if existing:
        return _single_row(client.table("insight_card_evidence").update(payload).eq("id", existing["id"]).execute()) or {**existing, **payload}
    return _single_row(client.table("insight_card_evidence").insert(payload).execute()) or payload


def promote_signal_candidate(client: Any, candidate_id: str, *, compiler_version: str) -> Dict[str, Any]:
    candidate = _fetch_candidate(candidate_id)
    if candidate.get("status") == "promoted" and candidate.get("promoted_insight_card_id"):
        return {"status": "skipped", "reason": "source signal candidate already promoted", "insight_card_id": candidate["promoted_insight_card_id"]}
    if not candidate.get("target_id") or not is_synthesized_signal(candidate):
        reason = "missing target_id" if not candidate.get("target_id") else "unsynthesized_signal"
        get_rag_write_client().table("source_signal_candidates").update({
            "status": "needs_review",
            "extraction_json": {**_metadata_dict(candidate.get("extraction_json")), "promotion_error": reason},
            "updated_at": _utc_now(),
        }).eq("id", candidate_id).execute()
        return {"status": "needs_review", "reason": reason, "signal_candidate_id": candidate_id}

    document = _fetch_source_document(client, candidate["source_document_id"])
    enforce_pm_app_final_projection_guard(
        "project_communication_signal_promotion",
        row_counts={"insight_cards": 1, "insight_card_targets": 1, "insight_card_evidence": 1},
    )
    card = _upsert_card(client, candidate, compiler_version)
    link = _upsert_target_link(client, card, candidate)
    evidence = _upsert_evidence(client, card, candidate, document)
    updated = _single_row(
        get_rag_write_client().table("source_signal_candidates")
        .update({"status": "promoted", "promoted_insight_card_id": card["id"], "updated_at": _utc_now()})
        .eq("id", candidate_id).execute()
    ) or candidate
    return {
        "status": "promoted",
        "signal_candidate_id": updated.get("id"),
        "insight_card_id": card.get("id"),
        "target_link_id": link.get("id"),
        "evidence_id": evidence.get("id"),
        "packet_refresh_job_id": None,
    }
