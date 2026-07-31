"""
OpenAI helpers for the ingestion pipeline.
"""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List, Optional

from openai import OpenAI

from ..ai_transport import (
    alternate_provider_path,
    get_ai_provider_path,
    get_openai_client,
    is_auth_or_credit_error,
    retry_ai_call,
)
from .config import EMBEDDING_MODEL, MODEL_SIGNAL_EXTRACTION
from .model_usage import ModelUsageContext, assert_background_model_budget_available, record_model_usage
from .models import (
    DecisionItem,
    FlagItem,
    InsightItem,
    MeetingSegment,
    OpportunityItem,
    RiskItem,
    StructuredData,
    TaskItem,
)

# Maps each supported embedding model to its native output dimension.
# If batch_embed is called with a non-default model, we look up the correct
# dimensions here rather than blindly passing EMBEDDING_DIMENSIONS (3072),
# which would silently fail or truncate for small models (max 1536).
_MODEL_DIMENSIONS: dict[str, int] = {
    "text-embedding-3-large": 3_072,
    "text-embedding-3-small": 1_536,
    "text-embedding-ada-002": 1_536,
}

logger = logging.getLogger(__name__)

CHAT_MODEL = MODEL_SIGNAL_EXTRACTION
SEGMENT_TRANSCRIPT_MAX_CHARS = int(os.getenv("SEGMENT_TRANSCRIPT_MAX_CHARS", "0"))

# Safety ceiling for the deep, full-transcript pass — sized to the large-context
# compiler model, NOT the small chat model. ~600k chars ≈ 150k tokens, well
# inside gpt-5.5's window while bounding cost on a pathological transcript.
# Tune via env without code changes.
DEEP_TRANSCRIPT_MAX_CHARS = int(os.getenv("DEEP_TRANSCRIPT_MAX_CHARS", "600000"))
# Per-request timeout for the deep pass. A full-transcript reasoning call is far
# slower than the Teams-compiler's short default (60s) — a 130k-char transcript
# can take several minutes — so the deep pass uses its own generous ceiling.
DEEP_EXTRACTION_TIMEOUT_SECONDS = int(os.getenv("DEEP_EXTRACTION_TIMEOUT_SECONDS", "300"))


def _client() -> OpenAI:
    from ..ai_transport import get_openai_client
    return get_openai_client()


# ---------------------------------------------------------------------------
# Embeddings
# ---------------------------------------------------------------------------

def batch_embed(
    texts: List[str],
    model: str = EMBEDDING_MODEL,
    usage_context: ModelUsageContext | None = None,
) -> List[List[float]]:
    """Embed a batch of texts. Returns a list of embedding vectors."""
    if not texts:
        return []
    dimensions = _MODEL_DIMENSIONS.get(model)
    if dimensions is None:
        raise ValueError(
            f"Unknown embedding model '{model}'. Add it to _MODEL_DIMENSIONS in llm.py "
            f"with its native dimension count before calling batch_embed."
        )
    truncated = [t[:8000] for t in texts]
    logger.info("[LLM] Embedding %d texts with %s (dimensions=%d)", len(texts), model, dimensions)
    context = usage_context or ModelUsageContext(stage="indexed_for_rag", operation="batch_embed")
    assert_background_model_budget_available(
        stage=context.stage,
        operation=context.operation,
        model=model,
    )
    def _create(force_path: Optional[str] = None):
        client = get_openai_client(force_path=force_path) if force_path else _client()
        return retry_ai_call(
            lambda: client.embeddings.create(
                model=model,
                input=truncated,
                dimensions=dimensions,
            ),
            provider_name="OpenAI" if force_path == "openai" else "AI provider",
            operation="embedding batch",
        )

    # Fail over between the AI Gateway and direct OpenAI on a provider-level
    # auth/credit wall (e.g. gateway spend-cap 401) — the historical root cause
    # of silent embedding outages. Without this the meeting/document embed path
    # dies on a gateway cap-out while the graph path (which already has failover)
    # survives. Keeps reliability a property of the transport, not one function.
    primary_path = get_ai_provider_path()
    try:
        response = _create()
    except Exception as exc:
        alt_path = alternate_provider_path(primary_path)
        if alt_path is not None and is_auth_or_credit_error(exc):
            logger.warning(
                "[LLM] Primary provider '%s' hit an auth/credit wall (%s); "
                "failing over to '%s' for this embedding batch.",
                primary_path,
                exc,
                alt_path,
            )
            response = _create(force_path=alt_path)
        else:
            raise
    record_model_usage(
        context,
        model=model,
        response=response,
        status="succeeded",
        input_items=len(texts),
        output_items=len(embeddings := [item.embedding for item in response.data]),
    )
    if len(embeddings) != len(texts):
        raise RuntimeError(f"expected {len(texts)} embeddings, got {len(embeddings)}")
    logger.info("[LLM] Embedded %d texts via OpenAI", len(texts))
    return embeddings


