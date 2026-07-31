"""
Stage 3 – Structured data extraction.

Reads segments from ``meeting_segments``, collects raw decisions/risks/tasks,
then calls the LLM to normalize, deduplicate, and identify opportunities.

Stores extracted tasks in the ``tasks`` table, then marks the ingestion job as
``done``. Project Intelligence synthesis consumes the durable source corpus
through its canonical pipeline; ingestion does not project derived intelligence.
"""
from __future__ import annotations

import logging
import os
import re
from typing import Any, Dict, List

from ..supabase_helpers import (
    fetch_optional_row,
    get_rag_read_client,
    get_rag_write_client,
    get_supabase_client,
    update_ingestion_job_state,
)
from ..ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from ..task_assignees import TaskAssigneeResolver
from .models import StructuredData, TaskItem
from . import llm


def _env_flag(name: str, default: bool = False) -> bool:
    raw = os.getenv(name)
    if raw is None:
        return default
    return raw.strip().lower() in {"1", "true", "yes", "on"}


# Feature flag (Part B+C+D rollout): when on, run_extractor reads the WHOLE
# transcript against the project's real state via llm.extract_deep_meeting_intelligence
# instead of the shallow segment-normalization pass. Off by default so the deep
# path can be A/B'd against the existing pass before becoming default.
DEEP_EXTRACTION_ENABLED = _env_flag("DEEP_EXTRACTION_ENABLED", False)
# Deep tasks at/above this calibrated confidence are auto-created (status=open);
# below it they are still written but flagged extraction_metadata.needs_review so
# a human promotes them — we never silently auto-create a low-confidence task.
DEEP_TASK_CONFIDENCE_THRESHOLD = float(os.getenv("DEEP_TASK_CONFIDENCE_THRESHOLD", "0.7"))
# Bounded semantic prior-context lookup size (supporting input, not the source).
DEEP_PRIOR_CONTEXT_TOPK = int(os.getenv("DEEP_PRIOR_CONTEXT_TOPK", "5"))

# NOTE: `fireflies_task_rewriter` is imported lazily inside the functions that
# use it. Top-level import here creates a circular load order under pytest /
# FastAPI startup: ingestion/__init__.py eagerly loads fireflies_pipeline,
# which now imports the rewriter; meanwhile pipeline/extractor.py is loaded
# transitively via api.main, and Python sees `src.services.ingestion` as
# mid-initialization when it tries to resolve the submodule. Lazy imports
# avoid the cycle without restructuring the ingestion package.

# Stateless parser instance for content re-parsing.
_parser = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)

logger = logging.getLogger(__name__)
_GENERIC_TASK_PREFIX_RE = re.compile(
    r"^(prepare|review|follow up|check|ensure|discuss|coordinate|look into)\b",
    re.IGNORECASE,
)
_LOW_SIGNAL_TASK_RE = re.compile(
    r"\b(next meeting|as needed|if needed|when possible|as soon as possible)\b",
    re.IGNORECASE,
)
_VALID_PRIORITIES = {"low", "medium", "high", "urgent"}

# Prompt/pipeline version recorded on tasks emitted by the deep full-transcript
# pass. The tasks-quality trigger (migration 20260528000000) requires a non-empty
# extraction_prompt_version on every AI-sourced task; deep tasks satisfy it with
# this. Bump when the deep extraction prompt materially changes.
DEEP_EXTRACTION_PROMPT_VERSION = "deep_extractor_v0_1"
LEGACY_FIREFLIES_TASK_PROMPT_VERSION = "fireflies_pipeline_legacy_v0_1"

def _meeting_type_from_metadata(metadata: Dict[str, Any]) -> str:
    metadata_type = str(metadata.get("type") or "").strip().lower()
    if metadata_type:
        return metadata_type

    content = str(metadata.get("content") or metadata.get("raw_text") or "")
    if not content:
        return ""

    try:
        sections = _parser._split_sections(content)  # type: ignore[attr-defined]
        section_type = str(sections.get("Meeting Type") or "").strip().lower()
        return section_type
    except Exception:
        return ""


