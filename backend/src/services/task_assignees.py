"""Resolve task assignee text to durable people records."""
from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Any


_SPACE_RE = re.compile(r"\s+")
_NAME_CHARS_RE = re.compile(r"[^a-z0-9\s@._+-]")

# Person types that count as internal Alleato staff and CAN own tasks.
# Anything else (contacts, vendors, subs, clients) gets routed to project
# intelligence instead of the tasks table.
INTERNAL_PERSON_TYPES: frozenset[str] = frozenset({"employee"})


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.lower() in {"null", "none", "unknown", "n/a"}:
        return None
    return text


def normalize_email(value: Any) -> str | None:
    text = clean_text(value)
    return text.lower() if text and "@" in text else None


def normalize_name(value: Any) -> str | None:
    text = clean_text(value)
    if not text:
        return None
    text = _NAME_CHARS_RE.sub(" ", text.lower())
    text = _SPACE_RE.sub(" ", text).strip()
    return text or None


@dataclass(frozen=True)
class ResolvedAssignee:
    person_id: str | None
    name: str | None
    email: str | None
    method: str
    confidence: float
    person_type: str | None = None

    @property
    def is_employee(self) -> bool:
        """True only if the assignee resolved to an internal Alleato employee."""
        return (self.person_type or "").lower() in INTERNAL_PERSON_TYPES

    def row_values(self) -> dict[str, Any]:
        return {
            "assignee_person_id": self.person_id,
            "assignee_name": self.name,
            "assignee_email": self.email,
        }

    def metadata(self) -> dict[str, Any]:
        return {
            "assignee_resolution_method": self.method,
            "assignee_resolution_confidence": self.confidence,
            "assignee_person_type": self.person_type,
            "assignee_is_employee": self.is_employee,
        }


class TaskAssigneeResolver:
    def __init__(self, supabase: Any):
        self._supabase = supabase
        self._loaded = False
        self._by_email: dict[str, dict[str, Any]] = {}
        self._by_name: dict[str, list[dict[str, Any]]] = {}
        self._by_token: dict[str, list[dict[str, Any]]] = {}

    def _load(self) -> None:
        if self._loaded:
            return
        page_size = 1000
        start = 0
        while True:
            result = (
                self._supabase.table("people")
                .select("id,first_name,last_name,email,person_type")
                .range(start, start + page_size - 1)
                .execute()
            )
            page = result.data or []
            for person in page:
                name = _canonical_name(person)
                email = normalize_email(person.get("email"))
                if email:
                    self._by_email[email] = person
                normalized_name = normalize_name(name)
                if normalized_name:
                    self._by_name.setdefault(normalized_name, []).append(person)
                    for token in normalized_name.split():
                        if len(token) >= 3:
                            self._by_token.setdefault(token, []).append(person)
            if len(page) < page_size:
                break
            start += page_size
        self._loaded = True

    def resolve(self, assignee_name: Any, assignee_email: Any) -> ResolvedAssignee:
        self._load()
        source_name = clean_text(assignee_name)
        source_email = normalize_email(assignee_email)

        if source_email:
            person = self._by_email.get(source_email)
            if person:
                return _resolved(person, "email_exact", 1.0, source_name, source_email)

        normalized_name = normalize_name(source_name)
        if normalized_name:
            exact_matches = self._by_name.get(normalized_name, [])
            if len(exact_matches) == 1:
                return _resolved(exact_matches[0], "name_exact", 0.95, source_name, source_email)

            token_matches = self._by_token.get(normalized_name, [])
            if len(token_matches) == 1:
                return _resolved(token_matches[0], "unique_name_token", 0.82, source_name, source_email)

        return ResolvedAssignee(
            person_id=None,
            name=source_name,
            email=source_email,
            method="unresolved",
            confidence=0.0,
            person_type=None,
        )


def _canonical_name(person: dict[str, Any]) -> str | None:
    first = clean_text(person.get("first_name"))
    last = clean_text(person.get("last_name"))
    name = " ".join(part for part in (first, last) if part).strip()
    return name or None


def _resolved(
    person: dict[str, Any],
    method: str,
    confidence: float,
    fallback_name: str | None,
    fallback_email: str | None,
) -> ResolvedAssignee:
    return ResolvedAssignee(
        person_id=person.get("id"),
        name=_canonical_name(person) or fallback_name,
        email=normalize_email(person.get("email")) or fallback_email,
        method=method,
        confidence=confidence,
        person_type=clean_text(person.get("person_type")),
    )
