"""Project communication projection for Project Intelligence.

Generalizes the meeting deep-extractor (``pipeline.extractor.run_extractor``) so
that EMAILS and TEAMS conversations also receive full-context, evidence-backed
intelligence extraction. Their old shallow compilers were deleted in the
2026-05-15 migration and never replaced — this module fills that gap.

Meetings are intentionally SKIPPED here: they are already processed by the live
meeting extractor. Processing them again would double-write signals/tasks.

Pipeline per email/teams doc:
  1. Idempotently clear prior candidates for (doc, this compiler version).
  2. Read raw text from the RAG DB (PM-APP document_metadata.content is stale).
  3. Run :func:`extract_deep_communication_intelligence` against the project's
     real tracked state.
  4. Stage + promote each decision/risk/opportunity/insight/flag as a
     source_signal_candidate -> insight_card.
  5. Upsert tasks into ``tasks``.

Reuses, never duplicates:
  - pipeline.extractor._fetch_project_state / ._upsert_task
  - pipeline.llm.extract_deep_communication_intelligence
  - project_intelligence.targets.ensure_client_project_target
  - project_intelligence.projections.signal_candidates
"""

from __future__ import annotations

import logging
import re
from datetime import datetime, timedelta, timezone
from typing import Any, Dict, List, Optional

from ...supabase_helpers import (
    fetch_optional_row,
    get_rag_read_client,
    get_rag_write_client,
    get_supabase_client,
)
from ...ops.db_pressure_guard import (
    AppDbPressureError,
    AppDbProjectionError,
    enforce_app_db_pressure_guard,
    reserve_pm_app_projection_budget,
)
from ...pipeline import llm
from ...pipeline.extractor import _fetch_project_state, _upsert_task
from ...pipeline.source_processing import SourceProcessingContext, record_source_processing_status
from ...intelligence.task_governance import govern_tasks
from ..targets import ensure_client_project_target
from .signal_candidates import promote_signal_candidate, write_source_signal_candidate

logger = logging.getLogger(__name__)

COMMS_COMPILER_VERSION = "project_synthesizer_v1"
# How far back to look when no explicit `since` is given. Kept simple and
# deterministic — a 30-day window of recent communications.
DEFAULT_LOOKBACK_DAYS = 30

# A predictive flag is not marked did_not_materialize until at least this many
# days have passed — a change event can still happen; premature "didn't happen"
# verdicts erode trust in the calibration loop.
FLAG_DID_NOT_MATERIALIZE_MIN_DAYS = 21

# Reuse the meeting extractor's risk-category -> signal_type mapping so cards
# from emails/teams land in the same buckets as cards from meetings.
_RISK_CATEGORY_SIGNAL_TYPE = {
    "schedule": "schedule_risk",
    "cost": "financial_exposure",
    "budget": "financial_exposure",
    "cash_flow": "financial_exposure",
    "financial": "financial_exposure",
}

_MEETING_TOKENS = ("fireflies", "meeting", "transcript")
_TEAMS_TOKENS = ("teams", "chat")
_EMAIL_TOKENS = ("outlook", "email", "mail")


def _projection_counts_for_doc(payloads: List[Dict[str, Any]], task_count: int) -> Dict[str, int]:
    promotable = sum(
        1
        for payload in payloads
        if float(payload.get("confidence_score") or 0) >= 0.85
    )
    return {
        table: count
        for table, count in {
            "insight_cards": promotable,
            "insight_card_targets": promotable,
            "insight_card_evidence": promotable,
            "tasks": task_count,
        }.items()
        if count > 0
    }


def _classify_comm_type(doc: Dict[str, Any]) -> Optional[str]:
    """Return "meeting" | "teams" | "email" | None for a document_metadata row.

    Checks source_system / source / category / type. Meeting is detected first
    (so a Teams *meeting* chat doesn't get miscategorized), then teams, then
    email. Anything else returns None (not a communication we synthesize).
    """
    haystack = " ".join(
        str(doc.get(field) or "")
        for field in ("source_system", "source", "category", "type")
    ).lower()
    if any(token in haystack for token in _MEETING_TOKENS):
        return "meeting"
    if any(token in haystack for token in _TEAMS_TOKENS):
        return "teams"
    if any(token in haystack for token in _EMAIL_TOKENS):
        return "email"
    return None


def _slug(*parts: Any, max_len: int = 180) -> str:
    raw = ":".join(str(part).strip().lower() for part in parts if str(part or "").strip())
    return re.sub(r"[^a-z0-9]+", "-", raw).strip("-")[:max_len] or "comms-signal"


def _participants(doc: Dict[str, Any]) -> List[str]:
    arr = doc.get("participants_array")
    if isinstance(arr, list) and arr:
        return [str(p) for p in arr if str(p or "").strip()]
    raw = doc.get("participants")
    if isinstance(raw, list):
        return [str(p) for p in raw if str(p or "").strip()]
    if isinstance(raw, str) and raw.strip():
        return [p.strip() for p in re.split(r"[;,]", raw) if p.strip()]
    return []