def _is_interview_meeting(metadata: Dict[str, Any]) -> bool:
    meeting_type = _meeting_type_from_metadata(metadata)
    if meeting_type == "interview":
        return True
    title = str(metadata.get("title") or "").lower()
    return "interview" in title


def _is_leadership_restricted(metadata: Dict[str, Any]) -> bool:
    """Leadership-restricted docs (Annual Reviews) — see migration
    20260723230000_leadership_restricted_meetings.sql. Checks both the stamped
    access_level and the category so pre-stamp rows are still caught."""
    if str(metadata.get("access_level") or "").strip().lower() == "leadership":
        return True
    return str(metadata.get("category") or "").strip().lower() == "annual review"


def _is_meeting_record(metadata: Dict[str, Any]) -> bool:
    source = str(metadata.get("source") or metadata.get("source_type") or "").strip().lower()
    metadata_type = str(metadata.get("type") or "").strip().lower()
    category = str(metadata.get("category") or "").strip().lower()
    meeting_values = {"meeting", "transcript", "meeting_transcript"}
    if metadata.get("fireflies_id"):
        return True
    if source == "fireflies":
        return True
    return metadata_type in meeting_values or category in meeting_values


def _normalize_task_priority(raw: str | None) -> str:
    if not raw:
        return "medium"
    normalized = str(raw).strip().lower()
    if normalized not in _VALID_PRIORITIES:
        return "medium"
    return normalized


def _is_generic_low_signal_task(task: TaskItem) -> bool:
    description = (task.description or "").strip()
    if len(description) < 24:
        return True
    if _GENERIC_TASK_PREFIX_RE.match(description) and _LOW_SIGNAL_TASK_RE.search(description):
        return True
    return False


def _apply_task_quality_gates(tasks: List[TaskItem]) -> List[TaskItem]:
    """Keep only actionable tasks and normalize confidence-sensitive fields."""
    filtered: List[TaskItem] = []
    dropped = 0
    for task in tasks:
        task.priority = _normalize_task_priority(task.priority)
        has_owner = bool(task.assignee or task.assignee_email)
        has_due_date = bool(task.due_date)
        is_low_signal = _is_generic_low_signal_task(task)

        # Every meeting task must have a known owner — if the LLM couldn't
        # resolve one from the participant list, the task isn't actionable.
        if not has_owner:
            dropped += 1
            continue

        # Drop noisy extraction artifacts that are generic and undated.
        if is_low_signal and not has_due_date:
            dropped += 1
            continue

        # Avoid false urgency when extraction has no deadline signal.
        if not has_due_date and task.priority in {"high", "urgent"}:
            task.priority = "medium"

        filtered.append(task)

    if dropped:
        logger.info("[Extractor] Dropped %d low-signal tasks via quality gates", dropped)
    return filtered


def _normalize_task_match_text(value: str | None) -> str:
    return re.sub(r"[^a-z0-9]+", " ", (value or "").lower()).strip()


def _task_overlap_score(left: str, right: str) -> float:
    left_tokens = {token for token in _normalize_task_match_text(left).split() if len(token) > 2}
    right_tokens = {token for token in _normalize_task_match_text(right).split() if len(token) > 2}
    if not left_tokens or not right_tokens:
        return 0.0
    return len(left_tokens & right_tokens) / max(len(left_tokens), len(right_tokens))


