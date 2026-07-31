"""LLM-driven rewrite for Fireflies meeting action items.

Fireflies emits action-item lines that are usually third-person narration
("Provide support to Brandon...", "Inform Maria once X..."). When those land
in the tasks table verbatim, the assignee picked by a regex is almost always
the person being talked ABOUT, not the person who should DO the work.

This module replaces the regex path. It feeds Fireflies action items plus the
meeting context (participants, speaker→email map, source date) to an LLM
prompt that:

- rewrites every kept item into a short imperative task title + a longer
  description grounded in the source context,
- assigns ownership to the doer (must be one of the meeting participants),
- drops items where ownership is ambiguous or the action is not real work,
- enforces the same internal-employee-only rule used by `task_extraction.py`
  and `teams_compiler.py`.

The output is a list of dicts ready for `Store.upsert_task`, including
`title`, `description`, `assignee_name`, `assignee_email`, `assigned_by`,
`due_date`, `priority`, `extraction_prompt_version`, and `extraction_metadata`.
"""
from __future__ import annotations

import json
import logging
import os
import re
from dataclasses import dataclass
from datetime import datetime
from typing import Any, Dict, List, Optional

from openai import OpenAI

from ..ai_transport import retry_ai_call

logger = logging.getLogger(__name__)

REWRITER_MODEL = "gpt-5.5"
REWRITER_PROMPT_VERSION = "fireflies_rewriter.v1.gpt-5.5"
REWRITER_MAX_ACTION_ITEMS = 40
REWRITER_MAX_CONTEXT_CHARS = 6000
# Retries for empty / malformed JSON responses (separate from transport retries).
REWRITER_EMPTY_RESPONSE_RETRIES = 2
# Completion budget must cover the reasoning model's hidden reasoning tokens AND
# the JSON output for up to REWRITER_MAX_ACTION_ITEMS tasks. 2400 truncated
# multi-item meetings (finish_reason=length → empty body → all tasks dropped).
REWRITER_MAX_COMPLETION_TOKENS = 8000


@dataclass(frozen=True)
class RewrittenTask:
    title: str
    description: str
    assignee_name: Optional[str]
    assignee_email: Optional[str]
    assigned_by: Optional[str]
    due_date: Optional[str]
    priority: Optional[str]
    confidence: float
    source_action_item: Optional[str]


_REWRITER_SYSTEM_PROMPT = """\
You convert Fireflies meeting action-item lines into clean, owner-assigned
tasks for a construction PM tool. Fireflies writes action items as third-person
narration ("X to provide…", "Inform Y about…"). Your job is to rewrite each
real action item as an IMPERATIVE task assigned to the person who must DO it.

# Title rules
- ≤ 10 words. Start with an action verb. Be specific about the artifact, deliverable, or next step.
- Never narrate. Never use "X asked Y", "Provide X to <Name>", "Inform <Name>", "Coordinate with <Name>" framing.
- The title must read as the OWNER's to-do, not as a description of what happened.

# Description rules
- 1–2 sentences. Imperative form. Include any concrete artifact, deadline, dollar amount, project, or counterparty mentioned.
- Same anti-narration rule as the title.

# Owner rules (CRITICAL)
- The owner is the person who must DO the work, never the person being talked ABOUT.
- Fireflies groups every action item under the person it assigned the item to. When an item is prefixed with "[Fireflies owner: <Name>]", that Name IS the doer — use it as "assignee_name" unless the item text unambiguously shows a different person must do the work. Do NOT discard an item just because its text is phrased as third-person narration when a Fireflies owner is given.
- "Provide support to Brandon" → owner is the person providing support, NOT Brandon.
- "Inform Maria when X is ready" → owner is the informer, NOT Maria.
- "Coordinate with Sarah on contract edits" → owner is the coordinator, NOT Sarah.
- "Send updated CAD to Joe" → owner is the sender, NOT Joe.
- Owner MUST be one of the named participants/speakers provided to you. If no Fireflies owner is given and the doer cannot be confidently identified from the action item or surrounding context, set "assignee_name" to null and the task will be discarded — DO NOT default to the first named person.
- Owner is the doer; "assigned_by" is the person who directed the work (set to null for self-commitments).

# Filter rules — emit [] for items like:
- Calendar/Teams logistics: forwarding/accepting/declining invites, RSVPing, joining a call, screen sharing.
- Sub-2-minute micro-actions: acknowledging receipt, opening a link, adding someone to a chat.
- Pure information consumption: "review the attached doc" with no follow-up artifact.
- Generic "team should…" or "we need to…" with no concrete owner.
- Vendor/client/architect/inspector actions — emit those as project intelligence elsewhere, never as tasks here.

# Rewrite examples
- Bad: "Provide support and coaching to Brandon Clymer regarding the blender deluge fire suppression system as needed"
  Good: { "title": "Coach Brandon on blender deluge system", "description": "Provide ongoing technical coaching to Brandon on the blender deluge fire suppression system as questions come up.", "assignee_name": "<actual speaker who committed to this>", "confidence": 0.7 }
  If the speaker who committed cannot be identified, DROP the task entirely.
- Bad: "Inform Brandon once Ben's answers to outstanding questions are ready and facilitate ongoing communication between parties"
  Good: { "title": "Loop Brandon in once Ben's answers land", "description": "Notify Brandon when Ben's responses on the outstanding questions are ready and keep both parties in the loop.", "assignee_name": "<the person responsible for chasing Ben>", "confidence": 0.6 }
- Bad: "Brandon Clymer asked Joe Metz to send an updated CAD drawing that shows trays."
  Good: { "title": "Send updated CAD with trays to Brandon", "description": "Produce and send an updated CAD drawing showing the tray layout to Brandon Clymer.", "assignee_name": "Joe Metz", "assigned_by": "Brandon Clymer", "confidence": 0.95 }

# Output format
Respond with ONLY a JSON object (no markdown, no commentary):
{
  "tasks": [
    {
      "title": "≤10-word imperative",
      "description": "1–2 sentence imperative description",
      "assignee_name": "Exact participant name or null",
      "assignee_email": "email or null",
      "assigned_by": "Name of person who assigned this or null",
      "due_date": "YYYY-MM-DD or null",
      "priority": "high|medium|low",
      "confidence": 0.0,
      "source_action_item": "the original action_item text this came from"
    }
  ]
}

If no items qualify, return {"tasks": []}.
"""