def _build_signal_payloads(structured: "Any") -> List[Dict[str, Any]]:
    """Convert extracted decisions/risks/opportunities/insights/flags into
    write_source_signal_candidate kwargs. Mirrors the meeting extractor's
    _build_meeting_signal_payloads but adds severity passthrough + flags."""
    payloads: List[Dict[str, Any]] = []

    def _title(description: str) -> str:
        return (description or "").strip()[:180] or "Untitled signal"

    def _conf(item: Any) -> float:
        value = getattr(item, "confidence", None)
        return value if value is not None else 0.7

    def _status(item: Any) -> str:
        return "resolved" if getattr(item, "status_hint", None) == "resolved" else "open"

    def _excerpt(item: Any, description: str) -> str:
        return (getattr(item, "evidence_quote", None) or description)[:900]

    for decision in structured.decisions:
        description = (decision.description or "").strip()
        if not description:
            continue
        title = _title(description)
        payloads.append({
            "signal_type": "decision",
            "title": title,
            "summary": description,
            "why_it_matters": decision.rationale or None,
            "suggested_owner_label": decision.owner or None,
            "current_status": _status(decision),
            "confidence_score": _conf(decision),
            "excerpt": _excerpt(decision, description),
            "normalized_signal_key": _slug("decision", title),
            "extraction_json": {
                "source": "project_synthesizer",
                "kind": "decision",
                "rationale": decision.rationale,
                "owner": decision.owner,
                "evidence_quote": decision.evidence_quote,
                "status_hint": decision.status_hint,
            },
        })

    for risk in structured.risks:
        description = (risk.description or "").strip()
        if not description:
            continue
        title = _title(description)
        signal_type = _RISK_CATEGORY_SIGNAL_TYPE.get(
            (risk.category or "").strip().lower(), "risk"
        )
        payloads.append({
            "signal_type": signal_type,
            "title": title,
            "summary": description,
            "why_it_matters": f"Risk impact: {risk.impact or 'unspecified'}, likelihood: {risk.likelihood or 'unspecified'}.",
            "suggested_owner_label": risk.owner or None,
            "current_status": _status(risk),
            "confidence_score": _conf(risk),
            "excerpt": _excerpt(risk, description),
            "normalized_signal_key": _slug(signal_type, title),
            "extraction_json": {
                "source": "project_synthesizer",
                "kind": "risk",
                "category": risk.category,
                "likelihood": risk.likelihood,
                "impact": risk.impact,
                "severity": risk.severity,
                "owner": risk.owner,
                "evidence_quote": risk.evidence_quote,
                "status_hint": risk.status_hint,
            },
        })

    for opportunity in structured.opportunities:
        description = (opportunity.description or "").strip()
        if not description:
            continue
        title = _title(description)
        payloads.append({
            "signal_type": "initiative_signal",
            "title": title,
            "summary": description,
            "why_it_matters": "Opportunity surfaced from a project communication.",
            "suggested_owner_label": opportunity.owner or None,
            "current_status": _status(opportunity),
            "confidence_score": _conf(opportunity),
            "excerpt": _excerpt(opportunity, description),
            "normalized_signal_key": _slug("initiative_signal", title),
            "extraction_json": {
                "source": "project_synthesizer",
                "kind": "opportunity",
                "opportunity_type": opportunity.type,
                "owner": opportunity.owner,
                "evidence_quote": opportunity.evidence_quote,
                "status_hint": opportunity.status_hint,
            },
        })

    for insight in structured.insights:
        description = (insight.description or "").strip()
        if not description:
            continue
        title = _title(description)
        category = (insight.category or "").strip().lower()
        signal_type = "open_question" if category == "open_question" else "project_update"
        payloads.append({
            "signal_type": signal_type,
            "title": title,
            "summary": description,
            "why_it_matters": "Surfaced from a project communication.",
            "suggested_owner_label": insight.owner or None,
            "current_status": _status(insight),
            "confidence_score": _conf(insight),
            "excerpt": _excerpt(insight, description),
            "normalized_signal_key": _slug(signal_type, title),
            "extraction_json": {
                "source": "project_synthesizer",
                "kind": "insight",
                "category": insight.category,
                "owner": insight.owner,
                "evidence_quote": insight.evidence_quote,
                "status_hint": insight.status_hint,
            },
        })

    for flag in getattr(structured, "flags", []) or []:
        description = (flag.description or "").strip()
        if not description:
            continue
        title = _title(description)
        payloads.append({
            "signal_type": "flag",
            "title": title,
            "summary": description,
            "why_it_matters": "Forward-looking prediction surfaced from a project communication.",
            "suggested_owner_label": flag.owner or None,
            "current_status": _status(flag),
            "confidence_score": _conf(flag),
            "excerpt": _excerpt(flag, description),
            "normalized_signal_key": _slug("flag", title),
            "extraction_json": {
                "source": "project_synthesizer",
                "kind": "flag",
                "flag_type": flag.flag_type,
                "severity": flag.severity,
                "owner": flag.owner,
                "evidence_quote": flag.evidence_quote,
                "status_hint": flag.status_hint,
            },
        })

    return payloads


def _resolve_since(target_id: Optional[str], since: Optional[str]) -> str:
    """Determine the lower-bound timestamp for documents to (re)process.

    If an explicit `since` is given, use it. Otherwise default to
    DEFAULT_LOOKBACK_DAYS ago (ISO). We keep this simple and deterministic
    rather than deriving from the last intelligence_packets.covered_end_at —
    the candidate/card dedup (idempotent delete + normalized_signal_key) makes
    re-processing a recent window safe and cheap.
    """
    if since:
        return since
    cutoff = datetime.now(timezone.utc) - timedelta(days=DEFAULT_LOOKBACK_DAYS)
    return cutoff.isoformat()