def _enrich_fireflies_tasks_with_llm_context(  # noqa: D401 — kept for backward import compat
    direct_tasks: List[TaskItem],
    llm_tasks: List[TaskItem],
) -> List[TaskItem]:
    """Preserve direct Fireflies wording while backfilling missing LLM context.

    The preferred path is still the newer rewriter, but some callers and tests
    continue to rely on this compatibility function. Keep the original direct
    task description, then copy assignee/due-date/priority from the best
    matching LLM-normalized task only when the direct task is missing that
    context.
    """
    if not direct_tasks:
        return []
    if not llm_tasks:
        return list(direct_tasks)

    enriched: List[TaskItem] = []
    for direct_task in direct_tasks:
        best_match: TaskItem | None = None
        best_score = 0.0

        for llm_task in llm_tasks:
            score = _task_overlap_score(direct_task.description, llm_task.description)
            if score > best_score:
                best_score = score
                best_match = llm_task

        if not best_match or best_score < 0.35:
            enriched.append(direct_task)
            continue

        enriched.append(
            TaskItem(
                description=direct_task.description,
                embedding=direct_task.embedding,
                assignee=direct_task.assignee or best_match.assignee,
                assignee_email=direct_task.assignee_email or best_match.assignee_email,
                due_date=direct_task.due_date or best_match.due_date,
                priority=direct_task.priority or best_match.priority,
            )
        )

    return enriched


# ---------------------------------------------------------------------------
# Deep-extraction ground-truth helpers (Part B)
# ---------------------------------------------------------------------------

def _fetch_project_state(client, project_id: int | None) -> str:
    """Deterministic ground truth for the deep pass — open project tasks via a
    direct DB read rather than legacy derived-intelligence projections.

    Returned as a compact text block the model uses to decide new vs update vs
    resolved. Best-effort: never raises into the pipeline.
    """
    if not project_id:
        return ""
    parts: List[str] = []

    # Project name for orientation.
    try:
        proj = fetch_optional_row(client, "projects", "id,name", "id", project_id)
        if proj.get("name"):
            parts.append(f"Project: {proj['name']} (id={project_id})")
    except Exception as exc:  # noqa: BLE001 — context is optional
        logger.debug("[Extractor] project meta fetch failed: %s", exc)

    # Open / active tasks already tracked.
    try:
        task_rows = (
            client.table("tasks")
            .select("title,assignee_name,due_date,priority,status")
            .eq("project_id", int(project_id))
            .in_("status", ["open", "in_progress", "blocked"])
            .limit(50)
            .execute()
            .data
            or []
        )
        if task_rows:
            lines = []
            for t in task_rows:
                owner = t.get("assignee_name") or "unassigned"
                due = f", due {t['due_date']}" if t.get("due_date") else ""
                lines.append(f"- [{t.get('priority') or 'medium'}] {t.get('title')} ({owner}{due})")
            parts.append("Currently tracked OPEN TASKS:\n" + "\n".join(lines))
    except Exception as exc:  # noqa: BLE001
        logger.debug("[Extractor] open-task state fetch failed: %s", exc)

    return "\n\n".join(parts)


def _fetch_prior_context(project_id: int | None, query_text: str, top_k: int) -> str:
    """One scoped, project-filtered semantic lookup — 'has this surfaced before?'.

    Supporting input only. Best-effort: returns '' on any failure so the deep
    pass never fails for lack of prior context.
    """
    if not project_id or not (query_text or "").strip():
        return ""
    try:
        embedding = llm.batch_embed([query_text[:2000]])
        if not embedding:
            return ""
        rows = (
            get_rag_read_client()
            .rpc(
                "search_document_chunks",
                {
                    "query_embedding": embedding[0],
                    "match_count": top_k,
                    "match_threshold": 0.3,
                    "filter_project_id": int(project_id),
                },
            )
            .execute()
            .data
            or []
        )
        snippets = []
        for r in rows:
            text = r.get("content") or r.get("text") or r.get("chunk_text") or ""
            text = text.strip()
            if text:
                snippets.append(f"- {text[:300]}")
        return "\n".join(snippets[:top_k])
    except Exception as exc:  # noqa: BLE001
        logger.debug("[Extractor] prior-context lookup failed: %s", exc)
        return ""


