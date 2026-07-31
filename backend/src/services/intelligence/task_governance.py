"""Deterministic guardrails for task projection from daily deep reads.

The model may describe a durable responsibility ("continue supporting the
owner") as if it were a one-time action.  Responsibilities are retained as
classified evidence, but are not projected into the actionable ``tasks`` table.
"""
from __future__ import annotations

import re
from difflib import SequenceMatcher
from typing import Any, Iterable, List

_ONGOING_RE = re.compile(
    r"\b(ongoing|continue|continually|as needed|as questions arise|ongoingly|"
    r"maintain|manage|oversee|support|coordinate|stay on top of|be available|"
    r"keep .* updated|provide .* guidance)\b",
    re.I,
)
_ACTION_RE = re.compile(
    r"\b(send|share|submit|review|approve|schedule|confirm|prepare|create|"
    r"update|call|email|deliver|order|complete|issue|assign|upload|collect|"
    r"follow up|follow-up|provide)\b",
    re.I,
)


def normalize_task_text(value: Any) -> str:
    """Normalize task text for stable, punctuation/case-insensitive matching."""
    return re.sub(r"[^a-z0-9 ]+", " ", str(value or "").lower()).strip()


def classify_task_or_responsibility(task: Any) -> dict[str, Any]:
    """Classify one candidate without inventing an owner or changing text."""
    text = str(getattr(task, "description", "") or "").strip()
    ongoing = bool(_ONGOING_RE.search(text))
    action = bool(_ACTION_RE.search(text))
    if ongoing and not action:
        classification = "ongoing_responsibility"
        confidence = 0.92
        reason = "recurring or standing responsibility language"
    elif ongoing and action:
        classification = "task"
        confidence = 0.68
        reason = "action is present but recurring language requires review"
    elif action:
        classification = "task"
        confidence = 0.9
        reason = "bounded imperative action"
    else:
        classification = "task"
        confidence = 0.45
        reason = "no explicit action or recurrence marker"
    model_confidence = getattr(task, "confidence", None)
    if model_confidence is not None:
        confidence = min(confidence, float(model_confidence))
    return {
        "classification": classification,
        "confidence": round(confidence, 3),
        "reason": reason,
        "needs_review": confidence < 0.75 or (ongoing and action),
        "projectable": classification == "task",
    }


def _similar(left: str, right: str) -> bool:
    if not left or not right:
        return False
    if left == right:
        return True
    stop = {"the", "a", "an", "to", "for", "and", "of", "with"}
    left_tokens = set(left.split()) - stop
    right_tokens = set(right.split()) - stop
    overlap = len(left_tokens & right_tokens) / max(1, len(left_tokens | right_tokens))
    return overlap >= 0.65 or SequenceMatcher(None, left, right).ratio() >= 0.82


def govern_tasks(tasks: Iterable[Any], *, source_document_id: str | None = None) -> List[Any]:
    """Classify, dedupe, and annotate candidates while preserving provenance.

    The winning candidate is the highest-confidence item.  Review flags and
    evidence from every duplicate are retained so re-processing cannot erase a
    human-review requirement or source lineage.
    """
    governed: List[Any] = []
    for task in tasks or []:
        text = str(getattr(task, "description", "") or "").strip()
        if not text:
            continue
        classification = classify_task_or_responsibility(task)
        setattr(task, "task_classification", classification["classification"])
        setattr(task, "task_governance", classification)
        metadata = getattr(task, "provenance", None)
        if not isinstance(metadata, dict):
            metadata = {}
        metadata.update({"task_governance": classification})
        if source_document_id:
            metadata["source_document_id"] = source_document_id
        setattr(task, "provenance", metadata)
        key = normalize_task_text(text)
        duplicate = next((existing for existing in governed if _similar(key, normalize_task_text(getattr(existing, "description", "")))), None)
        if duplicate is None:
            governed.append(task)
            continue
        # Keep the more certain wording, but never lose review or evidence.
        winner, loser = (task, duplicate) if float(getattr(task, "confidence", 0) or 0) > float(getattr(duplicate, "confidence", 0) or 0) else (duplicate, task)
        winner_governance = dict(getattr(winner, "task_governance", {}) or {})
        loser_governance = getattr(loser, "task_governance", {}) or {}
        winner_governance["needs_review"] = bool(winner_governance.get("needs_review") or loser_governance.get("needs_review"))
        winner_governance["duplicate_count"] = int(winner_governance.get("duplicate_count") or 1) + int(loser_governance.get("duplicate_count") or 1)
        setattr(winner, "task_governance", winner_governance)
        prior_provenance = getattr(winner, "provenance", {}) or {}
        descriptions = [
            *prior_provenance.get("deduped_source_descriptions", []),
            getattr(loser, "description", ""),
        ]
        winner.provenance = {
            **prior_provenance,
            "deduped_source_descriptions": list(dict.fromkeys(d for d in descriptions if d)),
        }
        if winner is not duplicate:
            governed[governed.index(duplicate)] = winner
    return governed
