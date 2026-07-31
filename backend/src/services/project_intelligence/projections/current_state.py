"""Project Intelligence rolling current-state projection.

This is the synthesis layer the redesign called for and that was never built:
*"read the last synthesized state + only the raw docs added since last refresh ->
one bounded synthesis pass -> a coherent rolling project-state packet."*

It is deliberately NOT the per-document fragment extractor (that is
``project_synthesizer.py``, which writes ``insight_cards`` — the evidence/timeline
log). This module reads those same raw documents but produces ONE coherent
``intelligence_packets`` row that reads like a sharp PM/advisor wrote it.

Flow (``refresh_project_intelligence``):
  1. Resolve/create the project's intelligence target.
  2. Load the PRIOR synthesized packet (compiler_version
     ``project_intelligence_synthesis_v1``) -> prior state + rolling watermark.
  3. Compute the delta window ``since`` from the prior watermark (or a lookback
     on first run / ``force_full``).
  4. Load the raw text of the comms added since ``since`` (from the RAG DB, where
     the real body lives), bounded to ``MAX_SYNTH_CHARS``.
  5. Build a deterministic structured snapshot (budget / RFIs / change events) —
     GROUND TRUTH the model must not invent.
  6. ONE project-intelligence model synthesis pass -> a coherent executive read.
  7. Anti-hallucination: drop fabricated source cites; RAISE on a silent LLM
     failure (never write an empty packet — incident_openai_quota_backend_ai_down).
  8. Write ``intelligence_packets`` with ``packet_json.summary`` keyed exactly as
     the project page renders (zero frontend change).

Reuses, never duplicates:
  - project_intelligence.targets.ensure_client_project_target
  - intelligence.client.extract_with_retry / MODEL_PROJECT_INTELLIGENCE
  - project_synthesizer._classify_comm_type / ._participants
  - supabase_helpers.fetch_optional_row / get_rag_read_client / get_supabase_client
"""

from __future__ import annotations

import logging
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ...supabase_helpers import (
    fetch_optional_row,
    get_rag_read_client,
    get_supabase_client,
)
from ...ops.db_pressure_guard import enforce_pm_app_final_projection_guard
from ...pipeline.model_usage import ModelUsageContext
from ...pipeline.source_processing import SourceProcessingContext, record_source_processing_status
from ...intelligence.client import extract_with_retry
from ...pipeline.config import MODEL_PROJECT_INTELLIGENCE
from ..targets import ensure_client_project_target
from .project_communications import _classify_comm_type, _participants

logger = logging.getLogger(__name__)

# Namespacing for the synthesis packets. Distinct from the fragment extractor
# (`project_synthesizer_v1`) and the legacy operating-summary compiler so the
# rolling state dedups among itself and the page can pick the latest synthesis.
SYNTHESIS_COMPILER_VERSION = "project_intelligence_synthesis_v1"

# First-run / force_full lookback when there is no prior packet to roll from.
DEFAULT_LOOKBACK_DAYS = 30

# Hard ceiling on the total raw characters fed to one synthesis pass. Keeps the
# single LLM call within the request timeout and context budget. When exceeded we
# keep the MOST RECENT docs (the delta that matters) and mark truncated=True.
MAX_SYNTH_CHARS = 220_000

# Per-document raw-text cap so one enormous transcript can't crowd out every
# other doc in the window.
MAX_DOC_CHARS = 40_000

# 1-5 numeric severity (model output) -> page-facing severity label.
_SEVERITY_LABELS = {5: "critical", 4: "high", 3: "medium", 2: "low", 1: "low"}


def _utc_now_iso() -> str:
    return datetime.now(timezone.utc).isoformat()


def _coalesce_doc_date(doc: Dict[str, Any]) -> Optional[str]:
    return (
        doc.get("date")
        or doc.get("captured_at")
        or doc.get("last_content_loaded_at")
        or doc.get("last_indexed_at")
        or doc.get("last_synced_at")
        or doc.get("updated_at")
        or doc.get("created_at")
    )


def _doc_date_sort_key(doc: Dict[str, Any]) -> datetime:
    value = _coalesce_doc_date(doc)
    if not value:
        return datetime.min.replace(tzinfo=timezone.utc)
    try:
        text = str(value).replace("Z", "+00:00")
        parsed = datetime.fromisoformat(text)
        return parsed if parsed.tzinfo else parsed.replace(tzinfo=timezone.utc)
    except ValueError:
        return datetime.min.replace(tzinfo=timezone.utc)