def _merge_deep_and_rewriter_tasks(
    deep_tasks: List[TaskItem], rewriter_tasks: List[TaskItem]
) -> List[TaskItem]:
    """Keep all deep tasks (they carry evidence + confidence); append only the
    Fireflies-rewriter tasks the deep pass did not already capture (dedupe by
    normalized-description overlap)."""
    merged = list(deep_tasks)
    for rt in rewriter_tasks:
        if any(_task_overlap_score(rt.description, dt.description) >= 0.5 for dt in deep_tasks):
            continue
        merged.append(rt)
    return merged


def run_extractor(metadata_id: str) -> Dict[str, Any]:
    """
    Extract and store structured data from a parsed meeting.

    Returns:
        dict with metadataId, decisions, risks, tasks, opportunities counts
    """
    client = get_supabase_client()
    rag_client = get_rag_write_client()

    # 1. Fetch metadata
    resp = (
        client.table("document_metadata")
        .select("id,title,type,category,source,source_system,project_id,date,captured_at,created_at,summary,overview,status,fireflies_id,participants,participants_array,action_items,source_metadata,access_level")
        .eq("id", metadata_id)
        .single()
        .execute()
    )
    metadata = resp.data
    if not metadata:
        raise ValueError(f"document_metadata not found: {metadata_id}")
    rag_metadata = fetch_optional_row(
        get_rag_read_client(),
        "rag_document_metadata",
        "content,raw_text",
        "id",
        metadata_id,
    )
    if rag_metadata.get("content") or rag_metadata.get("raw_text"):
        metadata = {
            **metadata,
            "content": rag_metadata.get("content"),
            "raw_text": rag_metadata.get("raw_text"),
        }

    if _is_interview_meeting(metadata):
        update_ingestion_job_state(
            metadata_id,
            stage="done",
            error_message=None,
            client=client,
            fireflies_id=str(metadata.get("fireflies_id") or metadata_id),
        )
        client.table("document_metadata").update(
            {"status": "complete"}
        ).eq("id", metadata_id).execute()
        return {
            "metadataId": metadata_id,
            "decisions": 0,
            "risks": 0,
            "tasks": 0,
            "opportunities": 0,
            "skipped": True,
            "skipReason": "interview",
        }

    if _is_leadership_restricted(metadata):
        # Leadership-restricted meetings (e.g. Annual Reviews) must not fan out
        # into insight cards, tasks, or project intelligence — those surfaces
        # are visible to non-leadership users. Embedding still happens (with a
        # leadership stamp on each chunk) so leadership retains AI search.
        update_ingestion_job_state(
            metadata_id,
            stage="done",
            error_message=None,
            client=client,
            fireflies_id=str(metadata.get("fireflies_id") or metadata_id),
        )
        client.table("document_metadata").update(
            {"status": "complete"}
        ).eq("id", metadata_id).execute()
        return {
            "metadataId": metadata_id,
            "decisions": 0,
            "risks": 0,
            "tasks": 0,
            "opportunities": 0,
            "skipped": True,
            "skipReason": "leadership_restricted",
        }

    is_meeting = _is_meeting_record(metadata)

    title = metadata.get("title") or "Untitled"
    started_at = metadata.get("started_at") or metadata.get("captured_at")
    participants: List[str] = metadata.get("participants_array") or []
    meeting_summary = (
        metadata.get("overview")
        or metadata.get("meeting_summary")
        or ""
    )

    logger.info("[Extractor] Processing: %s (%s)", title, metadata_id)

    # 2. Fetch segments to collect raw items
    seg_resp = (
        client.table("meeting_segments")
        .select("decisions", "risks", "tasks")
        .eq("metadata_id", metadata_id)
        .execute()
    )
    segment_rows = seg_resp.data or []

    raw_decisions: List[str] = []
    raw_risks: List[str] = []
    raw_tasks: List[str] = []

    for row in segment_rows:
        if row.get("decisions"):
            raw_decisions.extend(row["decisions"])
        if row.get("risks"):
            raw_risks.extend(row["risks"])
        if row.get("tasks"):
            raw_tasks.extend(row["tasks"])

    # Also include action_items stored in metadata (meeting-only).
    # Guard: Fireflies sometimes writes "{}" (empty-dict stringified) — skip that garbage.
    if is_meeting:
        action_items_raw = metadata.get("action_items") or ""
        _JUNK_ACTION_ITEMS = frozenset(("{}", "[]", "null", "none", "{}"))
        if action_items_raw and action_items_raw.strip() not in _JUNK_ACTION_ITEMS:
            raw_tasks.extend(
                t.strip() for t in action_items_raw.split("\n")
                if t.strip() and t.strip() not in _JUNK_ACTION_ITEMS
            )

    # 2b. Extract rich section context for enhanced task extraction
    content = metadata.get("content") or metadata.get("raw_text") or ""
    notes_context = ""
    speaker_email_map: Dict[str, str] = {}
    fireflies_action_items: List[str] = []
    parsed_attendees: List[str] = []
    parsed_captured_at = None
    if content and is_meeting:
        try:
            parsed = _parser.parse_markdown(content)
            # Build notes context from notes topics + action items section
            notes_parts: List[str] = []
            for topic_name, topic_content in (parsed.notes_topics or {}).items():
                notes_parts.append(f"### {topic_name}\n{topic_content}")
            rich = parsed.rich_sections or {}
            action_items_section = (
                rich.get("Action Items", "")
                or rich.get("Major Action Items", "")
                or rich.get("Outstanding Tasks", "")
            )
            if action_items_section:
                notes_parts.append(f"### Action Items\n{action_items_section}")
            notes_context = "\n\n".join(notes_parts)
            speaker_email_map = parsed.speaker_email_map or {}
            fireflies_action_items = list(parsed.action_items or [])
            parsed_attendees = list(parsed.attendees or [])
            parsed_captured_at = parsed.captured_at
            if speaker_email_map:
                logger.info("[Extractor] Speaker-email map: %s", speaker_email_map)
        except Exception as exc:
            logger.warning("[Extractor] Failed to parse rich sections: %s", exc)
    elif not is_meeting:
        logger.info(
            "[Extractor] Non-meeting metadata (%s/%s) -> task extraction disabled",
            metadata.get("type"),
            metadata.get("category"),
        )

    logger.info(
        "[Extractor] Raw: %d decisions, %d risks, %d tasks | Notes context: %d chars",
        len(raw_decisions), len(raw_risks), len(raw_tasks), len(notes_context),
    )

    # 3. Structured extraction — deep (full-transcript, ground-truth-aware) or
    #    the legacy shallow segment-normalization pass.
    date_str = started_at[:10] if started_at else None
    doc_project_id = metadata.get("project_id")
    structured: StructuredData | None = None
    deep_used = False

    if DEEP_EXTRACTION_ENABLED and is_meeting and content:
        try:
            project_state = _fetch_project_state(client, doc_project_id)
            prior_context = _fetch_prior_context(
                doc_project_id, meeting_summary or title, DEEP_PRIOR_CONTEXT_TOPK
            )
            deep = llm.extract_deep_meeting_intelligence(
                title=title,
                date=date_str,
                participants=participants,
                full_transcript=content,
                project_state=project_state,
                prior_context=prior_context,
                speaker_email_map=speaker_email_map,
            )
            if any(
                [deep.decisions, deep.risks, deep.tasks, deep.opportunities, deep.insights]
            ):
                structured = deep
                deep_used = True
                logger.info(
                    "[Extractor] Deep extraction used (project=%s): %d decisions, %d risks, "
                    "%d opportunities, %d insights, %d tasks",
                    doc_project_id,
                    len(deep.decisions),
                    len(deep.risks),
                    len(deep.opportunities),
                    len(deep.insights),
                    len(deep.tasks),
                )
            else:
                logger.warning(
                    "[Extractor] Deep extraction returned no items; falling back to shallow pass"
                )
        except Exception as exc:  # noqa: BLE001 — never let the deep path break ingestion
            logger.exception("[Extractor] Deep extraction failed; falling back to shallow: %s", exc)

    if structured is None:
        structured = llm.extract_structured_data(
            title=title,
            date=date_str,
            participants=participants,
            summary=meeting_summary,
            raw_decisions=raw_decisions,
            raw_risks=raw_risks,
            raw_tasks=raw_tasks,
            notes_context=notes_context,
            speaker_email_map=speaker_email_map,
        )

    logger.info(
        "[Extractor] Structured: %d decisions, %d risks, %d tasks, %d opportunities, %d insights (deep=%s)",
        len(structured.decisions),
        len(structured.risks),
        len(structured.tasks),
        len(structured.opportunities),
        len(structured.insights),
        deep_used,
    )
    rewritten_fireflies_tasks: List[Any] = []
    if fireflies_action_items and is_meeting:
        from ..ingestion.fireflies_task_rewriter import rewrite_action_items  # lazy: see top-of-module note

        source_date_iso = None
        if parsed_captured_at is not None:
            if hasattr(parsed_captured_at, "date"):
                source_date_iso = parsed_captured_at.date().isoformat()
            elif isinstance(parsed_captured_at, str):
                source_date_iso = parsed_captured_at[:10]
        rewritten_fireflies_tasks = rewrite_action_items(
            meeting_title=title,
            action_items=fireflies_action_items,
            participants=parsed_attendees,
            speaker_email_map=speaker_email_map,
            source_date=source_date_iso,
            notes_context=notes_context,
        )
        rewriter_as_tasks = [
            TaskItem(
                description=t.description or t.title,
                assignee=t.assignee_name,
                assignee_email=t.assignee_email,
                due_date=t.due_date,
                priority=t.priority,
            )
            for t in rewritten_fireflies_tasks
        ]
        if deep_used:
            # Deep tasks (with evidence + confidence) are primary; backfill only
            # the Fireflies action items the deep pass missed. Then apply the
            # owner/low-signal quality gates to the merged set.
            structured.tasks = _apply_task_quality_gates(
                _merge_deep_and_rewriter_tasks(structured.tasks, rewriter_as_tasks)
            )
        else:
            # Legacy behavior: the rewriter is owner-aware and imperative; replace
            # the shallow LLM tasks to avoid double-counting third-person narration.
            structured.tasks = rewriter_as_tasks
        logger.info(
            "[Extractor] Tasks after Fireflies-rewriter merge: %d (deep=%s)",
            len(structured.tasks),
            deep_used,
        )
    else:
        structured.tasks = _apply_task_quality_gates(structured.tasks)
    logger.info("[Extractor] Tasks after quality gates: %d", len(structured.tasks))

    # 4. Batch embed all descriptions in one call
    all_descriptions = [
        *[d.description for d in structured.decisions],
        *[r.description for r in structured.risks],
        *[t.description for t in structured.tasks],
        *[o.description for o in structured.opportunities],
    ]
    embeddings = llm.batch_embed(all_descriptions) if all_descriptions else []

    idx = 0
    for item in structured.decisions:
        item.embedding = embeddings[idx] if idx < len(embeddings) else None
        idx += 1
    for item in structured.risks:
        item.embedding = embeddings[idx] if idx < len(embeddings) else None
        idx += 1
    for item in structured.tasks:
        item.embedding = embeddings[idx] if idx < len(embeddings) else None
        idx += 1
    for item in structured.opportunities:
        item.embedding = embeddings[idx] if idx < len(embeddings) else None
        idx += 1

    # 5. Store structured data
    # Resolve project_ids from document_metadata so tasks are linked to projects
    doc_project_id = metadata.get("project_id")
    project_ids = [doc_project_id] if doc_project_id else []

    tasks_to_persist = structured.tasks if is_meeting else []
    # Build a lookup so _upsert_task can attach rewriter title + provenance
    # without changing the TaskItem dataclass.
    rewriter_lookup: Dict[str, Any] = {}
    for r in rewritten_fireflies_tasks:
        if r.title:
            rewriter_lookup[(r.description or r.title).strip().lower()] = r
    # Replace task set for this meeting to avoid stale rows from prior runs
    # (for example tasks created before project assignment existed).
    # Guard deletion behind meeting classification so we never wipe existing
    # Fireflies tasks for a row mis-tagged as a non-meeting document.
    if is_meeting:
        client.table("tasks").delete().eq("metadata_id", metadata_id).eq(
            "source_system", "fireflies"
        ).execute()
    else:
        logger.info(
            "[Extractor] Skipping Fireflies task replacement for non-meeting metadata_id=%s",
            metadata_id,
        )
    persisted_task_count = 0
    for task in tasks_to_persist:
        rewriter_match = rewriter_lookup.get((task.description or "").strip().lower())
        if _upsert_task(
            client,
            task,
            metadata_id,
            project_ids,
            doc_project_id,
            metadata.get("client_id"),
            rewriter_match=rewriter_match,
        ):
            persisted_task_count += 1
    # 6. Mark job done and metadata complete
    update_ingestion_job_state(
        metadata_id,
        stage="done",
        error_message=None,
        client=client,
    )

    client.table("document_metadata").update(
        {"status": "complete"}
    ).eq("id", metadata_id).execute()

    return {
        "metadataId": metadata_id,
        "insights": len(structured.decisions) + len(structured.risks) + len(structured.opportunities),
        "decisions": len(structured.decisions),
        "risks": len(structured.risks),
        "opportunities": len(structured.opportunities),
        "tasks": persisted_task_count,
        "tasksAttempted": len(tasks_to_persist),
        "tasksSkipped": max(len(tasks_to_persist) - persisted_task_count, 0),
    }