# ---------------------------------------------------------------------------
# Chat completions
# ---------------------------------------------------------------------------

def _call_llm(prompt: str, json_mode: bool = False, max_tokens: Optional[int] = None) -> str:
    context = ModelUsageContext(stage="signals_extracted", operation="pipeline_chat_completion")
    assert_background_model_budget_available(
        stage=context.stage,
        operation=context.operation,
        model=CHAT_MODEL,
    )
    kwargs: Dict[str, Any] = {
        "model": CHAT_MODEL,
        "messages": [{"role": "user", "content": prompt}],
        "temperature": 0.3,
    }
    if max_tokens:
        kwargs["max_tokens"] = max_tokens

    provider_path = get_ai_provider_path()
    logger.info("[LLM] Calling %s via %s (json=%s)", CHAT_MODEL, provider_path, json_mode)
    if json_mode and provider_path != "vercel_gateway":
        kwargs["response_format"] = {"type": "json_object"}
    elif json_mode:
        logger.info(
            "[LLM] Skipping response_format=json_object for AI Gateway; enforcing JSON through prompt contract."
        )

    try:
        response = retry_ai_call(
            lambda: _client().chat.completions.create(**kwargs),
            provider_name="OpenAI",
            operation="chat completion",
        )
    except Exception as exc:
        message = str(exc).lower()
        response_format_rejected = (
            json_mode
            and "response_format" in message
            and (
                "invalid input" in message
                or "invalid_request_error" in message
                or "unsupported" in message
            )
        )
        if not response_format_rejected:
            raise

        logger.warning(
            "[LLM] %s rejected response_format=json_object; retrying once with prompt-only JSON contract.",
            CHAT_MODEL,
        )
        fallback_kwargs = dict(kwargs)
        fallback_kwargs.pop("response_format", None)
        response = retry_ai_call(
            lambda: _client().chat.completions.create(**fallback_kwargs),
            provider_name="OpenAI",
            operation="chat completion without response_format",
        )
    record_model_usage(context, model=CHAT_MODEL, response=response, status="succeeded")
    return response.choices[0].message.content or ""


# ---------------------------------------------------------------------------
# Meeting summary
# ---------------------------------------------------------------------------

def generate_meeting_summary(transcript_excerpt: str, title: str, existing_summary: str = "") -> str:
    prompt = f"""Generate a comprehensive executive summary of this meeting.

Meeting: {title}
{f"Existing Summary: {existing_summary}" if existing_summary else ""}

Transcript excerpt:
{transcript_excerpt[:12000]}

Write a 3-5 paragraph summary covering:
1. Meeting purpose and key participants
2. Main topics discussed
3. Key decisions and outcomes
4. Action items and next steps
5. Any risks or concerns raised

Be specific and include names, dates, and concrete details where mentioned."""

    return _call_llm(prompt)


# ---------------------------------------------------------------------------
# Transcript segmentation
# ---------------------------------------------------------------------------

def segment_transcript(
    formatted_transcript: str,
    title: str,
    max_chars: Optional[int] = None,
) -> List[Dict[str, Any]]:
    """Returns a list of segment dicts with title/start_index/end_index/summary/decisions/risks/tasks."""
    effective_max_chars = max_chars
    if effective_max_chars is None and SEGMENT_TRANSCRIPT_MAX_CHARS > 0:
        effective_max_chars = SEGMENT_TRANSCRIPT_MAX_CHARS

    transcript_for_prompt = formatted_transcript
    if (
        effective_max_chars is not None
        and len(formatted_transcript) > effective_max_chars
    ):
        logger.warning(
            "[LLM] segment_transcript input truncated from %d to %d chars",
            len(formatted_transcript),
            effective_max_chars,
        )
        transcript_for_prompt = formatted_transcript[:effective_max_chars]

    prompt = f"""Analyze this meeting transcript and identify distinct semantic segments (topic changes, agenda items, discussion phases).

Meeting: {title}

Transcript (each line prefixed with [index]):
{transcript_for_prompt}

Return JSON array of segments. Each segment should capture a coherent topic or discussion phase.

Required format:
{{
  "segments": [
    {{
      "title": "Brief descriptive title for this segment",
      "start_index": 0,
      "end_index": 15,
      "summary": "2-3 sentence summary of what was discussed",
      "decisions": ["Any decisions made in this segment"],
      "risks": ["Any risks or concerns raised"],
      "tasks": ["Any action items or tasks assigned"]
    }}
  ]
}}

Guidelines:
- Segments should be 10-50 lines typically
- Every line must belong to exactly one segment
- Capture natural topic transitions
- Include opening/closing segments if present
- Extract decisions, risks, tasks mentioned in each segment"""

    raw = _call_llm(prompt, json_mode=True)
    try:
        parsed = json.loads(raw)
    except Exception as exc:
        logger.warning(
            "[LLM] segment_transcript returned non-JSON (title=%s); returning empty segments. Error: %s",
            title, exc,
        )
        logger.debug("[LLM] Raw segment_transcript response: %.500s", raw)
        return []
    return parsed.get("segments", [])