def _severity_label(value: Any) -> str:
    """Map a 1-5 numeric severity (or a passthrough string) to the page label."""
    if isinstance(value, (int, float)):
        return _SEVERITY_LABELS.get(int(round(value)), "medium")
    text = str(value or "").strip().lower()
    if text in {"critical", "high", "medium", "low"}:
        return text
    return "medium"


def _money(value: Any) -> Optional[str]:
    try:
        return f"${float(value):,.0f}"
    except (TypeError, ValueError):
        return None


def _count_rows(client: Any, table: str, project_id: int, **filters: Any) -> Optional[int]:
    """Best-effort exact count; returns None if the table/column doesn't exist."""
    try:
        query = client.table(table).select("id", count="exact").eq("project_id", int(project_id))
        for column, value in filters.items():
            query = query.eq(column, value)
        resp = query.limit(1).execute()
        return getattr(resp, "count", None)
    except Exception as exc:  # noqa: BLE001 — a missing table is not fatal to synthesis
        logger.debug("[ProjectIntelligence] count %s failed (project=%s): %s", table, project_id, exc)
        return None


def build_structured_snapshot(client: Any, project_id: int) -> Dict[str, Any]:
    """Deterministic ground-truth numbers for the project.

    These are the NUMBERS the model is forbidden from inventing. Everything here
    is a direct DB read; anything unavailable is reported as unavailable (never
    guessed). Acumatica AR/overdue is intentionally left to the frontend brief
    (the backend has no Acumatica client) and surfaced here as 'not available in
    this run' so the model says so rather than fabricating cash figures.
    """
    snapshot: Dict[str, Any] = {"project_id": int(project_id)}

    project = fetch_optional_row(
        client, "projects", "id,name,budget,budget_used,phase,stage", "id", int(project_id)
    )
    if project:
        snapshot["project_name"] = project.get("name")
        snapshot["budget"] = project.get("budget")
        snapshot["budget_used"] = project.get("budget_used")
        snapshot["phase"] = project.get("phase")
        snapshot["stage"] = project.get("stage")

    snapshot["open_rfis"] = _count_rows(client, "rfis", project_id, status="open")
    snapshot["total_rfis"] = _count_rows(client, "rfis", project_id)
    snapshot["open_change_events"] = _count_rows(client, "change_events", project_id, status="open")
    snapshot["total_change_events"] = _count_rows(client, "change_events", project_id)
    return snapshot


def _render_snapshot_text(snapshot: Dict[str, Any]) -> str:
    """Compact ground-truth block for the prompt."""
    lines: List[str] = []
    budget = _money(snapshot.get("budget"))
    used = _money(snapshot.get("budget_used"))
    if budget:
        pct = ""
        try:
            b = float(snapshot.get("budget") or 0)
            u = float(snapshot.get("budget_used") or 0)
            if b > 0:
                pct = f" ({u / b * 100:.0f}% used)"
        except (TypeError, ValueError):
            pct = ""
        lines.append(f"- Budget: {budget} total, {used or '$0'} used{pct}")
    if snapshot.get("phase") or snapshot.get("stage"):
        lines.append(f"- Phase/stage: {snapshot.get('phase') or '-'} / {snapshot.get('stage') or '-'}")
    if snapshot.get("total_rfis") is not None:
        lines.append(f"- RFIs: {snapshot.get('open_rfis') or 0} open of {snapshot.get('total_rfis') or 0} total")
    if snapshot.get("total_change_events") is not None:
        lines.append(
            f"- Change events: {snapshot.get('open_change_events') or 0} open of "
            f"{snapshot.get('total_change_events') or 0} total"
        )
    lines.append("- Acumatica AR / overdue: not available in this run (do NOT invent cash figures)")
    return "\n".join(lines) if lines else "(no structured numbers available — do not invent any)"


def _load_prior_packet(client: Any, target_id: str) -> Optional[Dict[str, Any]]:
    rows = (
        client.table("intelligence_packets")
        .select("id,packet_json,covered_end_at,generated_at,executive_summary")
        .eq("target_id", target_id)
        .eq("compiler_version", SYNTHESIS_COMPILER_VERSION)
        .order("generated_at", desc=True)
        .limit(1)
        .execute()
        .data
        or []
    )
    return rows[0] if rows else None