def synthesize_project_intelligence(
    project_id: int,
    *,
    since: Optional[str] = None,
    max_docs: int = 40,
    max_extractions: Optional[int] = None,
    skip_synthesized: bool = True,
    dry_run: bool = False,
    projection_budget_counts: Optional[Dict[str, int]] = None,
    projection_budget_job_name: str = "project_synthesizer_projection",
) -> dict:
    """Run deep communication-intelligence extraction over a project's recent
    emails + Teams conversations and write evidence-backed insight cards + tasks.

    When ``dry_run`` is True, extraction still runs but NOTHING is written —
    instead each doc's structured output (what_changed, signal/task counts, and
    a few sample items with evidence quotes) is returned under ``samples`` so the
    extraction quality can be inspected directly.

    Returns a summary dict; never raises for a single bad document (errors are
    collected so one bad doc doesn't abort the batch).
    """
    client = get_supabase_client()
    rag_read = get_rag_read_client()
    rag_write = get_rag_write_client()
    projection_counts = projection_budget_counts if projection_budget_counts is not None else {}

    target = ensure_client_project_target(
        client, int(project_id), compiler_version=COMMS_COMPILER_VERSION
    )
    target_id = target.get("id")

    effective_since = _resolve_since(target_id, since)

    result: Dict[str, Any] = {
        "project_id": int(project_id),
        "since": effective_since,
        "docs_seen": 0,
        "emails": 0,
        "teams": 0,
        "skipped": 0,
        "cards_written": 0,
        "tasks_written": 0,
        "extractions_attempted": 0,
        "pm_projection_rows": dict(projection_counts),
        "dry_run": dry_run,
        "errors": [],
    }
    if dry_run:
        result["samples"] = []

    if not target_id:
        result["errors"].append("missing intelligence target")
        return result

    # Fetch recent communications for this project. document_metadata.date can be
    # null for some sources, so we widen the window with an OR over captured_at.
    try:
        rows = (
            client.table("document_metadata")
            .select(
                "id,title,type,category,source,source_system,date,captured_at,"
                "participants,participants_array,source_metadata,source_item_id,"
                "source_web_url,source_path,content_hash,project_id"
            )
            .eq("project_id", int(project_id))
            .or_(f"date.gte.{effective_since},captured_at.gte.{effective_since}")
            .order("date", desc=True)
            .limit(max_docs)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001
        # A failed document fetch is FATAL (nothing can be processed) — raise so
        # the endpoint returns a non-200 instead of a silent empty 200. Per-doc
        # failures below are partial and collected into result["errors"].
        logger.error("[ProjectSynthesizer] document fetch failed (project=%s): %s", project_id, exc)
        raise RuntimeError(f"document fetch failed for project {project_id}: {exc}") from exc

    # Project ground truth is the same for every doc in this batch — fetch once.
    try:
        project_state = _fetch_project_state(client, int(project_id))
    except Exception as exc:  # noqa: BLE001
        logger.warning("[ProjectSynthesizer] project state fetch failed (project=%s): %s", project_id, exc)
        project_state = ""

    # Durable processed-set: doc ids that ALREADY produced a signal candidate for
    # this compiler version. This is the reliable "already extracted" signal —
    # unlike the best-effort `source_metadata.synthesized_at_v1` marker (a metadata
    # write that can silently fail and cause needless re-extraction). A doc is
    # skipped if it's marked OR has a candidate, so a failed marker write can no
    # longer make us pay to re-run the model on a doc we've already processed.
    # (Zero-yield docs leave no candidate, so the marker still covers those.)
    processed_doc_ids: set = set()
    if skip_synthesized:
        try:
            cand_rows = (
                rag_read.table("source_signal_candidates")
                .select("source_document_id")
                .eq("project_id", int(project_id))
                .eq("compiler_version", COMMS_COMPILER_VERSION)
                .limit(5000)
                .execute()
                .data
                or []
            )
            processed_doc_ids = {r["source_document_id"] for r in cand_rows if r.get("source_document_id")}
        except Exception as exc:  # noqa: BLE001 — fall back to marker-only skip
            logger.debug("[ProjectSynthesizer] candidate processed-set fetch failed (project=%s): %s", project_id, exc)

    for doc in rows:
        # Cap the number of (slow) LLM extractions per call. Deep extraction takes
        # seconds per doc, so a large synchronous batch can exceed the request
        # timeout. max_extractions bounds the actual extractions (not docs scanned).
        if max_extractions is not None and result["extractions_attempted"] >= max_extractions:
            result["capped_at_max_extractions"] = max_extractions
            break

        result["docs_seen"] += 1
        doc_id = doc.get("id")
        comm_type = _classify_comm_type(doc)
        source_context = SourceProcessingContext(
            source_system=str(doc.get("source_system") or comm_type or doc.get("source") or "communication"),
            source_item_id=str(doc.get("source_item_id") or doc_id),
            content_hash=str(doc.get("content_hash") or ""),
            source_document_id=str(doc_id) if doc_id else None,
            project_id=int(project_id),
            source_title=doc.get("title"),
            source_url=doc.get("source_web_url") or doc.get("source_path"),
            occurred_at=doc.get("date") or doc.get("captured_at"),
            metadata={
                "compiler_version": COMMS_COMPILER_VERSION,
                "comm_type": comm_type,
                "path": "project_synthesizer.synthesize_new_comms_since",
            },
        )

        if comm_type is None:
            result["skipped"] += 1
            continue
        if comm_type == "meeting":
            # Meetings are handled by the live meeting extractor — never double-process.
            result["skipped"] += 1
            logger.info("[ProjectSynthesizer] skipping meeting doc %s (handled by meeting extractor)", doc_id)
            continue

        # Skip docs already processed by this version (lets cron/repeat runs drain
        # a backlog instead of re-extracting the same docs). Reliable: skip if the
        # doc already produced a candidate (durable) OR carries the marker (covers
        # zero-yield docs). Set skip_synthesized=False to force re-processing.
        if skip_synthesized:
            sm = doc.get("source_metadata")
            already_marked = isinstance(sm, dict) and sm.get("synthesized_at_v1")
            if doc_id in processed_doc_ids or already_marked:
                result["skipped"] += 1
                record_source_processing_status(
                    source_context,
                    status="signals_extracted",
                    metadata={"reason": "already_synthesized"},
                )
                continue

        try:
            # (a) Idempotency — clear prior candidates for this doc + version.
            rag_write.table("source_signal_candidates").delete().eq(
                "source_document_id", doc_id
            ).eq("compiler_version", COMMS_COMPILER_VERSION).execute()

            # (b) Raw text lives in the RAG DB; PM-APP content is stale.
            rag_row = fetch_optional_row(
                rag_read, "rag_document_metadata", "content,raw_text", "id", doc_id
            )
            full_text = (rag_row.get("content") or rag_row.get("raw_text") or "").strip()
            if not full_text:
                result["skipped"] += 1
                logger.info("[ProjectSynthesizer] skipping doc %s — no raw text in RAG DB", doc_id)
                record_source_processing_status(
                    source_context,
                    status="failed_permanent",
                    error_code="rag_text_missing",
                    error_message="No content/raw_text available in RAG metadata for communication extraction.",
                )
                continue

            # (d) Deep extraction.
            result["extractions_attempted"] += 1
            structured = llm.extract_deep_communication_intelligence(
                comm_type=comm_type,
                title=doc.get("title") or "Untitled",
                date=doc.get("date") or doc.get("captured_at"),
                participants=_participants(doc),
                full_text=full_text,
                project_state=project_state,
            )

            # Distinguish a silent LLM failure from a genuinely empty communication.
            if getattr(structured, "extraction_failed", False):
                result["errors"].append({"doc_id": doc_id, "error": "extraction_failed (LLM call failed)"})
                logger.error("[ProjectSynthesizer] extraction FAILED for doc %s (%s)", doc_id, comm_type)
                record_source_processing_status(
                    source_context,
                    status="failed_retryable",
                    error_code="extraction_failed",
                    error_message=getattr(structured, "extraction_error", None) or "LLM extraction failed.",
                )
                if not dry_run:
                    continue

            source_occurred_at = doc.get("date") or doc.get("captured_at")
            payloads = _build_signal_payloads(structured)

            # Dry-run: surface the raw extraction for inspection; write nothing.
            if dry_run:
                if comm_type == "email":
                    result["emails"] += 1
                elif comm_type == "teams":
                    result["teams"] += 1
                result["samples"].append({
                    "doc_id": doc_id,
                    "comm_type": comm_type,
                    "title": doc.get("title"),
                    "text_chars": len(full_text),
                    "extraction_failed": getattr(structured, "extraction_failed", False),
                    "extraction_error": getattr(structured, "extraction_error", None),
                    "what_changed": getattr(structured, "what_changed", None),
                    "signals": len(payloads),
                    "tasks": len(structured.tasks),
                    "sample_signals": [
                        {"type": p["signal_type"], "title": p["title"][:120],
                         "evidence": (p.get("excerpt") or "")[:200]}
                        for p in payloads[:5]
                    ],
                    "sample_tasks": [
                        {"description": (t.description or "")[:140], "assignee": t.assignee}
                        for t in structured.tasks[:5]
                    ],
                })
                continue

            reserve_pm_app_projection_budget(
                projection_budget_job_name,
                projection_counts,
                _projection_counts_for_doc(payloads, len(structured.tasks)),
            )
            result["pm_projection_rows"] = dict(projection_counts)

            # (f) Signals -> candidates -> promotion.
            cards_before = result["cards_written"]
            tasks_before = result["tasks_written"]
            for payload in payloads:
                candidate = write_source_signal_candidate(
                    client,
                    source_document_id=doc_id,
                    target_id=target_id,
                    project_id=int(project_id),
                    source_occurred_at=source_occurred_at,
                    compiler_version=COMMS_COMPILER_VERSION,
                    **payload,
                )
                result["cards_written"] += 1
                if candidate.get("status") == "candidate":
                    try:
                        promote_signal_candidate(
                            client, candidate["id"], compiler_version=COMMS_COMPILER_VERSION
                        )
                    except Exception as promote_exc:  # noqa: BLE001
                        logger.error(
                            "[ProjectSynthesizer] signal promotion failed for doc %s candidate %s: %s",
                            doc_id,
                            candidate.get("id"),
                            promote_exc,
                            exc_info=True,
                        )
                        result["errors"].append(
                            {
                                "doc_id": doc_id,
                                "candidate_id": candidate.get("id"),
                                "stage": "signal_promotion",
                                "error": str(promote_exc),
                            }
                        )

            # (g) Tasks — tagged with the real source system (email/teams), not fireflies.
            governed_tasks = govern_tasks(structured.tasks, source_document_id=str(doc_id))
            responsibilities_classified = sum(
                1 for task in governed_tasks
                if getattr(task, "task_classification", None) == "ongoing_responsibility"
            )
            actionable_tasks = [
                task for task in governed_tasks
                if (getattr(task, "task_governance", {}) or {}).get("projectable", True)
            ]
            for task in actionable_tasks:
                _upsert_task(
                    client,
                    task,
                    metadata_id=doc_id,
                    project_id=int(project_id),
                    client_id=None,  # document_metadata has no client linkage column
                    source_system=comm_type,
                )
                result["tasks_written"] += 1
            result["responsibilities_classified"] = result.get("responsibilities_classified", 0) + responsibilities_classified

            # Mark the doc synthesized so cron/repeat runs skip it next time.
            try:
                merged_sm = dict(doc.get("source_metadata") or {}) if isinstance(doc.get("source_metadata"), dict) else {}
                merged_sm["synthesized_at_v1"] = datetime.now(timezone.utc).isoformat()
                client.table("document_metadata").update(
                    {"source_metadata": merged_sm}
                ).eq("id", doc_id).execute()
            except Exception as mark_exc:  # noqa: BLE001 — marking is best-effort
                logger.warning("[ProjectSynthesizer] could not mark doc %s synthesized: %s", doc_id, mark_exc)

            if comm_type == "email":
                result["emails"] += 1
            elif comm_type == "teams":
                result["teams"] += 1
            record_source_processing_status(
                source_context,
                status="signals_extracted",
                metadata={
                    "cards_written": result["cards_written"] - cards_before,
                    "tasks_written": result["tasks_written"] - tasks_before,
                    "signal_count": len(payloads),
                    "task_count": len(actionable_tasks),
                    "responsibilities_classified": responsibilities_classified,
                },
            )

        except AppDbProjectionError:
            # This is a run-level capacity decision, not a malformed document.
            # Bubble it to the sweep so extraction stops for this project while
            # the reserved L2/current-state projections still run.
            raise
        except Exception as exc:  # noqa: BLE001 — one bad doc must not abort batch
            logger.error("[ProjectSynthesizer] doc %s failed: %s", doc_id, exc, exc_info=True)
            result["errors"].append({"doc_id": doc_id, "error": str(exc)})
            record_source_processing_status(
                source_context,
                status="failed_retryable",
                error_code=exc.__class__.__name__,
                error_message=str(exc),
            )

    logger.info(
        "[ProjectSynthesizer] project=%s seen=%d emails=%d teams=%d skipped=%d cards=%d tasks=%d errors=%d",
        project_id,
        result["docs_seen"],
        result["emails"],
        result["teams"],
        result["skipped"],
        result["cards_written"],
        result["tasks_written"],
        len(result["errors"]),
    )
    return result


def reconcile_project_flags(project_id: int, *, model: Optional[str] = None) -> dict:
    """Flag -> outcome calibration loop.

    For each OPEN predictive ``flag`` card on the project, compare it against the
    project's subsequent real events (decisions/changes/risks that occurred after
    the prediction) and decide whether the prediction MATERIALIZED, DID NOT
    materialize, or is STILL OPEN. Materialized/did-not flips ``current_status``
    and links the realizing event(s) via ``related_card_ids`` — so the timeline
    shows whether the AI's predictions came true.
    """
    from ...intelligence.client import extract_with_retry
    from ...pipeline.config import MODEL_SIGNAL_EXTRACTION
    from ...pipeline.model_usage import ModelUsageContext

    client = get_supabase_client()
    target = ensure_client_project_target(client, int(project_id), compiler_version=COMMS_COMPILER_VERSION)
    target_id = target.get("id")
    result: Dict[str, Any] = {"project_id": int(project_id), "open_flags": 0, "materialized": 0, "did_not_materialize": 0, "still_open": 0, "errors": []}
    if not target_id:
        return result

    flags = (
        client.table("insight_cards")
        .select("id,title,summary,occurred_at,why_it_matters")
        .eq("primary_target_id", target_id)
        .eq("card_type", "flag")
        .eq("current_status", "open")
        .order("occurred_at", desc=False)
        .limit(40)
        .execute()
        .data
        or []
    )
    result["open_flags"] = len(flags)
    if not flags:
        return result

    project_name = (target.get("name") or f"project {project_id}")
    today = datetime.now(timezone.utc).date().isoformat()

    for flag in flags:
        try:
            flag_at = flag.get("occurred_at")
            # Subsequent real events (non-flag) that occurred after the prediction.
            events = (
                client.table("insight_cards")
                .select("id,card_type,title,occurred_at")
                .eq("primary_target_id", target_id)
                .neq("card_type", "flag")
                .gt("occurred_at", flag_at)
                .order("occurred_at", desc=True)
                .limit(25)
                .execute()
                .data
                or []
            )
            event_lines = "\n".join(
                f"- [{e['id']}] ({str(e.get('occurred_at'))[:10]}, {e.get('card_type')}) {e.get('title')}"
                for e in events
            ) or "(no subsequent events recorded yet)"

            prompt = (
                f'You audit AI predictions for a construction project ("{project_name}"). '
                f'Today is {today}.\n\n'
                f'PREDICTION (flagged {str(flag_at)[:10]}): {flag.get("title")}\n'
                f'Detail: {flag.get("summary") or ""}\n\n'
                f'SUBSEQUENT PROJECT EVENTS (after the prediction):\n{event_lines}\n\n'
                'Decide, using ONLY the events above:\n'
                '- "materialized": a subsequent event shows the predicted thing actually happened. '
                'Return the realizing event id(s) in realizing_card_ids.\n'
                '- "did_not_materialize": enough time has passed and/or events show it was abandoned or will not happen.\n'
                '- "still_open": not enough evidence yet.\n'
                'Prefer "still_open" unless evidence is clear. Return JSON: '
                '{"verdict":"materialized|did_not_materialize|still_open","realizing_card_ids":["uuid"...],"reasoning":"one sentence"}'
            )
            data = extract_with_retry(
                [{"role": "user", "content": prompt}],
                model=model or MODEL_SIGNAL_EXTRACTION,
                timeout=60,
                usage_context=ModelUsageContext(
                    stage="signals_extracted",
                    operation="reconcile_project_flag",
                    project_id=int(project_id),
                    budget_bucket="signal",
                    metadata={"flag_id": flag["id"]},
                ),
            )
            if data.get("_extraction_failed"):
                result["errors"].append({"flag_id": flag["id"], "error": "llm_failed"})
                continue

            verdict = str(data.get("verdict") or "still_open").strip().lower()
            valid_ids = {e["id"] for e in events}
            realizing = [cid for cid in (data.get("realizing_card_ids") or []) if cid in valid_ids]

            # Guardrail: don't call a prediction "didn't happen" prematurely — a
            # change event can still occur. Require a real elapsed window (or
            # explicit abandonment, which the model expresses via realizing events
            # for materialized, not here) before did_not_materialize sticks.
            if verdict == "did_not_materialize":
                try:
                    flag_dt = datetime.fromisoformat(str(flag_at).replace("Z", "+00:00"))
                    age_days = (datetime.now(timezone.utc) - flag_dt).days
                except Exception:  # noqa: BLE001
                    age_days = 0
                if age_days < FLAG_DID_NOT_MATERIALIZE_MIN_DAYS:
                    verdict = "still_open"

            if verdict == "materialized":
                client.table("insight_cards").update(
                    {"current_status": "materialized", "related_card_ids": realizing, "updated_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", flag["id"]).execute()
                result["materialized"] += 1
            elif verdict == "did_not_materialize":
                client.table("insight_cards").update(
                    {"current_status": "did_not_materialize", "updated_at": datetime.now(timezone.utc).isoformat()}
                ).eq("id", flag["id"]).execute()
                result["did_not_materialize"] += 1
            else:
                result["still_open"] += 1
        except Exception as exc:  # noqa: BLE001 — one flag must not abort the pass
            logger.error("[ProjectSynthesizer] flag reconcile failed for %s: %s", flag.get("id"), exc, exc_info=True)
            result["errors"].append({"flag_id": flag.get("id"), "error": str(exc)})

    logger.info(
        "[ProjectSynthesizer] flag reconcile project=%s open=%d materialized=%d did_not=%d still_open=%d",
        project_id, result["open_flags"], result["materialized"], result["did_not_materialize"], result["still_open"],
    )
    return result


def synthesize_new_comms_since(
    since: str,
    *,
    max_projects: int = 25,
    max_extractions_per_project: int = 25,
    refresh_intelligence: bool = True,
) -> dict:
    """EVENT-DRIVEN extraction: process ONLY the email/Teams docs ingested since
    ``since`` (what the just-finished sync brought in), per affected project, then
    refresh that project's L2 synthesis.

    Called inline at the end of ``run_graph_sync`` so new communications become
    intelligence in the same cycle they arrive — instead of a blind 2-hourly
    re-scan of everything. The candidate-based skip in
    ``synthesize_project_intelligence`` guarantees already-processed docs are never
    re-extracted, and the empty-delta guard in ``refresh_project_intelligence``
    means L2 only pays for projects that actually changed. Bounded so one sync can
    never blow its time/cost budget; the daily backstop sweep catches any overflow.
    """
    try:
        enforce_app_db_pressure_guard("project_synthesizer_event_driven")
    except AppDbPressureError as exc:
        # Inline post-sync work must never pile onto an already-saturated app
        # DB; the daily backstop sweep re-covers anything skipped here.
        logger.warning("[ProjectSynthesizer] event-driven synthesis skipped: %s", exc)
        return {"since": since, "projects": 0, "skipped_db_pressure": str(exc)}
    client = get_supabase_client()
    projection_counts: Dict[str, int] = {}
    try:
        rows = (
            client.table("document_metadata")
            .select("project_id")
            .not_.is_("project_id", "null")
            .gte("created_at", since)
            .limit(5000)
            .execute()
            .data
            or []
        )
    except Exception as exc:  # noqa: BLE001 — never let this abort the sync
        logger.error("[ProjectSynthesizer] event-driven project scan failed: %s", exc)
        return {"since": since, "projects": 0, "error": str(exc)}

    project_ids = sorted({int(r["project_id"]) for r in rows if r.get("project_id")})[:max_projects]
    summary: Dict[str, Any] = {
        "since": since, "projects": len(project_ids), "emails": 0, "teams": 0,
        "cards_written": 0, "tasks_written": 0, "synthesis_packets_written": 0,
        "synthesis_packets_skipped": 0,
        "pm_projection_rows": {}, "errors": [],
    }
    for pid in project_ids:
        try:
            r = synthesize_project_intelligence(
                pid,
                since=since,
                max_docs=400,
                max_extractions=max_extractions_per_project,
                skip_synthesized=True,
                projection_budget_counts=projection_counts,
                projection_budget_job_name="project_synthesizer_event_driven_projection",
            )
            summary["emails"] += r.get("emails", 0)
            summary["teams"] += r.get("teams", 0)
            summary["cards_written"] += r.get("cards_written", 0)
            summary["tasks_written"] += r.get("tasks_written", 0)
            summary["pm_projection_rows"] = dict(projection_counts)
        except Exception as exc:  # noqa: BLE001 — one project must not abort the rest
            logger.error("[ProjectSynthesizer] event-driven extraction failed for %s: %s", pid, exc, exc_info=True)
            summary["errors"].append({"project_id": pid, "stage": "extract", "error": str(exc)})
            continue
        if refresh_intelligence:
            try:
                from .current_state import refresh_project_intelligence

                reserve_pm_app_projection_budget(
                    "project_synthesizer_event_driven_projection",
                    projection_counts,
                    {"intelligence_packets": 1},
                )
                summary["pm_projection_rows"] = dict(projection_counts)
                sres = refresh_project_intelligence(pid)
                if sres.get("packet_id") and not sres.get("skipped_no_new_docs"):
                    summary["synthesis_packets_written"] += 1
            except AppDbProjectionError as exc:
                logger.info(
                    "[ProjectSynthesizer] event-driven L2 synthesis skipped for %s: %s",
                    pid,
                    exc,
                )
                summary["synthesis_packets_skipped"] += 1
            except Exception as exc:  # noqa: BLE001 — synthesis must not abort the rest
                logger.error("[ProjectSynthesizer] event-driven L2 synthesis failed for %s: %s", pid, exc, exc_info=True)
                summary["errors"].append({"project_id": pid, "stage": "synthesis", "error": str(exc)})

    logger.info(
        "[ProjectSynthesizer] event-driven: since=%s projects=%d emails=%d teams=%d cards=%d packets=%d errors=%d",
        since, summary["projects"], summary["emails"], summary["teams"],
        summary["cards_written"], summary["synthesis_packets_written"], len(summary["errors"]),
    )
    return summary


def _sweep_exit_code(summary: Dict[str, Any]) -> int:
    """Fail the cron when page-facing synthesis/projection did not land.

    Per-document extraction remains best-effort, but the daily backstop cannot
    report success when its L2 packet or ``project_current_state`` projection
    failed for any project.
    """
    errors = summary.get("errors") or []
    critical_stages = {"synthesis", "operating_record"}
    if any(error.get("stage") in critical_stages for error in errors):
        return 1
    return 1 if errors and not summary.get("per_project") else 0


def run_synthesis_sweep(
    *,
    project_ids: Optional[List[int]] = None,
    max_projects: int = 200,
    max_extractions_per_project: int = 4,
    since_days: int = 14,
    refresh_intelligence: bool = True,
) -> dict:
    """Incremental cron driver: synthesize recent un-synthesized email/Teams docs
    across active projects, bounded so total LLM spend per run stays predictable.

    Cost ceiling per run = max_projects x max_extractions_per_project deep
    extractions. Projects whose recent docs are all already synthesized do a cheap
    no-op doc-scan (no LLM calls) thanks to the skip_synthesized marker.

    When ``refresh_intelligence`` is True (default), after the per-doc card
    extraction each project also gets ONE L2 rolling-state synthesis pass
    (``refresh_project_intelligence``) — the cards are the timeline/evidence log,
    the synthesis packet is the product the page reads. Bounded: one LLM call per
    swept project.
    """
    # The daily sweep is a background crawler of the production app DB — it
    # must never start while the DB/pooler is already saturated (2026-07-02
    # incident). Raising here makes the Render cron exit non-zero and retry on
    # its next scheduled run.
    enforce_app_db_pressure_guard("project_synthesis_sweep")
    client = get_supabase_client()
    since = (datetime.now(timezone.utc) - timedelta(days=since_days)).isoformat()

    if project_ids is None:
        rows = (
            client.table("document_metadata")
            .select("project_id")
            .not_.is_("project_id", "null")
            .gte("date", since)
            .limit(3000)
            .execute()
            .data
            or []
        )
        project_ids = sorted({int(r["project_id"]) for r in rows if r.get("project_id")})

    project_ids = project_ids[:max_projects]

    summary: Dict[str, Any] = {
        "projects": len(project_ids),
        "emails": 0,
        "teams": 0,
        "cards_written": 0,
        "tasks_written": 0,
        "pm_projection_rows": {},
        "errors": [],
        "per_project": [],
    }

    # Cumulative projection budget across the entire sweep. This bounds total PM app
    # writes to prevent DB pressure (see db_pressure_guard.py:28-29). If a project
    # exceeds the budget, that project fails but remaining projects continue. The budget
    # is intentionally cumulative so the sweep cannot evade the guard by splitting
    # writes across multiple projects.
    project_projection_counts: Dict[str, int] = {}

    # Reserve the page-critical one-row projections before optional high-volume
    # communication extraction can consume the sweep allowance. This keeps the
    # total PM write ceiling cumulative while guaranteeing that every selected
    # project can refresh its packet and operating narrative. Extraction uses
    # only the remaining capacity and drains its backlog over later sweeps.
    if refresh_intelligence and project_ids:
        reserve_pm_app_projection_budget(
            "project_synthesizer_sweep_projection",
            project_projection_counts,
            {
                "intelligence_packets": len(project_ids),
                "project_current_state": len(project_ids),
            },
        )
        summary["pm_projection_rows"] = dict(project_projection_counts)

    for pid in project_ids:

        try:
            try:
                r = synthesize_project_intelligence(
                    pid,
                    since=since,
                    max_docs=200,
                    max_extractions=max_extractions_per_project,
                    skip_synthesized=True,
                    projection_budget_counts=project_projection_counts,
                    projection_budget_job_name="project_synthesizer_sweep_projection",
                )
            except AppDbProjectionError as exc:
                # The extraction backlog is lower priority than the narrative
                # projections reserved above. Record the bounded deferral and
                # continue through L2/current-state refresh for this project.
                logger.info(
                    "[ProjectSynthesizer] extraction projection deferred for %s: %s",
                    pid,
                    exc,
                )
                summary["errors"].append(
                    {"project_id": pid, "stage": "extraction_budget", "error": str(exc)}
                )
                r = {
                    "emails": 0,
                    "teams": 0,
                    "cards_written": 0,
                    "tasks_written": 0,
                }
            summary["emails"] += r.get("emails", 0)
            summary["teams"] += r.get("teams", 0)
            summary["cards_written"] += r.get("cards_written", 0)
            summary["tasks_written"] += r.get("tasks_written", 0)
            summary["pm_projection_rows"] = dict(project_projection_counts)
            # Flag -> outcome calibration for this project (cheap: only open flags).
            flag_res = {}
            try:
                flag_res = reconcile_project_flags(pid)
                summary["flags_materialized"] = summary.get("flags_materialized", 0) + flag_res.get("materialized", 0)
                summary["flags_resolved"] = summary.get("flags_resolved", 0) + flag_res.get("materialized", 0) + flag_res.get("did_not_materialize", 0)
            except Exception as fexc:  # noqa: BLE001 — reconcile must not abort the sweep
                logger.warning("[ProjectSynthesizer] flag reconcile failed for %s: %s", pid, fexc)

            # L2 rolling-state synthesis: one coherent packet per project (the
            # product the page reads). Bounded to one LLM call per project; never
            # aborts the sweep. Lazy import avoids a circular module load.
            synthesis_res: Dict[str, Any] = {}
            if refresh_intelligence:
                try:
                    from .current_state import refresh_project_intelligence

                    synthesis_res = refresh_project_intelligence(pid)
                    summary["synthesis_packets_written"] = (
                        summary.get("synthesis_packets_written", 0)
                        + (1 if synthesis_res.get("packet_id") else 0)
                    )
                except Exception as sexc:  # noqa: BLE001 — synthesis must not abort the sweep
                    logger.error("[ProjectSynthesizer] L2 synthesis failed for %s: %s", pid, sexc, exc_info=True)
                    summary["errors"].append({"project_id": pid, "stage": "synthesis", "error": str(sexc)})

            # The scheduled Daily Executive Brief fan-out is the sole owner of
            # project_current_state, timeline, and report-suggestion projections.
            # This communication sweep may emit its own packet, cards, and tasks,
            # but it must not recreate the retired per-source operating-record fan-out.

            summary["per_project"].append({"project_id": pid, "emails": r.get("emails"), "teams": r.get("teams"), "cards": r.get("cards_written"), "flags_resolved": flag_res.get("materialized", 0) + flag_res.get("did_not_materialize", 0) if flag_res else 0, "synthesis_packet": synthesis_res.get("packet_id")})
        except Exception as exc:  # noqa: BLE001 — one project must not abort the sweep
            logger.error("[ProjectSynthesizer] sweep failed for project %s: %s", pid, exc, exc_info=True)
            summary["errors"].append({"project_id": pid, "error": str(exc)})

    logger.info(
        "[ProjectSynthesizer] sweep done: projects=%d emails=%d teams=%d cards=%d tasks=%d errors=%d",
        summary["projects"], summary["emails"], summary["teams"],
        summary["cards_written"], summary["tasks_written"], len(summary["errors"]),
    )
    return summary