# ---------------------------------------------------------------------------
# Structured data extraction
# ---------------------------------------------------------------------------

def extract_structured_data(
    title: str,
    date: Optional[str],
    participants: List[str],
    summary: str,
    raw_decisions: List[str],
    raw_risks: List[str],
    raw_tasks: List[str],
    notes_context: str = "",
    speaker_email_map: Optional[Dict[str, str]] = None,
) -> StructuredData:
    # Build speaker email mapping context for the prompt
    email_map_text = ""
    if speaker_email_map:
        mappings = [f"  {name} → {email}" for name, email in speaker_email_map.items()]
        email_map_text = f"\n\nSpeaker Email Mapping (use for assignee_email):\n" + "\n".join(mappings)

    notes_text = ""
    if notes_context:
        notes_text = f"\n\nAdditional Notes & Action Items from Meeting:\n{notes_context[:6000]}"

    prompt = f"""Analyze and normalize these meeting extractions. Deduplicate, add context, and identify opportunities.

Meeting: {title}
Date: {date or "Unknown"}
Participants: {", ".join(participants)}{email_map_text}

Raw Decisions: {json.dumps(raw_decisions)}
Raw Risks: {json.dumps(raw_risks)}
Raw Tasks: {json.dumps(raw_tasks)}{notes_text}

Meeting Summary: {summary[:2000]}

Return JSON with normalized, deduplicated entries:
{{
  "decisions": [
    {{"description": "Clear description", "rationale": "Why decided", "owner": "Person name or null"}}
  ],
  "risks": [
    {{"description": "Risk description", "category": "schedule|budget|resource|technical|external", "likelihood": "low|medium|high", "impact": "low|medium|high", "owner": "Person or null"}}
  ],
  "tasks": [
    {{"description": "Task description", "assignee": "Person name or null", "assigneeEmail": "email@example.com or null", "dueDate": "YYYY-MM-DD or null", "priority": "low|medium|high|urgent"}}
  ],
  "opportunities": [
    {{"description": "Opportunity description", "type": "efficiency|revenue|relationship|innovation", "owner": "Person or null"}}
  ]
}}

Guidelines:
- Deduplicate similar items across all sources (raw tasks AND the Notes/Action Items above)
- Extract tasks from BOTH the raw tasks AND the Notes/Action Items sections — do not miss any
- Infer owners from context when possible
- Convert vague items to specific actionable descriptions
- Map assignee names to emails using the Speaker Email Mapping above when available
- Priority rules:
  * "urgent" if health, safety, inspection, compliance, or hard deadline mentioned
  * "high" if financial impact > $10k or blocking other work
  * "medium" for standard follow-ups and action items
  * "low" for nice-to-haves and optional follow-ups
- Due date rules:
  * Calculate relative dates from the meeting date ({date or "Unknown"})
  * "by Friday" → next Friday from meeting date
  * "next week" → Monday of following week
  * "end of month" → last day of meeting month
  * "ASAP" → meeting date + 2 business days
  * If no date mentioned, leave as null
- Identify implied opportunities from discussion"""

    raw = _call_llm(prompt, json_mode=True)
    try:
        data = json.loads(raw)
    except Exception as exc:
        logger.warning("[LLM] Structured extraction returned non-JSON; continuing without extracted items: %s", exc)
        return StructuredData()

    # Resolve emails from map if LLM didn't set them
    _email_map = speaker_email_map or {}

    decisions = [
        DecisionItem(
            description=d.get("description", ""),
            rationale=d.get("rationale"),
            owner=d.get("owner"),
        )
        for d in data.get("decisions", [])
        if d.get("description")
    ]
    risks = [
        RiskItem(
            description=r.get("description", ""),
            category=r.get("category"),
            likelihood=r.get("likelihood"),
            impact=r.get("impact"),
            owner=r.get("owner"),
        )
        for r in data.get("risks", [])
        if r.get("description")
    ]
    tasks = []
    for t in data.get("tasks", []):
        if not t.get("description"):
            continue
        assignee = t.get("assignee")
        assignee_email = t.get("assigneeEmail")
        # Fallback: resolve email from map if LLM didn't provide one
        if not assignee_email and assignee and assignee in _email_map:
            assignee_email = _email_map[assignee]
        tasks.append(
            TaskItem(
                description=t.get("description", ""),
                assignee=assignee,
                assignee_email=assignee_email,
                due_date=_parse_date(t.get("dueDate")),
                priority=t.get("priority"),
            )
        )
    opportunities = [
        OpportunityItem(
            description=o.get("description", ""),
            type=o.get("type"),
            owner=o.get("owner"),
        )
        for o in data.get("opportunities", [])
        if o.get("description")
    ]

    return StructuredData(decisions=decisions, risks=risks, tasks=tasks, opportunities=opportunities)