def _format_participants(participants: List[str], speaker_email_map: Dict[str, str]) -> str:
    if not participants and not speaker_email_map:
        return "(unknown)"
    seen: set[str] = set()
    lines: List[str] = []
    for name in participants:
        if not name or name in seen:
            continue
        seen.add(name)
        email = speaker_email_map.get(name)
        lines.append(f"- {name}" + (f" <{email}>" if email else ""))
    for name, email in speaker_email_map.items():
        if name in seen:
            continue
        seen.add(name)
        lines.append(f"- {name}" + (f" <{email}>" if email else ""))
    return "\n".join(lines) or "(unknown)"


def _build_user_prompt(
    *,
    title: str,
    source_date: Optional[str],
    participants: List[str],
    speaker_email_map: Dict[str, str],
    action_items: List[str],
    notes_context: str,
    item_owners: Optional[List[Optional[str]]] = None,
) -> str:
    owners = item_owners or []

    def _format_item(idx: int, item: str) -> str:
        owner = owners[idx] if idx < len(owners) else None
        owner = (owner or "").strip()
        if owner:
            return f"- [Fireflies owner: {owner}] {item}"
        return f"- {item}"

    items_text = "\n".join(
        _format_item(idx, item)
        for idx, item in enumerate(action_items[:REWRITER_MAX_ACTION_ITEMS])
    )
    notes_block = ""
    if notes_context:
        notes_block = f"\n\nMeeting notes excerpt (for owner disambiguation, do not extract new tasks from this):\n{notes_context[:REWRITER_MAX_CONTEXT_CHARS]}"
    return (
        f"Meeting: {title}\n"
        f"Date: {source_date or 'unknown'}\n"
        f"Participants:\n{_format_participants(participants, speaker_email_map)}\n\n"
        f"Action items (Fireflies-generated, third-person narration — rewrite each into an imperative task):\n"
        f"{items_text}"
        f"{notes_block}"
    )




_THIRD_PERSON_NARRATION_PATTERNS = (
    re.compile(r"^\s*[A-Z][A-Za-z .'-]{1,80}\s+(asked|told|requested|suggested|mentioned|noted|discussed|raised|clarified)\b", re.I),
    re.compile(r"^\s*provide\b.{0,40}\bto\s+[A-Z][A-Za-z .'-]+", re.I),
    re.compile(r"^\s*inform\s+[A-Z][A-Za-z .'-]+", re.I),
    re.compile(r"^\s*coordinate\s+(?:with|receipt|scheduling)\s+", re.I),
)


