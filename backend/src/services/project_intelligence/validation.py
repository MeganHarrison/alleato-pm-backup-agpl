"""Publication guards shared by canonical Project Intelligence projections."""

from __future__ import annotations

import re
from typing import Any, Dict, List, Optional

UNSYNTHESIZED_WHY_IT_MATTERS = (
    "This source contains project-relevant language that should be reviewed "
    "before it is trusted in a current intelligence packet."
)

_RAW_SOURCE_SUBJECT_RE = re.compile(r"^\s*subject:\s", re.IGNORECASE)
_RAW_SOURCE_FROM_RE = re.compile(r"\bfrom:\s*[^\s@]+@", re.IGNORECASE)
_RAW_SOURCE_TO_RE = re.compile(r"\bto:\s*[^\s@]+@", re.IGNORECASE)
_RAW_SOURCE_NBSP_RE = re.compile(r"&nbsp;", re.IGNORECASE)
_RAW_SOURCE_TITLE_PREFIX_RE = re.compile(r"^\s*(email|subject)\s*:", re.IGNORECASE)


def _clean_text(value: Any) -> str:
    return re.sub(r"\s+", " ", str(value or "")).strip()


def looks_like_raw_source(value: Any) -> bool:
    text = _clean_text(value)
    if not text:
        return False
    return bool(
        _RAW_SOURCE_SUBJECT_RE.search(text)
        or (_RAW_SOURCE_FROM_RE.search(text) and _RAW_SOURCE_TO_RE.search(text))
        or len(_RAW_SOURCE_NBSP_RE.findall(text)) >= 2
    )


def safe_summary(value: Any) -> Optional[str]:
    text = str(value or "")
    text = _RAW_SOURCE_NBSP_RE.sub(" ", text)
    text = re.sub(r"&amp;", "&", text, flags=re.IGNORECASE)
    text = re.sub(r"&lt;", "<", text, flags=re.IGNORECASE)
    text = re.sub(r"&gt;", ">", text, flags=re.IGNORECASE)
    text = re.sub(r"&#\d+;", " ", text)
    cleaned = _clean_text(text)
    return None if not cleaned or looks_like_raw_source(cleaned) else cleaned


def is_synthesized_signal(signal: Any) -> bool:
    if not isinstance(signal, dict):
        return False
    why = _clean_text(signal.get("why_it_matters"))
    title = _clean_text(signal.get("title"))
    return bool(
        why
        and why != _clean_text(UNSYNTHESIZED_WHY_IT_MATTERS)
        and title
        and not _RAW_SOURCE_TITLE_PREFIX_RE.match(title)
        and not looks_like_raw_source(title)
        and not looks_like_raw_source(signal.get("summary"))
    )


def publishable_signals(items: Any) -> List[Dict[str, Any]]:
    if not isinstance(items, list):
        return []
    return [item for item in items if is_synthesized_signal(item)]