# ---------------------------------------------------------------------------
# Deep, full-transcript meeting intelligence extraction
# ---------------------------------------------------------------------------

def _coerce_confidence(raw: Any, default: float = 0.6) -> float:
    """Clamp a model-provided confidence into [0, 1], falling back to default."""
    try:
        value = float(raw)
    except (TypeError, ValueError):
        return default
    if value != value:  # NaN guard
        return default
    return max(0.0, min(1.0, value))


def _coerce_status_hint(raw: Any) -> Optional[str]:
    value = str(raw or "").strip().lower()
    return value if value in {"new", "update", "resolved"} else None


def _coerce_severity(raw: Any) -> Optional[int]:
    """Clamp a model-provided severity into the integer range [1, 5]; None if absent/invalid."""
    if raw is None or raw == "":
        return None
    try:
        value = int(float(raw))
    except (TypeError, ValueError):
        return None
    return max(1, min(5, value))


def extract_deep_meeting_intelligence(
    *,
    title: str,
    date: Optional[str],
    participants: List[str],
    full_transcript: str,
    project_state: str,
    prior_context: str = "",
    speaker_email_map: Optional[Dict[str, str]] = None,
) -> StructuredData:
    """Deep extraction: read the *whole* transcript against the project's *real*
    state and emit evidence-linked, confidence-calibrated risks / decisions /
    opportunities / insights / tasks, each tagged new|update|resolved.

    Uses the configured signal-extraction model. The full transcript is passed
    uncapped except for a safety ceiling at the model's real context limit
    (``DEEP_TRANSCRIPT_MAX_CHARS``).
    """
    transcript = full_transcript or ""
    if len(transcript) > DEEP_TRANSCRIPT_MAX_CHARS:
        logger.warning(
            "[LLM] deep extraction transcript truncated from %d to %d chars (safety ceiling)",
            len(transcript),
            DEEP_TRANSCRIPT_MAX_CHARS,
        )
        transcript = transcript[:DEEP_TRANSCRIPT_MAX_CHARS]

    email_map_text = ""
    if speaker_email_map:
        mappings = [f"  {name} → {email}" for name, email in speaker_email_map.items()]
        email_map_text = "\n\nSpeaker Email Mapping (use for task owner emails):\n" + "\n".join(mappings)

    prior_block = ""
    if prior_context.strip():
        prior_block = (
            "\n\nRELATED HISTORY (semantic prior context — supporting only, may be "
            "noisy; do NOT invent items from it):\n" + prior_context.strip()
        )

    prompt = f"""You are the senior project intelligence analyst for a construction \
project-management firm. Read the ENTIRE meeting transcript below and compare it \
against the project's CURRENT TRACKED STATE. Produce the new or changed risks, \
decisions, opportunities, insights, and tasks.

For EVERY item you MUST:
- ground it in the transcript with a short verbatim `evidence_quote` (≤ 240 chars, \
copied from the transcript — never paraphrased or invented),
- assign a calibrated `confidence` in [0,1] (1 = explicitly stated and unambiguous; \
0.5 = reasonably implied; below 0.4 = speculative),
- set `status_hint`: "new" (not in current state), "update" (changes/expands a \
tracked item), or "resolved" (a tracked item that this meeting closes out).

Do NOT fabricate. If the transcript does not support an item, omit it. Prefer fewer, \
higher-confidence items over many weak ones. Catch IMPLIED action items and owner \
assignments that a naive action-item list would miss.

Meeting: {title}
Date: {date or "Unknown"}
Participants: {", ".join(participants) if participants else "Unknown"}{email_map_text}

CURRENT TRACKED PROJECT STATE (ground truth — use to decide new vs update vs resolved):
{project_state or "(no tracked state available)"}{prior_block}

FULL MEETING TRANSCRIPT:
{transcript}

Return JSON in EXACTLY this shape (omit empty arrays’ items, never the keys):
{{
  "what_changed": "One short paragraph: what materially changed on this project since it was last tracked. Empty string if nothing material.",
  "decisions": [
    {{"description": "...", "rationale": "...", "owner": "Name or null", "evidence_quote": "...", "confidence": 0.0, "status_hint": "new|update|resolved"}}
  ],
  "risks": [
    {{"description": "...", "category": "schedule|budget|cost|resource|technical|external", "likelihood": "low|medium|high", "impact": "low|medium|high", "owner": "Name or null", "evidence_quote": "...", "confidence": 0.0, "status_hint": "new|update|resolved"}}
  ],
  "opportunities": [
    {{"description": "...", "type": "efficiency|revenue|relationship|innovation", "owner": "Name or null", "evidence_quote": "...", "confidence": 0.0, "status_hint": "new|update|resolved"}}
  ],
  "insights": [
    {{"description": "...", "category": "status|open_question|context", "owner": "Name or null", "evidence_quote": "...", "confidence": 0.0, "status_hint": "new|update|resolved"}}
  ],
  "tasks": [
    {{"description": "Imperative action", "assignee": "Name or null", "assigneeEmail": "email or null", "dueDate": "YYYY-MM-DD or null", "priority": "low|medium|high|urgent", "evidence_quote": "...", "confidence": 0.0, "status_hint": "new|update|resolved"}}
  ]
}}

Task rules:
- Owners must be real people from the participant list; map names→emails via the mapping above.
- Due dates: resolve relative phrases against the meeting date ({date or "Unknown"}); null if none stated.
- priority: "urgent" only for safety/inspection/compliance/hard-deadline; "high" for >$10k impact or blocking; else "medium"/"low".
Output ONLY the JSON object."""

    # Lazy import: the intelligence package eagerly loads the compiler at startup,
    # so a top-level import risks a circular load order under FastAPI/pytest.
    from ..intelligence.client import extract_with_retry
    from .config import MODEL_SIGNAL_EXTRACTION

    logger.info(
        "[LLM] Deep extraction via %s (transcript=%d chars, state=%d chars)",
        MODEL_SIGNAL_EXTRACTION,
        len(transcript),
        len(project_state or ""),
    )
    data = extract_with_retry(
        [{"role": "user", "content": prompt}],
        model=MODEL_SIGNAL_EXTRACTION,
        timeout=DEEP_EXTRACTION_TIMEOUT_SECONDS,
        usage_context=ModelUsageContext(
            stage="signals_extracted",
            operation="deep_meeting_signal_extraction",
            metadata={"title": title, "date": date},
        ),
    )
    if data.get("_extraction_failed"):
        logger.error("[LLM] Deep extraction failed: %s", data.get("_errors"))
        return StructuredData()

    _email_map = speaker_email_map or {}

    decisions = [
        DecisionItem(
            description=d.get("description", ""),
            rationale=d.get("rationale"),
            owner=d.get("owner"),
            evidence_quote=d.get("evidence_quote"),
            confidence=_coerce_confidence(d.get("confidence")),
            status_hint=_coerce_status_hint(d.get("status_hint")),
        )
        for d in data.get("decisions", [])
        if d.get("description")
    ]
    risks = [
        RiskItem(
            description=r.get("description", ""),
            category=r.get("category"),
            likelihood=r.get("likelihood"),
            impact=r.get("impact"),
            owner=r.get("owner"),
            evidence_quote=r.get("evidence_quote"),
            confidence=_coerce_confidence(r.get("confidence")),
            status_hint=_coerce_status_hint(r.get("status_hint")),
        )
        for r in data.get("risks", [])
        if r.get("description")
    ]
    opportunities = [
        OpportunityItem(
            description=o.get("description", ""),
            type=o.get("type"),
            owner=o.get("owner"),
            evidence_quote=o.get("evidence_quote"),
            confidence=_coerce_confidence(o.get("confidence")),
            status_hint=_coerce_status_hint(o.get("status_hint")),
        )
        for o in data.get("opportunities", [])
        if o.get("description")
    ]
    insights = [
        InsightItem(
            description=i.get("description", ""),
            category=i.get("category"),
            owner=i.get("owner"),
            evidence_quote=i.get("evidence_quote"),
            confidence=_coerce_confidence(i.get("confidence")),
            status_hint=_coerce_status_hint(i.get("status_hint")),
        )
        for i in data.get("insights", [])
        if i.get("description")
    ]
    tasks: List[TaskItem] = []
    for t in data.get("tasks", []):
        if not t.get("description"):
            continue
        assignee = t.get("assignee")
        assignee_email = t.get("assigneeEmail")
        if not assignee_email and assignee and assignee in _email_map:
            assignee_email = _email_map[assignee]
        tasks.append(
            TaskItem(
                description=t.get("description", ""),
                assignee=assignee,
                assignee_email=assignee_email,
                due_date=_parse_date(t.get("dueDate")),
                priority=t.get("priority"),
                evidence_quote=t.get("evidence_quote"),
                confidence=_coerce_confidence(t.get("confidence")),
                status_hint=_coerce_status_hint(t.get("status_hint")),
            )
        )

    what_changed = str(data.get("what_changed") or "").strip() or None
    logger.info(
        "[LLM] Deep extraction: %d decisions, %d risks, %d opportunities, %d insights, %d tasks",
        len(decisions), len(risks), len(opportunities), len(insights), len(tasks),
    )
    return StructuredData(
        decisions=decisions,
        risks=risks,
        tasks=tasks,
        opportunities=opportunities,
        insights=insights,
        what_changed=what_changed,
    )