def _prior_state_text(prior: Optional[Dict[str, Any]]) -> str:
    """Render the prior synthesized packet as compact text the model carries forward."""
    if not prior:
        return "(no prior synthesized state — this is the first synthesis pass for this project)"
    pj = prior.get("packet_json") or {}
    summary = pj.get("summary") if isinstance(pj, dict) else {}
    summary = summary if isinstance(summary, dict) else {}
    parts: List[str] = []
    exec_read = summary.get("currentExecutiveRead") or prior.get("executive_summary")
    if exec_read:
        parts.append(f"PRIOR EXECUTIVE READ:\n{exec_read}")
    for key, label in (("risks", "PRIOR RISKS"), ("openDecisions", "PRIOR OPEN DECISIONS")):
        items = summary.get(key)
        if isinstance(items, list) and items:
            rendered = "\n".join(
                f"- {it.get('title')}" for it in items[:8] if isinstance(it, dict) and it.get("title")
            )
            if rendered:
                parts.append(f"{label}:\n{rendered}")
    return "\n\n".join(parts) or "(prior packet had no structured state)"


def _load_delta_docs(
    client: Any,
    rag_read: Any,
    project_id: int,
    since: str,
) -> Dict[str, Any]:
    """Load raw text of comms (email/teams/meeting) added since `since`.

    Returns {docs: [...], truncated: bool, total_chars: int, max_doc_date: str|None}.
    Meetings ARE included here (unlike the fragment extractor, which skips them to
    avoid double-writing cards) — synthesis must read the full communication
    record, and it only READS, it does not write per-doc signals.
    """
    rows = (
        rag_read.table("rag_document_metadata")
        .select(
            "id,app_document_id,project_id,source,source_system,source_item_id,"
            "fireflies_id,title,type,category,source_web_url,url,storage_bucket,"
            "storage_path,file_name,content,raw_text,summary,overview,content_hash,"
            "last_synced_at,last_content_loaded_at,last_indexed_at,created_at,updated_at"
        )
        .eq("project_id", int(project_id))
        .or_(
            "last_content_loaded_at.gte.{since},last_indexed_at.gte.{since},"
            "last_synced_at.gte.{since},updated_at.gte.{since},created_at.gte.{since}".format(
                since=since
            )
        )
        .order("last_content_loaded_at", desc=True, nullsfirst=False)
        .limit(160)
        .execute()
        .data
        or []
    )

    docs: List[Dict[str, Any]] = []
    total_chars = 0
    truncated = False
    max_doc_date: Optional[str] = None

    rows = sorted(rows, key=_doc_date_sort_key, reverse=True)

    # Keep the most-recent source rows first. If one row no longer fits, skip it
    # instead of stopping the scan so a large transcript cannot hide newer/smaller
    # emails or Teams messages that still fit inside the remaining budget.
    for doc in rows:
        comm_type = _classify_comm_type(doc)
        if comm_type is None:
            continue
        doc_id = doc.get("id")
        full_text = (
            doc.get("content")
            or doc.get("raw_text")
            or doc.get("summary")
            or doc.get("overview")
            or ""
        ).strip()
        if not full_text:
            continue
        if len(full_text) > MAX_DOC_CHARS:
            full_text = full_text[:MAX_DOC_CHARS] + "\n…[truncated]"
        if total_chars + len(full_text) > MAX_SYNTH_CHARS:
            truncated = True
            continue
        total_chars += len(full_text)
        doc_date = _coalesce_doc_date(doc)
        if doc_date and (max_doc_date is None or str(doc_date) > max_doc_date):
            max_doc_date = str(doc_date)
        docs.append(
            {
                "id": doc_id,
                "comm_type": comm_type,
                "title": doc.get("title") or "Untitled",
                "date": doc_date,
                "category": doc.get("category"),
                "type": doc.get("type"),
                "participants": _participants(doc),
                "source": doc.get("source"),
                "source_system": doc.get("source_system"),
                "source_item_id": doc.get("source_item_id"),
                "fireflies_id": doc.get("fireflies_id"),
                "source_web_url": doc.get("source_web_url") or doc.get("url"),
                "source_path": doc.get("storage_path"),
                "storage_bucket": doc.get("storage_bucket"),
                "app_document_id": doc.get("app_document_id"),
                "content_hash": doc.get("content_hash"),
                "project_id": doc.get("project_id"),
                "text": full_text,
            }
        )

    # Present oldest-first to the model so it reads the period in order.
    docs.reverse()
    return {
        "docs": docs,
        "truncated": truncated,
        "total_chars": total_chars,
        "max_doc_date": max_doc_date,
    }