def _looks_like_narration(text: str) -> bool:
    return any(p.search(text or "") for p in _THIRD_PERSON_NARRATION_PATTERNS)


def _normalize_priority(value: Any) -> Optional[str]:
    if not value:
        return None
    v = str(value).strip().lower()
    if v in {"high", "medium", "low"}:
        return v
    if v == "urgent":
        return "high"
    return None


def _clean(value: Any) -> Optional[str]:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "n/a", "unknown"}:
        return None
    return text


def _valid_iso_date(value: Any) -> Optional[str]:
    text = _clean(value)
    if not text:
        return None
    try:
        datetime.strptime(text, "%Y-%m-%d")
        return text
    except ValueError:
        return None


def rewrite_action_items(
    *,
    meeting_title: str,
    action_items: List[str],
    participants: List[str],
    speaker_email_map: Optional[Dict[str, str]] = None,
    source_date: Optional[str] = None,
    notes_context: str = "",
    item_owners: Optional[List[Optional[str]]] = None,
) -> List[RewrittenTask]:
    """Return imperative, owner-assigned tasks rewritten from Fireflies action items.

    ``item_owners`` (optional, index-aligned with ``action_items``) carries the
    owner Fireflies grouped each action item under. When provided, the LLM is
    told to treat that name as the doer unless the text clearly contradicts it —
    this is what lets owner-assigned tasks survive instead of being dropped as
    nameless narration.

    Returns an empty list on any LLM error — callers should treat that as
    "no tasks for this meeting" rather than falling back to the raw items,
    because raw items are exactly what we're trying to stop persisting.
    """
    paired = [
        (item.strip(), (item_owners[idx] if item_owners and idx < len(item_owners) else None))
        for idx, item in enumerate(action_items)
        if item and item.strip()
    ]
    if not paired:
        return []
    cleaned_items = [item for item, _ in paired]
    cleaned_owners = [owner for _, owner in paired]

    from ..ai_transport import get_openai_client, retry_ai_call

    user_prompt = _build_user_prompt(
        title=meeting_title,
        source_date=source_date,
        participants=participants,
        speaker_email_map=speaker_email_map or {},
        action_items=cleaned_items,
        notes_context=notes_context,
        item_owners=cleaned_owners,
    )

    # gpt-5.x intermittently returns empty content with finish_reason=stop (and
    # occasionally malformed JSON). Either one would silently drop every task for
    # a meeting, so retry the whole call+parse a couple of times before giving up.
    # retry_ai_call still handles transport-level blips within each attempt.
    payload = None
    last_error: Optional[str] = None
    for attempt in range(REWRITER_EMPTY_RESPONSE_RETRIES + 1):
        try:
            def _create_completion(*, use_response_format: bool = True):
                kwargs = {
                    "model": REWRITER_MODEL,
                    "messages": [
                        {"role": "system", "content": _REWRITER_SYSTEM_PROMPT},
                        {"role": "user", "content": user_prompt},
                    ],
                    "max_completion_tokens": REWRITER_MAX_COMPLETION_TOKENS,
                }
                if use_response_format:
                    kwargs["response_format"] = {"type": "json_object"}
                return get_openai_client().chat.completions.create(**kwargs)

            response = retry_ai_call(
                lambda: _create_completion(use_response_format=True),
                provider_name="OpenAI",
                operation="fireflies task rewrite",
            )
        except Exception as exc:
            message = str(exc).lower()
            response_format_rejected = (
                "response_format" in message
                and (
                    "invalid input" in message
                    or "invalid_request_error" in message
                    or "unsupported" in message
                )
            )
            if not response_format_rejected:
                last_error = str(exc)
                logger.error("[FirefliesTaskRewriter] OpenAI call failed: %s", exc)
                break

            logger.warning(
                "[FirefliesTaskRewriter] %s rejected response_format=json_object; retrying once with prompt-only JSON contract.",
                REWRITER_MODEL,
            )
            try:
                response = retry_ai_call(
                    lambda: _create_completion(use_response_format=False),
                    provider_name="OpenAI",
                    operation="fireflies task rewrite without response_format",
                )
            except Exception as fallback_exc:
                last_error = str(fallback_exc)
                logger.error("[FirefliesTaskRewriter] OpenAI fallback call failed: %s", fallback_exc)
                break

        finish_reason = response.choices[0].finish_reason
        raw = (response.choices[0].message.content or "").strip()
        raw = raw.removeprefix("```json").removeprefix("```").removesuffix("```").strip()
        if not raw:
            last_error = "empty response (finish_reason=%s)" % finish_reason
            # finish_reason=length means the model ran out of completion budget
            # mid-reasoning — retrying with the same budget is deterministic waste.
            # Surface it loudly (a real failure, not a transient blip).
            if finish_reason == "length":
                logger.error(
                    "[FirefliesTaskRewriter] Truncated (finish_reason=length) with %d-token budget "
                    "and %d action items — raise REWRITER_MAX_COMPLETION_TOKENS or batch items.",
                    REWRITER_MAX_COMPLETION_TOKENS,
                    len(cleaned_items),
                )
                break
            logger.warning(
                "[FirefliesTaskRewriter] Empty response (attempt %d/%d); retrying",
                attempt + 1,
                REWRITER_EMPTY_RESPONSE_RETRIES + 1,
            )
            continue
        try:
            payload = json.loads(raw)
            break
        except json.JSONDecodeError as exc:
            last_error = f"non-JSON response: {exc}"
            logger.warning(
                "[FirefliesTaskRewriter] Non-JSON response (attempt %d/%d) (%s); raw=%.300s",
                attempt + 1,
                REWRITER_EMPTY_RESPONSE_RETRIES + 1,
                exc,
                raw,
            )
            continue

    if payload is None:
        logger.error(
            "[FirefliesTaskRewriter] Dropping action items — no usable response: %s",
            last_error or "unknown error",
        )
        return []

    tasks_raw = payload.get("tasks") if isinstance(payload, dict) else None
    if not isinstance(tasks_raw, list):
        return []

    participant_set = {name.lower() for name in participants if name}
    participant_set.update(name.lower() for name in (speaker_email_map or {}).keys())
    # Fireflies-assigned owners are, by construction, people who were in the
    # meeting — Fireflies derives them from the speaker list. Treat them as valid
    # participants so a real owner isn't dropped just because the attendee list
    # we were handed is emails-only (displayName missing) and the speaker→email
    # map came up empty.
    participant_set.update(
        owner.lower() for owner in cleaned_owners if owner and owner.strip()
    )

    results: List[RewrittenTask] = []
    for entry in tasks_raw:
        if not isinstance(entry, dict):
            continue
        title = _clean(entry.get("title"))
        description = _clean(entry.get("description")) or title
        assignee_name = _clean(entry.get("assignee_name"))
        if not title or not assignee_name:
            continue
        if _looks_like_narration(title) or _looks_like_narration(description or ""):
            logger.info(
                "[FirefliesTaskRewriter] Rejected narration-shaped task title=%r",
                title,
            )
            continue
        # Reject excessively long titles — the LLM occasionally ignores the rule.
        if len(title) > 90:
            logger.info("[FirefliesTaskRewriter] Truncating long title: %r", title)
            title = title[:90].rsplit(" ", 1)[0]
        # Owner must be one of the meeting participants. Otherwise the LLM is
        # guessing, which is exactly the failure mode we're replacing.
        if assignee_name.lower() not in participant_set:
            logger.info(
                "[FirefliesTaskRewriter] Owner %r not in participants — dropping",
                assignee_name,
            )
            continue
        confidence = entry.get("confidence")
        try:
            confidence_value = float(confidence) if confidence is not None else 0.0
        except (TypeError, ValueError):
            confidence_value = 0.0
        if confidence_value < 0.5:
            logger.info(
                "[FirefliesTaskRewriter] Skipping low-confidence task (%.2f): %r",
                confidence_value,
                title,
            )
            continue
        results.append(
            RewrittenTask(
                title=title,
                description=description or title,
                assignee_name=assignee_name,
                assignee_email=_clean(entry.get("assignee_email")),
                assigned_by=_clean(entry.get("assigned_by")),
                due_date=_valid_iso_date(entry.get("due_date")),
                priority=_normalize_priority(entry.get("priority")),
                confidence=confidence_value,
                source_action_item=_clean(entry.get("source_action_item")),
            )
        )

    logger.info(
        "[FirefliesTaskRewriter] Kept %d/%d action items after rewrite for meeting %r",
        len(results),
        len(cleaned_items),
        meeting_title,
    )
    return results