# ---------------------------------------------------------------------------
# Deep, full-context communication intelligence extraction (generalized)
# ---------------------------------------------------------------------------

_COMM_LABELS = {
    "meeting": "meeting transcript",
    "email": "email thread",
    "teams": "Teams conversation",
}


def extract_deep_communication_intelligence(
    *,
    comm_type: str,
    title: str,
    date: Optional[str],
    participants: List[str],
    full_text: str,
    project_state: str,
    prior_context: str = "",
    speaker_email_map: Optional[Dict[str, str]] = None,
) -> StructuredData:
    """Deep extraction generalized to any communication (meeting | email | teams).

    Mirrors :func:`extract_deep_meeting_intelligence` but adds risk ``severity``
    (1-5) and a forward-looking ``flags`` array (predicted change events /
    emerging risks). Uses the SAME large-context compiler model, timeout, and
    parse machinery. The meeting path keeps its own dedicated function unchanged.
    """
    comm_label = _COMM_LABELS.get(comm_type, "communication")

    full_text = full_text or ""
    if len(full_text) > DEEP_TRANSCRIPT_MAX_CHARS:
        logger.warning(
            "[LLM] deep communication extraction text truncated from %d to %d chars (safety ceiling)",
            len(full_text),
            DEEP_TRANSCRIPT_MAX_CHARS,
        )
        full_text = full_text[:DEEP_TRANSCRIPT_MAX_CHARS]

    email_map_text = ""
    if speaker_email_map:
        mappings = [f"  {name} → {email}" for name, email in speaker_email_map.items()]
        email_map_text = "\n\nSpeaker Email Mapping (use for task owner emails):\n" + "\n".join(mappings)

    prior_block = ""
    if prior_context.strip():
        prior_block = (
            "\n\nRELATED HISTORY (semantic prior context — supporting only, may be "
            "noisy; do NOT invent items from it):\n" + prior_context.strip()
        )

    participants_joined = ", ".join(participants) if participants else "Unknown"

    prompt = f"""You are the senior project intelligence analyst for a construction project-management firm. Read the ENTIRE communication below — a {comm_label} — and compare it against the project's CURRENT TRACKED STATE. Extract the new or changed decisions, risks, opportunities, insights, predictive flags, and tasks that matter to running this project.

For EVERY item you MUST:
- ground it with a short verbatim `evidence_quote` (<= 240 chars, copied exactly from the text — never paraphrased or invented),
- assign a calibrated `confidence` in [0,1] (1 = explicitly stated and unambiguous; 0.5 = reasonably implied; below 0.4 = speculative),
- set `status_hint`: "new" (not in current state), "update" (changes/expands a tracked item), or "resolved" (a tracked item this closes out).

Do NOT fabricate. If the text does not support an item, omit it. Prefer fewer, higher-confidence items over many weak ones.

TASKS — capture who must do what:
- A task can be directed at ANYONE. If a manager (e.g. Brandon) tells a specific person to do something, the task belongs to that person.
- If a client or external party asks a question or makes a request, create a task for the responsible internal owner to respond or act.
- Capture IMPLIED commitments and action items, not just explicit "to-do" statements.

FLAGS — forward-looking predictions (this is high-value):
- Surface things you predict MAY happen but have NOT yet: an owner/client hinting at a scope change (a potential change event), or a condition that could become a delay or cost overrun (an emerging risk).
- Each flag is a PREDICTION about the future, not a current fact.

Communication type: {comm_type}
Subject/Title: {title}
Date: {date or "Unknown"}
Participants: {participants_joined}{email_map_text}

CURRENT TRACKED PROJECT STATE (ground truth — use to decide new vs update vs resolved):
{project_state or "(no tracked state available)"}{prior_block}

FULL COMMUNICATION:
{full_text}

Return JSON in EXACTLY this shape (include keys even when arrays are empty):
{{
  "what_changed": "One short paragraph on what materially changed for this project, or empty string.",
  "decisions": [{{"description":"...","rationale":"...","owner":"Name or null","evidence_quote":"...","confidence":0.0,"status_hint":"new|update|resolved"}}],
  "risks": [{{"description":"...","category":"schedule|budget|cost|resource|technical|external","likelihood":"low|medium|high","impact":"low|medium|high","severity":1,"owner":"Name or null","evidence_quote":"...","confidence":0.0,"status_hint":"new|update|resolved"}}],
  "opportunities": [{{"description":"...","type":"efficiency|revenue|relationship|innovation","owner":"Name or null","evidence_quote":"...","confidence":0.0,"status_hint":"new|update|resolved"}}],
  "insights": [{{"description":"...","category":"status|open_question|context","owner":"Name or null","evidence_quote":"...","confidence":0.0,"status_hint":"new|update|resolved"}}],
  "flags": [{{"prediction":"What may happen","flag_type":"potential_change_event|emerging_risk","severity":1,"owner":"Name or null","evidence_quote":"...","confidence":0.0,"status_hint":"new"}}],
  "tasks": [{{"description":"Imperative action","assignee":"Name or null","assigneeEmail":"email or null","dueDate":"YYYY-MM-DD or null","priority":"low|medium|high|urgent","evidence_quote":"...","confidence":0.0,"status_hint":"new|update|resolved"}}]
}}
severity is 1 (minor) to 5 (critical: safety/inspection/major cost/schedule-killer). Owners must be real participants; resolve due dates against the communication date. Output ONLY the JSON object."""

    # Lazy import: the intelligence package eagerly loads the compiler at startup,
    # so a top-level import risks a circular load order under FastAPI/pytest.
    #
    # COST: source-by-source extraction is high volume, so it runs on the signal
    # model. Project-packet synthesis is the stage allowed to use the larger
    # project-intelligence model.
    from ..intelligence.client import extract_with_retry
    from .config import MODEL_SIGNAL_EXTRACTION

    logger.info(
        "[LLM] Deep communication extraction (%s) via %s (text=%d chars, state=%d chars)",
        comm_type,
        MODEL_SIGNAL_EXTRACTION,
        len(full_text),
        len(project_state or ""),
    )
    data = extract_with_retry(
        [{"role": "user", "content": prompt}],
        model=MODEL_SIGNAL_EXTRACTION,
        timeout=DEEP_EXTRACTION_TIMEOUT_SECONDS,
        usage_context=ModelUsageContext(
            stage="signals_extracted",
            operation=f"deep_{comm_type}_signal_extraction",
            metadata={"title": title, "date": date, "comm_type": comm_type},
        ),
    )
    if data.get("_extraction_failed"):
        logger.error("[LLM] Deep communication extraction failed: %s", data.get("_errors"))
        return StructuredData(
            extraction_failed=True,
            extraction_error=str(data.get("_errors"))[:600] or "unknown",
        )

    _email_map = speaker_email_map or {}

    decisions = [
        DecisionItem(
            description=d.get("description", ""),
            rationale=d.get("rationale"),
            owner=d.get("owner"),
            evidence_quote=d.get("evidence_quote"),
            confidence=_coerce_confidence(d.get("confidence")),
            status_hint=_coerce_status_hint(d.get("status_hint")),
        )
        for d in data.get("decisions", [])
        if d.get("description")
    ]
    risks = [
        RiskItem(
            description=r.get("description", ""),
            category=r.get("category"),
            likelihood=r.get("likelihood"),
            impact=r.get("impact"),
            severity=_coerce_severity(r.get("severity")),
            owner=r.get("owner"),
            evidence_quote=r.get("evidence_quote"),
            confidence=_coerce_confidence(r.get("confidence")),
            status_hint=_coerce_status_hint(r.get("status_hint")),
        )
        for r in data.get("risks", [])
        if r.get("description")
    ]
    opportunities = [
        OpportunityItem(
            description=o.get("description", ""),
            type=o.get("type"),
            owner=o.get("owner"),
            evidence_quote=o.get("evidence_quote"),
            confidence=_coerce_confidence(o.get("confidence")),
            status_hint=_coerce_status_hint(o.get("status_hint")),
        )
        for o in data.get("opportunities", [])
        if o.get("description")
    ]
    insights = [
        InsightItem(
            description=i.get("description", ""),
            category=i.get("category"),
            owner=i.get("owner"),
            evidence_quote=i.get("evidence_quote"),
            confidence=_coerce_confidence(i.get("confidence")),
            status_hint=_coerce_status_hint(i.get("status_hint")),
        )
        for i in data.get("insights", [])
        if i.get("description")
    ]
    flags: List[FlagItem] = []
    for f in data.get("flags", []):
        # Flags carry their prediction text under `prediction`; map it onto the
        # base `description` field (fall back to `description` if the model used it).
        prediction = f.get("prediction") or f.get("description") or ""
        if not prediction:
            continue
        flags.append(
            FlagItem(
                description=prediction,
                flag_type=f.get("flag_type"),
                severity=_coerce_severity(f.get("severity")),
                owner=f.get("owner"),
                evidence_quote=f.get("evidence_quote"),
                confidence=_coerce_confidence(f.get("confidence")),
                status_hint=_coerce_status_hint(f.get("status_hint")),
            )
        )
    tasks: List[TaskItem] = []
    for t in data.get("tasks", []):
        if not t.get("description"):
            continue
        assignee = t.get("assignee")
        assignee_email = t.get("assigneeEmail")
        if not assignee_email and assignee and assignee in _email_map:
            assignee_email = _email_map[assignee]
        tasks.append(
            TaskItem(
                description=t.get("description", ""),
                assignee=assignee,
                assignee_email=assignee_email,
                due_date=_parse_date(t.get("dueDate")),
                priority=t.get("priority"),
                evidence_quote=t.get("evidence_quote"),
                confidence=_coerce_confidence(t.get("confidence")),
                status_hint=_coerce_status_hint(t.get("status_hint")),
            )
        )

    what_changed = str(data.get("what_changed") or "").strip() or None
    logger.info(
        "[LLM] Deep communication extraction (%s): %d decisions, %d risks, %d opportunities, %d insights, %d flags, %d tasks",
        comm_type,
        len(decisions),
        len(risks),
        len(opportunities),
        len(insights),
        len(flags),
        len(tasks),
    )
    return StructuredData(
        decisions=decisions,
        risks=risks,
        tasks=tasks,
        opportunities=opportunities,
        insights=insights,
        flags=flags,
        what_changed=what_changed,
    )