def _source_coverage_for_docs(docs: List[Dict[str, Any]], *, truncated: bool, latest_source_at: str) -> Dict[str, Any]:
    counts: Dict[str, int] = {}
    category_latest: Dict[str, Optional[str]] = {}
    for doc in docs:
        category = str(doc.get("comm_type") or doc.get("category") or doc.get("type") or "document")
        counts[category] = counts.get(category, 0) + 1
        doc_date = doc.get("date")
        if doc_date and (category_latest.get(category) is None or str(doc_date) > str(category_latest[category])):
            category_latest[category] = str(doc_date)

    return {
        "deltaDocCount": len(docs),
        "sourceIds": [doc["id"] for doc in docs if doc.get("id")],
        "sourceCounts": counts,
        "truncated": truncated,
        "latestSourceAt": latest_source_at,
        "categoryCoverage": [
            {
                "category": category,
                "label": category.replace("_", " ").title(),
                "availableCount": count,
                "sourceCount": count,
                "inPacketCount": count,
                "latestAt": category_latest.get(category),
                "tableNames": ["rag_document_metadata"],
            }
            for category, count in sorted(counts.items())
        ],
    }


_SYNTHESIS_SYSTEM = (
    "You are a sharp construction project executive briefing the firm's owner. "
    "You synthesize — you do NOT list cards. You reason across the material to "
    "produce one coherent, current read of a single project. Respond with a single "
    "JSON object and nothing else."
)


def _build_synthesis_messages(
    *,
    project_name: str,
    today: str,
    prior_state: str,
    snapshot_text: str,
    docs: List[Dict[str, Any]],
) -> List[Dict[str, str]]:
    if docs:
        doc_blocks = []
        for doc in docs:
            participants = ", ".join(doc.get("participants") or []) or "unknown"
            doc_blocks.append(
                f"--- SOURCE id={doc['id']} | {doc['comm_type']} | {doc.get('date') or 'no date'} "
                f"| {doc['title']} | participants: {participants} ---\n{doc['text']}"
            )
        new_material = "\n\n".join(doc_blocks)
    else:
        new_material = "(no new communications since the last synthesis)"

    user = f"""Project: {project_name}
Today: {today}

You are given THREE inputs:

1) PRIOR SYNTHESIZED STATE (may be empty on the first run):
{prior_state}

2) CURRENT HARD NUMBERS — GROUND TRUTH, never alter or invent beyond these:
{snapshot_text}

3) NEW RAW COMMUNICATIONS since the last synthesis (full meeting transcripts /
   email threads / Teams). Each block is prefixed with its source id:
{new_material}

Produce an UPDATED, COHERENT executive read of THIS project. Reason across the
material: what is the real story, what changed and why it matters, where is the
money / schedule / risk, what decisions are open, what should the owner do.
Carry forward still-relevant prior state; supersede what the new material
changes; drop what is resolved. Prefer fewer, sharper items over many weak ones.
If nothing material changed, say so plainly.

Output EXACTLY this JSON shape:
{{
 "executiveRead": "2-4 sentences: the state of this project in plain, sharp language",
 "whatChanged": [{{"point":"...","whyItMatters":"...","evidence":"verbatim quote","sourceId":"the source id"}}],
 "risks": [{{"risk":"...","reasoning":"why this is a risk and what it threatens","severity":1-5,"evidence":"verbatim quote","sourceId":"the source id"}}],
 "openDecisions": [{{"decision":"...","owner":"name or null","neededBy":"when or null","evidence":"verbatim quote","sourceId":"the source id"}}],
 "financialPosition": "interpret the numbers — what they mean, not just restate them; say plainly if data is thin",
 "scheduleAndProcurement": "one short read on schedule/procurement status, or '' if nothing in the material",
 "recommendedActions": [{{"action":"specific, do-this-today","why":"...","priority":"high|medium"}}],
 "confidence": "high|medium|low"
}}

Rules: every whatChanged / risk / openDecision MUST cite a verbatim evidence quote
and the REAL source id it came from (copy the id exactly from the SOURCE header).
Never invent a source id. Never invent financial numbers."""

    return [
        {"role": "system", "content": _SYNTHESIS_SYSTEM},
        {"role": "user", "content": user},
    ]