_TITLE_CLAUSE_RE = re.compile(
    r"(?:,\s+(?:especially|including|particularly|such as|e\.g\.|for example)"
    r"|;\s+|\.\s+| — | and explore | to support (?!a\b))",
    re.I,
)
_TIMESTAMP_RE = re.compile(r"\s*\(\d{2}:\d{2}:\d{2}\)\s*$")


def _derive_title(description: str | None) -> str:
    """Generate a concise imperative title (max ~65 chars) from a task description."""
    text = _TIMESTAMP_RE.sub("", (description or "").strip())
    m = _TITLE_CLAUSE_RE.search(text)
    if m and m.start() > 15:
        text = text[: m.start()].strip()
    if len(text) > 65:
        cut = text[:65].rsplit(" ", 1)[0]
        text = cut if len(cut) >= 20 else text[:65]
    return text.rstrip(",.;:- ")[:120]


_TRADE_ROLE_NAMES: frozenset[str] = frozenset({
    "mechanical", "electrical", "plumbing", "structural", "civil",
    "interior", "landscape", "architecture", "architectural",
    "contractor", "subcontractor", "electrician", "owner", "team",
    "everyone", "all", "unknown", "tbd",
})


def _upsert_task(
    client,
    task: TaskItem,
    metadata_id: str,
    project_ids: List[int] | None = None,
    project_id: int | None = None,
    client_id: int | None = None,
    rewriter_match: Any = None,
    source_system: str = "fireflies",
) -> bool:
    resolved_project_id = project_id
    if resolved_project_id is None and project_ids:
        try:
            resolved_project_id = int(project_ids[0])
        except (TypeError, ValueError):
            resolved_project_id = None
    resolved_project_ids = list(project_ids or [])
    if resolved_project_id is not None:
        try:
            scalar_project_id = int(resolved_project_id)
        except (TypeError, ValueError):
            scalar_project_id = None
        if scalar_project_id is not None and scalar_project_id not in resolved_project_ids:
            resolved_project_ids.append(scalar_project_id)

    # Reject role/trade names that are not real people.
    if (task.assignee or "").strip().lower() in _TRADE_ROLE_NAMES:
        logger.info(
            "Skipping trade-role assignee: assignee=%r description=%r",
            task.assignee,
            (task.description or "")[:80],
        )
        return False

    # Only employees can own tasks. Skip external owners.
    assignee = TaskAssigneeResolver(client).resolve(task.assignee, task.assignee_email)
    if not assignee.is_employee:
        logger.info(
            "Skipping non-employee task: assignee=%r person_type=%r description=%r",
            task.assignee,
            assignee.person_type,
            (task.description or "")[:120],
        )
        return False

    title = (rewriter_match.title if rewriter_match else None) or _derive_title(task.description)
    if not title:
        logger.info(
            "Skipping task with no derivable title: description=%r",
            (task.description or "")[:120],
        )
        return False

    extraction_metadata: Dict[str, Any] = {
        "assignee_resolution_method": assignee.method,
        "assignee_resolution_confidence": assignee.confidence,
        "assignee_person_type": assignee.person_type,
    }
    # Daily deep-read governance annotations are carried on TaskItem so the
    # final task row retains classification and source lineage for review.
    if getattr(task, "task_governance", None):
        extraction_metadata["task_governance"] = dict(task.task_governance)
    if getattr(task, "provenance", None):
        extraction_metadata["provenance"] = dict(task.provenance)
    if rewriter_match is not None:
        # Lazy import (see top-of-module note about the circular load order).
        from ..ingestion.fireflies_task_rewriter import REWRITER_PROMPT_VERSION as _RPV

        extraction_metadata.update(
            {
                "rewriter_confidence": rewriter_match.confidence,
                "source_action_item": rewriter_match.source_action_item,
            }
        )
        prompt_version = _RPV
    else:
        prompt_version = None

    # Deep-extraction provenance + confidence gate (Part C). Deep tasks must
    # record a prompt version to satisfy the tasks-quality trigger. Tasks from the deep
    # read carry an evidence quote and a calibrated confidence. Below the
    # threshold we still write the task but flag needs_review so a human promotes
    # it — never silently auto-create a low-confidence actionable task. (The tasks
    # table CHECK has no 'needs_review' status, so the flag lives in metadata.)
    is_deep_task = (not rewriter_match) and (task.confidence is not None)
    if is_deep_task:
        extraction_metadata["deep_confidence"] = task.confidence
        if task.evidence_quote:
            extraction_metadata["evidence_quote"] = task.evidence_quote
        if task.status_hint:
            extraction_metadata["status_hint"] = task.status_hint
        if task.confidence < DEEP_TASK_CONFIDENCE_THRESHOLD:
            extraction_metadata["needs_review"] = True
            logger.info(
                "[Extractor] Deep task below confidence gate (%.2f < %.2f) flagged needs_review: %r",
                task.confidence,
                DEEP_TASK_CONFIDENCE_THRESHOLD,
                (task.description or "")[:80],
            )

    if rewriter_match:
        extraction_source = "fireflies_rewriter"
    elif is_deep_task:
        extraction_source = "deep_extractor"
        prompt_version = DEEP_EXTRACTION_PROMPT_VERSION
    else:
        extraction_source = "fireflies_pipeline_legacy"
        prompt_version = LEGACY_FIREFLIES_TASK_PROMPT_VERSION

    data = {
        "metadata_id": metadata_id,
        "title": title,
        "description": task.description,
        "assignee_name": assignee.name or task.assignee,
        "assignee_person_id": assignee.person_id,
        "assigned_by": rewriter_match.assigned_by if rewriter_match else None,
        "due_date": task.due_date,
        "priority": task.priority,
        "embedding": task.embedding,
        "status": "open",
        "source_system": source_system,
        "project_ids": resolved_project_ids,
        "project_id": resolved_project_id,
        "client_id": client_id,
        "extraction_source": extraction_source,
        "extraction_model": "gpt-5.5" if (rewriter_match or is_deep_task) else None,
        "extraction_prompt_version": prompt_version,
        "extraction_metadata": extraction_metadata,
    }
    email = assignee.email or task.assignee_email
    if email:
        data["assignee_email"] = email
    client.table("tasks").upsert(
        data,
        on_conflict="metadata_id,description",
    ).execute()
    return True