# ---------------------------------------------------------------------------
# Meeting digest
# ---------------------------------------------------------------------------

def generate_meeting_digest(
    title: str,
    date: Optional[str],
    participants: List[str],
    summary: str,
    decisions: List[Dict[str, Any]],
    risks: List[Dict[str, Any]],
    tasks: List[Dict[str, Any]],
    opportunities: List[Dict[str, Any]],
) -> Dict[str, Any]:
    """Generate an executive post-meeting digest from structured data."""
    prompt = f"""Generate a concise executive digest for this meeting.

Meeting: {title}
Date: {date or "Unknown"}
Participants: {", ".join(participants)}

Summary: {summary[:2000]}

Decisions Made: {json.dumps(decisions[:20], default=str)}
Risks Identified: {json.dumps(risks[:20], default=str)}
Action Items: {json.dumps(tasks[:20], default=str)}
Opportunities: {json.dumps(opportunities[:10], default=str)}

Return JSON with:
{{
  "digest_text": "A 3-5 paragraph executive briefing covering what happened, \
what was decided, what needs attention, and what's next. Write for a busy \
executive who missed the meeting.",
  "decisions_summary": [
    {{"decision": "What was decided", "owner": "Who owns it", "impact": "Why it matters"}}
  ],
  "action_items_summary": [
    {{"action": "What needs to happen", "assignee": "Who", "due": "When if known"}}
  ],
  "risks_summary": [
    {{"risk": "What could go wrong", "severity": "high|medium|low", "mitigation": "Suggested action"}}
  ],
  "opportunities_summary": [
    {{"opportunity": "What could be leveraged", "type": "efficiency|revenue|relationship"}}
  ],
  "follow_ups": [
    {{"item": "What needs follow-up before next meeting", "owner": "Who should drive it"}}
  ],
  "key_takeaways": ["Top 3-5 bullet points a PM must know from this meeting"]
}}

Be specific. Use actual names and details from the meeting data."""

    raw = _call_llm(prompt, json_mode=True)
    try:
        return json.loads(raw)
    except Exception as exc:
        logger.warning(
            "[LLM] generate_meeting_digest returned non-JSON; returning empty digest: %s", exc
        )
        return {}


def _parse_date(raw: Optional[str]) -> Optional[str]:
    """Return a valid YYYY-MM-DD string or None."""
    if not raw:
        return None
    import re
    from datetime import datetime
    if re.match(r"^\d{4}-\d{2}-\d{2}$", raw):
        try:
            datetime.strptime(raw, "%Y-%m-%d")
            return raw
        except ValueError:
            pass
    try:
        return datetime.fromisoformat(raw).strftime("%Y-%m-%d")
    except (ValueError, OverflowError):
        return None