def synthesize_project_state(
    *,
    project_name: str,
    project_id: int | None = None,
    prior_state: str,
    snapshot_text: str,
    docs: List[Dict[str, Any]],
    model: Optional[str] = None,
    timeout: int = 300,
) -> Dict[str, Any]:
    """One synthesis pass. Returns the raw parsed model dict (with
    ``_extraction_failed`` when the provider call failed — the caller RAISES on
    that rather than writing a silent empty packet)."""
    messages = _build_synthesis_messages(
        project_name=project_name,
        today=datetime.now(timezone.utc).date().isoformat(),
        prior_state=prior_state,
        snapshot_text=snapshot_text,
        docs=docs,
    )
    return extract_with_retry(
        messages,
        model=model or MODEL_PROJECT_INTELLIGENCE,
        timeout=timeout,
        usage_context=ModelUsageContext(
            stage="project_intelligence_updated",
            operation="synthesize_project_state",
            project_id=project_id,
            metadata={"project_name": project_name, "doc_count": len(docs)},
        ),
    )


def _clean_items(value: Any) -> List[Dict[str, Any]]:
    return [item for item in (value or []) if isinstance(item, dict)]


def _valid_cites(source_id: Any, valid_ids: set) -> List[str]:
    """Filter a single sourceId to the set of real delta doc ids (anti-hallucination)."""
    if not source_id:
        return []
    sid = str(source_id).strip()
    # Tolerate a `document_metadata:` prefix the model might echo.
    bare = sid.split(":", 1)[-1] if sid.startswith("document_metadata:") else sid
    return [bare] if bare in valid_ids else []


def _map_to_packet_summary(
    raw: Dict[str, Any],
    *,
    valid_ids: set,
    snapshot: Dict[str, Any],
) -> Dict[str, Any]:
    """Map the model output to the `packet_json.summary` shape the page renders.

    Page keys (verified against page.tsx): currentExecutiveRead, immediateAttention,
    currentFocus, risks, openDecisions, recommendedActions, whatChanged, timeline,
    financialPosition{summary}, scheduleAndProcurement{summary}.
    """
    fabricated = 0

    def cites(item: Dict[str, Any]) -> List[str]:
        nonlocal fabricated
        valid = _valid_cites(item.get("sourceId"), valid_ids)
        if item.get("sourceId") and not valid:
            fabricated += 1
        return valid

    what_changed = []
    for it in _clean_items(raw.get("whatChanged")):
        title = (it.get("point") or "").strip()
        if not title:
            continue
        what_changed.append(
            {"title": title, "impact": (it.get("whyItMatters") or "").strip(), "sourceIds": cites(it)}
        )

    risks = []
    for it in _clean_items(raw.get("risks")):
        title = (it.get("risk") or "").strip()
        if not title:
            continue
        risks.append(
            {
                "title": title,
                "severity": _severity_label(it.get("severity")),
                "recommendedAction": (it.get("reasoning") or "").strip(),
                "sourceIds": cites(it),
            }
        )

    open_decisions = []
    for it in _clean_items(raw.get("openDecisions")):
        title = (it.get("decision") or "").strip()
        if not title:
            continue
        owner = it.get("owner")
        open_decisions.append(
            {
                "title": title,
                "owner": owner if isinstance(owner, str) and owner.strip() else None,
                "neededBy": (it.get("neededBy") or None) if isinstance(it.get("neededBy"), str) else None,
                "sourceIds": cites(it),
            }
        )

    recommended_actions = []
    for it in _clean_items(raw.get("recommendedActions")):
        title = (it.get("action") or "").strip()
        if not title:
            continue
        priority = str(it.get("priority") or "medium").strip().lower()
        if priority not in {"high", "medium", "low"}:
            priority = "medium"
        recommended_actions.append(
            {"title": title, "reason": (it.get("why") or "").strip(), "priority": priority, "sourceIds": []}
        )

    # currentFocus = the live management surface: top risks framed for action.
    current_focus = [
        {
            "title": r["title"],
            "summary": r["recommendedAction"],
            "status": None,
            "owner": None,
            "nextDecision": None,
            "riskSeverity": r["severity"],
            "sourceIds": r["sourceIds"],
        }
        for r in risks[:5]
    ]

    # immediateAttention = highest-severity risks + high-priority actions.
    immediate = [
        {"title": r["title"], "detail": r["recommendedAction"], "priority": r["severity"], "sourceIds": r["sourceIds"]}
        for r in risks
        if r["severity"] in {"critical", "high"}
    ][:4]
    immediate += [
        {"title": a["title"], "detail": a["reason"], "priority": a["priority"], "sourceIds": a["sourceIds"]}
        for a in recommended_actions
        if a["priority"] == "high"
    ]
    immediate = immediate[:5]

    # timeline = what-changed rendered as dated events.
    timeline = [
        {"title": wc["title"], "significance": wc["impact"], "sourceIds": wc["sourceIds"]}
        for wc in what_changed
    ]

    financial_text = (raw.get("financialPosition") or "").strip()
    schedule_text = (raw.get("scheduleAndProcurement") or "").strip()

    summary = {
        "schema": SYNTHESIS_COMPILER_VERSION,
        "currentExecutiveRead": (raw.get("executiveRead") or "").strip(),
        "immediateAttention": immediate,
        "currentFocus": current_focus,
        "risks": risks,
        "openDecisions": open_decisions,
        "recommendedActions": recommended_actions,
        "whatChanged": what_changed,
        "timeline": timeline,
        "financialPosition": {"summary": financial_text, "sourceIds": []},
        "scheduleAndProcurement": {"summary": schedule_text, "sourceIds": []},
        "confidence": str(raw.get("confidence") or "medium").strip().lower(),
        "fabricatedCiteCount": fabricated,
    }
    return summary


