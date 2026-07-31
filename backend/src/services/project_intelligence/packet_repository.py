"""Durable cumulative Product Intelligence packet findings.

``intelligence_packets`` is the current narrative read model and is replaced on
refresh. This module projects its structured summary into stable findings so a
timeline, risk, decision, opportunity, or unresolved question keeps identity,
first/last-seen lifecycle, and evidence lineage across refreshes.
"""
from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any, Dict, Iterable, List, Optional

ITEM_TYPES = {"timeline", "insight", "risk", "opportunity", "decision", "unresolved_question"}

# Keep the packet-item read contract explicit. `merge_item` needs the lifecycle
# and evidence fields to preserve finding identity across packet refreshes, and
# list callers receive the complete persisted row shape without a wildcard read.
PACKET_ITEM_COLUMNS = (
    "id,project_id,packet_id,executive_artifact_id,item_type,finding_key,title,"
    "detail,status,occurred_at,first_seen_at,last_seen_at,resolved_at,"
    "source_document_ids,source_evidence,metadata,created_at,updated_at"
)


def finding_key(item_type: str, title: str) -> str:
    """Return a deterministic key tolerant of punctuation/case changes."""
    value = re.sub(r"[^a-z0-9]+", "-", str(title or "").strip().lower()).strip("-")
    return f"{item_type}:{value[:220]}"


def _now() -> str:
    return datetime.now(timezone.utc).isoformat()


def _items(summary: Dict[str, Any], key: str, item_type: str) -> Iterable[Dict[str, Any]]:
    for raw in summary.get(key) or []:
        if not isinstance(raw, dict):
            continue
        title = str(raw.get("title") or raw.get("question") or raw.get("decision") or raw.get("risk") or "").strip()
        if title:
            yield {"item_type": item_type, "title": title, "detail": raw.get("summary") or raw.get("recommendedAction") or raw.get("reason") or raw.get("whyItMatters"), "source_ids": raw.get("sourceIds") or [], "occurred_at": raw.get("occurredAt"), "status": raw.get("status")}


def extract_packet_items(packet: Dict[str, Any]) -> List[Dict[str, Any]]:
    """Normalize the known packet summary shapes into cumulative findings."""
    summary = (packet.get("packet_json") or {}).get("summary") or packet.get("summary") or {}
    source_rows = {
        str(row.get("id")): row
        for row in ((packet.get("packet_json") or {}).get("sourceSet") or {}).get("sources") or []
        if isinstance(row, dict) and row.get("id")
    }
    result: List[Dict[str, Any]] = []
    for key, item_type in (("timeline", "timeline"), ("insights", "insight"), ("risks", "risk"), ("opportunities", "opportunity"), ("openDecisions", "decision"), ("unresolvedQuestions", "unresolved_question"), ("openQuestions", "unresolved_question")):
        result.extend(_items(summary, key, item_type))
    deduped: Dict[str, Dict[str, Any]] = {}
    for item in result:
        item["finding_key"] = finding_key(item["item_type"], item["title"])
        item["source_evidence"] = [source_rows[str(source_id)] for source_id in item.get("source_ids") or [] if str(source_id) in source_rows]
        deduped[item["finding_key"]] = item
    return list(deduped.values())


def merge_item(existing: Optional[Dict[str, Any]], incoming: Dict[str, Any], *, packet_id: str, project_id: int, now: Optional[str] = None, executive_artifact_id: Optional[str] = None) -> Dict[str, Any]:
    """Build an idempotent upsert payload, preserving lifecycle timestamps."""
    seen = now or _now()
    prior = existing or {}
    prior_status = prior.get("status") or "open"
    requested_status = incoming.get("status") or "open"
    status = "resolved" if requested_status == "resolved" else ("resolved" if prior_status == "resolved" else "open")
    resolved_at = prior.get("resolved_at")
    if status == "resolved" and not resolved_at:
        resolved_at = seen
    if status == "open":
        resolved_at = None
    source_ids = sorted(set((prior.get("source_document_ids") or []) + (incoming.get("source_ids") or [])))
    return {
        "project_id": project_id, "packet_id": packet_id,
        "executive_artifact_id": executive_artifact_id or prior.get("executive_artifact_id"),
        "item_type": incoming["item_type"], "finding_key": incoming["finding_key"],
        "title": incoming["title"], "detail": incoming.get("detail"), "status": status,
        "occurred_at": incoming.get("occurred_at") or prior.get("occurred_at"),
        "first_seen_at": prior.get("first_seen_at") or seen, "last_seen_at": seen, "resolved_at": resolved_at,
        "source_document_ids": source_ids, "source_evidence": incoming.get("source_evidence") or prior.get("source_evidence") or [],
        "metadata": {**(prior.get("metadata") or {}), **(incoming.get("metadata") or {})},
    }


def upsert_packet_items(client: Any, *, project_id: int, packet: Dict[str, Any], executive_artifact_id: Optional[str] = None, now: Optional[str] = None) -> Dict[str, Any]:
    """Upsert cumulative findings and return counts. Fails loudly on write errors."""
    packet_id = str(packet.get("id") or "")
    if not packet_id:
        raise ValueError("packet id is required for cumulative projection")
    incoming = extract_packet_items(packet)
    written = 0
    for item in incoming:
        existing = (
            client.table("project_intelligence_packet_items")
            .select(PACKET_ITEM_COLUMNS)
            .eq("project_id", project_id)
            .eq("item_type", item["item_type"])
            .eq("finding_key", item["finding_key"])
            .limit(1)
            .execute()
            .data
            or []
        )
        payload = merge_item(existing[0] if existing else None, item, packet_id=packet_id, project_id=project_id, now=now, executive_artifact_id=executive_artifact_id)
        if existing:
            client.table("project_intelligence_packet_items").update(payload).eq("id", existing[0]["id"]).execute()
        else:
            client.table("project_intelligence_packet_items").insert(payload).execute()
        written += 1
    return {"packet_id": packet_id, "project_id": project_id, "items_seen": len(incoming), "items_written": written}


def list_packet_items(client: Any, project_id: int, *, status: Optional[str] = None, limit: int = 200) -> List[Dict[str, Any]]:
    query = (
        client.table("project_intelligence_packet_items")
        .select(PACKET_ITEM_COLUMNS)
        .eq("project_id", project_id)
        .order("last_seen_at", desc=True)
        .limit(limit)
    )
    if status:
        query = query.eq("status", status)
    return query.execute().data or []