def refresh_project_intelligence(
    project_id: int,
    *,
    force_full: bool = False,
    dry_run: bool = False,
    since: Optional[str] = None,
    model: Optional[str] = None,
) -> dict:
    """L2 rolling-state synthesis for one project.

    Reads the prior synthesized packet + the raw comms added since + the hard
    numbers, runs ONE synthesis pass, and (unless ``dry_run``) writes a single
    ``intelligence_packets`` row that the project page renders directly.

    RAISES on a silent LLM failure (Pitfall 1) — never writes an empty packet.
    """
    client = get_supabase_client()
    rag_read = get_rag_read_client()

    target = ensure_client_project_target(
        client, int(project_id), compiler_version=SYNTHESIS_COMPILER_VERSION
    )
    target_id = target.get("id")
    project_name = target.get("name") or f"Project {project_id}"
    if not target_id:
        raise RuntimeError(f"could not resolve intelligence target for project {project_id}")

    prior = _load_prior_packet(client, target_id)

    if since:
        effective_since = since
    elif prior and prior.get("covered_end_at") and not force_full:
        effective_since = str(prior["covered_end_at"])
    else:
        effective_since = (datetime.now(timezone.utc) - timedelta(days=DEFAULT_LOOKBACK_DAYS)).isoformat()

    delta = _load_delta_docs(client, rag_read, int(project_id), effective_since)
    docs = delta["docs"]

    result: Dict[str, Any] = {
        "project_id": int(project_id),
        "target_id": target_id,
        "since": effective_since,
        "docs_in_window": len(docs),
        "truncated": delta["truncated"],
        "total_chars": delta["total_chars"],
        "dry_run": dry_run,
        "had_prior": bool(prior),
    }

    # COST GUARD — the whole point of rolling-state: only pay to re-synthesize
    # when new material actually landed. If a prior packet exists and nothing
    # arrived since its watermark, the prior packet is still current — skip the
    # (expensive frontier gpt-5.5) pass entirely. Without this, the 2-hourly
    # sweep would re-run a full reasoning pass on every quiet project, burning
    # money for zero change. (dry_run still runs so a human can inspect; force_full
    # always re-synthesizes.)
    if prior and not docs and not force_full and not dry_run:
        result["skipped_no_new_docs"] = True
        result["packet_id"] = prior.get("id")
        result["covered_end_at"] = prior.get("covered_end_at")
        logger.info(
            "[ProjectIntelligence] project=%s — no new docs since %s; skipping synthesis (packet unchanged)",
            project_id, effective_since,
        )
        return result

    snapshot = build_structured_snapshot(client, int(project_id))
    snapshot_text = _render_snapshot_text(snapshot)
    valid_ids = {d["id"] for d in docs}

    raw = synthesize_project_state(
        project_name=project_name,
        project_id=int(project_id),
        prior_state=_prior_state_text(prior),
        snapshot_text=snapshot_text,
        docs=docs,
        model=model,
    )

    # Pitfall 1: a failed provider call returns _extraction_failed=True. RAISE —
    # never write a silent empty packet (this is the bug that hid backend AI death).
    if raw.get("_extraction_failed"):
        errors = raw.get("_errors") or ["unknown LLM failure"]
        logger.error(
            "[ProjectIntelligence] synthesis LLM FAILED (project=%s): %s", project_id, errors
        )
        raise RuntimeError(f"synthesis LLM failed for project {project_id}: {errors}")

    summary = _map_to_packet_summary(raw, valid_ids=valid_ids, snapshot=snapshot)
    result["fabricated_cites_dropped"] = summary.get("fabricatedCiteCount", 0)
    result["confidence"] = summary.get("confidence")

    covered_end_at = delta["max_doc_date"] or effective_since
    generated_at = _utc_now_iso()

    source_set = {
        "projectId": int(project_id),
        "projectName": project_name,
        "generatedAt": generated_at,
        "sources": [
            {
                "id": d["id"],
                "text": d["title"],
                "type": d.get("type") or "other",
                "title": d["title"],
                "category": d.get("category") or d["comm_type"],
                "sourceUrl": d.get("source_web_url"),
                "capturedAt": d.get("date"),
            }
            for d in docs
        ],
    }

    packet_json = {
        "schema": SYNTHESIS_COMPILER_VERSION,
        "target": {
            "id": target_id,
            "name": project_name,
            "targetType": target.get("target_type"),
            "projectId": int(project_id),
        },
        "summary": summary,
        "sourceSet": source_set,
        "generatedAt": generated_at,
    }

    if dry_run:
        result["synthesized"] = summary
        result["snapshot"] = snapshot
        result["sample_sources"] = [d["id"] for d in docs[:8]]
        logger.info(
            "[ProjectIntelligence] DRY-RUN project=%s docs=%d fabricated_cites=%d confidence=%s",
            project_id, len(docs), result["fabricated_cites_dropped"], result["confidence"],
        )
        return result

    # Confidence is calibrated from how well-grounded this read is — cited-source
    # count + whether the model tried to fabricate citations — capped by the model's
    # own self-assessment. (Previously every packet shipped a flat "medium".)
    cited_sources = len((packet_json.get("sourceSet") or {}).get("sources") or [])
    fabricated = int(result.get("fabricated_cites_dropped") or 0)
    if cited_sources >= 12 and fabricated <= 1:
        _derived = "high"
    elif cited_sources <= 3 or fabricated > 3:
        _derived = "low"
    else:
        _derived = "medium"
    # The model's own confidence is uselessly flat ("medium" on every run), so the
    # grounding-derived value drives it — but still honor a genuine model "low".
    _llm = (summary.get("confidence") or "medium").lower()
    overall_confidence = "low" if _llm == "low" else _derived
    confidence_summary = {
        "overall": overall_confidence,
        "reason": (
            f"Grounded in {cited_sources} cited source{'' if cited_sources == 1 else 's'}"
            + (f"; {fabricated} unverifiable citation(s) dropped" if fabricated else "")
            + (f"; {len(docs)} new this run." if docs else "; no new source docs this run.")
        ),
    }
    source_coverage = _source_coverage_for_docs(
        docs,
        truncated=bool(delta["truncated"]),
        latest_source_at=covered_end_at,
    )

    # Distinct fields: current_status = the single most important current focus (a
    # headline, NOT a copy of the executive read); why_it_matters = the top
    # immediate-attention rationale. (Previously current_status duplicated
    # executive_summary verbatim and why_it_matters was always null.)
    _focus = summary.get("currentFocus") or []
    current_status_line = (
        (_focus[0].get("title") or _focus[0].get("summary"))
        if _focus and isinstance(_focus[0], dict)
        else None
    )
    _attention = summary.get("immediateAttention") or []
    why_it_matters_text = (
        (_attention[0].get("detail") or _attention[0].get("title"))
        if _attention and isinstance(_attention[0], dict)
        else None
    )

    payload = {
        "target_id": target_id,
        "packet_type": "current",
        "packet_version": f"{SYNTHESIS_COMPILER_VERSION}:current",
        "generated_at": generated_at,
        "covered_start_at": effective_since,
        "covered_end_at": covered_end_at,
        "freshness_status": "fresh" if docs else "partial",
        "executive_summary": summary.get("currentExecutiveRead"),
        "current_status": current_status_line,
        "strategic_read": (summary.get("financialPosition") or {}).get("summary"),
        "why_it_matters": why_it_matters_text,
        "recommended_next_moves": [a["title"] for a in summary.get("recommendedActions", [])][:5],
        "confidence_summary": confidence_summary,
        "source_coverage": source_coverage,
        "review_queue_count": 0,
        "stale_item_count": 0,
        "packet_json": packet_json,
        "compiler_version": SYNTHESIS_COMPILER_VERSION,
    }

    enforce_pm_app_final_projection_guard(
        "project_intelligence_packet_projection",
        row_counts={"intelligence_packets": 1},
    )

    # Rolling-state: the DB enforces ONE current packet per target
    # (partial-unique `intelligence_packets_one_current_per_target`). The project
    # page reads that single current row, so synthesis must UPDATE it in place —
    # superseding whatever compiler last owned it (e.g. the legacy
    # operating-summary packet) and rolling its own state forward on each run
    # (Gates G3/G4). We do NOT filter by compiler_version here: there is exactly
    # one current row to own.
    existing = (
        client.table("intelligence_packets")
        .select("id")
        .eq("target_id", target_id)
        .eq("packet_type", "current")
        .limit(1)
        .execute()
        .data
        or []
    )
    if existing:
        written = (
            client.table("intelligence_packets")
            .update(payload)
            .eq("id", existing[0]["id"])
            .execute()
            .data
        )
        packet_id = existing[0]["id"]
    else:
        written = (
            client.table("intelligence_packets").insert(payload).execute().data
        )
        packet_id = (written[0]["id"] if written else None)

    # Keep the durable cumulative finding ledger in lockstep with the current
    # narrative packet. A failed projection must surface as a failed refresh;
    # otherwise the UI would silently show a packet whose timeline was lost.
    if packet_id:
        from ..packet_repository import upsert_packet_items

        cumulative = upsert_packet_items(
            client,
            project_id=int(project_id),
            packet={"id": packet_id, "packet_json": packet_json},
            now=generated_at,
        )
        result["cumulative_packet_items"] = cumulative.get("items_written", 0)

    client.table("intelligence_targets").update(
        {"last_signal_at": covered_end_at}
    ).eq("id", target_id).execute()

    result["packet_id"] = packet_id
    result["covered_end_at"] = covered_end_at
    for doc in docs:
        record_source_processing_status(
            SourceProcessingContext(
                source_system=str(doc.get("source_system") or doc.get("comm_type") or doc.get("source") or "communication"),
                source_item_id=str(doc.get("source_item_id") or doc.get("id")),
                content_hash=str(doc.get("content_hash") or ""),
                source_document_id=str(doc.get("id")) if doc.get("id") else None,
                project_id=int(project_id),
                source_title=doc.get("title"),
                source_url=doc.get("source_web_url") or doc.get("source_path"),
                occurred_at=doc.get("date"),
                metadata={
                    "packet_id": packet_id,
                    "compiler_version": SYNTHESIS_COMPILER_VERSION,
                    "path": "project_intelligence.refresh_project_intelligence",
                },
            ),
            status="project_intelligence_updated",
        )
    logger.info(
        "[ProjectIntelligence] wrote synthesis packet project=%s packet=%s docs=%d "
        "covered_end=%s fabricated_cites=%d confidence=%s",
        project_id, packet_id, len(docs), covered_end_at,
        result["fabricated_cites_dropped"], result["confidence"],
    )
    return result
