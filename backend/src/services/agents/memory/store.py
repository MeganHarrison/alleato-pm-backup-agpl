"""Durable memory stores backed by the PM app database."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass, field
from functools import lru_cache

try:
    from sqlalchemy import bindparam, create_engine, text
except ImportError:
    from sqlalchemy import create_engine, text

    def bindparam(*_args, **_kwargs):  # type: ignore[no-redef]
        return None
from sqlalchemy.engine import Engine
from sqlalchemy.pool import NullPool

logger = logging.getLogger(__name__)

USER_MEMORY_LIMIT = 30
PROJECT_MEMORY_LIMIT = 40
HIGH_VALUE_TYPES = ("preference", "lesson", "commitment", "context")
SEARCHABLE_TYPES = ("fact", "preference", "lesson", "commitment", "context")


def _with_expanding_types(query: object) -> object:
    try:
        return query.bindparams(bindparam("types", expanding=True))  # type: ignore[attr-defined]
    except AttributeError:
        return query


@lru_cache(maxsize=1)
def _memory_engine() -> Engine:
    url = os.environ.get("DATABASE_URL") or os.environ.get("SUPABASE_DB_URL")
    if not url:
        raise RuntimeError("DATABASE_URL or SUPABASE_DB_URL is not set")
    return create_engine(
        url,
        poolclass=NullPool,
        connect_args={
            "connect_timeout": 10,
            "application_name": "alleato-backend-deep-agents-memory",
        },
    )


@dataclass
class UserMemory:
    user_id: str
    entries: list[tuple[str, str]] = field(default_factory=list)
    raw_markdown: str = ""

    def __bool__(self) -> bool:
        return bool(self.entries)


@dataclass
class ProjectMemory:
    project_id: int
    project_name: str
    entries: list[tuple[str, str]] = field(default_factory=list)
    raw_markdown: str = ""

    def __bool__(self) -> bool:
        return bool(self.entries)


@dataclass
class MemoryEntry:
    id: str
    memory_type: str
    content: str
    project_id: int | None
    source: str | None
    visibility: str | None
    created_at: str | None
    importance: float
    confidence: float
    score: float = 0.0


def load_user_memory(user_id: str) -> UserMemory | None:
    """Load active user-scoped memories from ai_memories."""
    if not user_id:
        return None

    try:
        engine = _memory_engine()
        with engine.connect() as conn:
            query = _with_expanding_types(text(
                """
                SELECT type, content
                FROM ai_memories
                WHERE user_id = :uid
                  AND project_id IS NULL
                  AND is_active = TRUE
                  AND (expires_at IS NULL OR expires_at > NOW())
                  AND type IN :types
                ORDER BY importance DESC NULLS LAST, created_at DESC
                LIMIT :limit
                """
            ))
            rows = conn.execute(
                query,
                {
                    "uid": user_id,
                    "types": tuple(HIGH_VALUE_TYPES),
                    "limit": USER_MEMORY_LIMIT,
                },
            ).fetchall()
    except Exception:
        logger.warning("Failed to load user memory for %s", user_id, exc_info=True)
        return None

    entries = [(str(row[0]), str(row[1])) for row in rows]
    return UserMemory(
        user_id=user_id,
        entries=entries,
        raw_markdown=_format_user_memory(entries),
    )


def load_project_memory(project_id: int | str, user_id: str | None = None) -> ProjectMemory | None:
    """Load active project-scoped memories from ai_memories."""
    try:
        pid = int(project_id)
    except (TypeError, ValueError):
        logger.warning("Invalid project_id for memory load: %r", project_id)
        return None

    try:
        engine = _memory_engine()
        with engine.connect() as conn:
            name_row = conn.execute(
                text("SELECT name FROM projects WHERE id = :pid"),
                {"pid": pid},
            ).fetchone()
            project_name = str(name_row[0]) if name_row else str(pid)

            visibility_clause = (
                "AND (visibility = 'team' OR user_id = :uid)"
                if user_id
                else "AND visibility = 'team'"
            )
            query = _with_expanding_types(text(
                f"""
                SELECT type, content
                FROM ai_memories
                WHERE project_id = :pid
                  AND is_active = TRUE
                  AND (expires_at IS NULL OR expires_at > NOW())
                  AND type IN :types
                  {visibility_clause}
                ORDER BY importance DESC NULLS LAST, created_at DESC
                LIMIT :limit
                """
            ))
            rows = conn.execute(
                query,
                {
                    "pid": pid,
                    "types": tuple(HIGH_VALUE_TYPES),
                    "limit": PROJECT_MEMORY_LIMIT,
                    "uid": user_id,
                },
            ).fetchall()
    except Exception:
        logger.warning("Failed to load project memory for %s", pid, exc_info=True)
        return None

    entries = [(str(row[0]), str(row[1])) for row in rows]
    return ProjectMemory(
        project_id=pid,
        project_name=project_name,
        entries=entries,
        raw_markdown=_format_project_memory(project_name, entries),
    )


def _format_user_memory(entries: list[tuple[str, str]]) -> str:
    if not entries:
        return ""

    lines = ["## User Memory", ""]
    by_type: dict[str, list[str]] = {}
    for memory_type, content in entries:
        by_type.setdefault(memory_type, []).append(content)

    for memory_type in ("preference", "commitment", "lesson", "context"):
        items = by_type.get(memory_type, [])
        if not items:
            continue
        lines.append(f"### {memory_type.title()}s")
        lines.append("")
        for item in items:
            snippet = item[:300] + ("..." if len(item) > 300 else "")
            lines.append(f"- {snippet}")
        lines.append("")

    return "\n".join(lines).rstrip()


def _format_project_memory(
    project_name: str,
    entries: list[tuple[str, str]],
) -> str:
    if not entries:
        return ""

    lines = [f"## Project Memory - {project_name}", ""]
    by_type: dict[str, list[str]] = {}
    for memory_type, content in entries:
        by_type.setdefault(memory_type, []).append(content)

    for memory_type in ("commitment", "lesson", "preference", "context"):
        items = by_type.get(memory_type, [])
        if not items:
            continue
        lines.append(f"### {memory_type.title()}s")
        lines.append("")
        for item in items:
            snippet = item[:300] + ("..." if len(item) > 300 else "")
            lines.append(f"- {snippet}")
        lines.append("")

    return "\n".join(lines).rstrip()


def build_memory_block(
    user_memory: UserMemory | None,
    project_memory: ProjectMemory | None,
) -> str:
    parts: list[str] = []
    if user_memory and user_memory.raw_markdown:
        parts.append(user_memory.raw_markdown)
    if project_memory and project_memory.raw_markdown:
        parts.append(project_memory.raw_markdown)
    return "\n\n".join(parts)


def recall_user_memories(
    user_id: str,
    query: str = "",
    *,
    project_id: int | str | None = None,
    memory_type: str | None = None,
    limit: int = 8,
) -> list[MemoryEntry]:
    """Recall user-private memories, optionally scoped by project and query."""
    if not user_id:
        return []

    clauses = [
        "user_id = :uid",
        "(visibility IS NULL OR visibility = 'private')",
        "is_active = TRUE",
        "(expires_at IS NULL OR expires_at > NOW())",
    ]
    params: dict[str, object] = {
        "uid": user_id,
        "types": tuple(SEARCHABLE_TYPES),
        "limit": max(limit * 8, 25),
    }
    clauses.append("type IN :types")
    if memory_type:
        clauses.append("type = :memory_type")
        params["memory_type"] = memory_type
    if project_id is not None:
        try:
            params["pid"] = int(project_id)
            clauses.append("(project_id IS NULL OR project_id = :pid)")
        except (TypeError, ValueError):
            pass

    return _query_and_rank_memories(clauses, params, query, limit)


def recall_project_memories(
    project_id: int | str,
    query: str = "",
    *,
    user_id: str | None = None,
    limit: int = 8,
) -> list[MemoryEntry]:
    """Recall active project-scoped memories visible to this caller."""
    try:
        pid = int(project_id)
    except (TypeError, ValueError):
        return []

    clauses = [
        "project_id = :pid",
        "is_active = TRUE",
        "(expires_at IS NULL OR expires_at > NOW())",
        "type IN :types",
    ]
    params: dict[str, object] = {
        "pid": pid,
        "types": tuple(SEARCHABLE_TYPES),
        "limit": max(limit * 8, 25),
    }
    if user_id:
        clauses.append("(visibility = 'team' OR user_id = :uid)")
        params["uid"] = user_id
    else:
        clauses.append("visibility = 'team'")
    return _query_and_rank_memories(clauses, params, query, limit)


def recall_team_memories(query: str = "", *, limit: int = 6) -> list[MemoryEntry]:
    """Recall team-visible memories without requiring a specific user."""
    clauses = [
        "visibility = 'team'",
        "is_active = TRUE",
        "(expires_at IS NULL OR expires_at > NOW())",
        "type IN :types",
    ]
    params: dict[str, object] = {
        "types": tuple(SEARCHABLE_TYPES),
        "limit": max(limit * 8, 25),
    }
    return _query_and_rank_memories(clauses, params, query, limit)


def _query_and_rank_memories(
    clauses: list[str],
    params: dict[str, object],
    query: str,
    limit: int,
) -> list[MemoryEntry]:
    try:
        engine = _memory_engine()
        sql = _with_expanding_types(text(
            f"""
            SELECT
              id::text,
              type,
              content,
              project_id,
              source,
              visibility,
              created_at::text,
              COALESCE(importance, 0.5) AS importance,
              COALESCE(confidence, 0.9) AS confidence
            FROM ai_memories
            WHERE {" AND ".join(clauses)}
            ORDER BY importance DESC NULLS LAST, created_at DESC
            LIMIT :limit
            """
        ))
        with engine.connect() as conn:
            rows = conn.execute(sql, params).fetchall()
    except Exception:
        logger.warning("Failed to recall Deep Agents memory", exc_info=True)
        return []

    entries = [
        MemoryEntry(
            id=str(row[0]),
            memory_type=str(row[1]),
            content=str(row[2]),
            project_id=int(row[3]) if row[3] is not None else None,
            source=str(row[4]) if row[4] is not None else None,
            visibility=str(row[5]) if row[5] is not None else None,
            created_at=str(row[6]) if row[6] is not None else None,
            importance=float(row[7] or 0.5),
            confidence=float(row[8] or 0.9),
        )
        for row in rows
    ]
    return _rank_memories(entries, query, limit)


def _rank_memories(entries: list[MemoryEntry], query: str, limit: int) -> list[MemoryEntry]:
    terms = [term for term in query.lower().split() if len(term) >= 3]
    for entry in entries:
        haystack = entry.content.lower()
        term_hits = sum(1 for term in terms if term in haystack)
        exact_bonus = 2.0 if query and query.lower() in haystack else 0.0
        entry.score = (entry.importance * 2.0) + (entry.confidence * 0.5) + term_hits + exact_bonus
    return sorted(entries, key=lambda item: item.score, reverse=True)[: max(1, min(limit, 20))]


def format_memory_entries(entries: list[MemoryEntry]) -> str:
    if not entries:
        return "No matching durable memories found."

    lines = ["# Durable Memory Recall", ""]
    for entry in entries:
        project = f", project={entry.project_id}" if entry.project_id is not None else ""
        visibility = f", visibility={entry.visibility}" if entry.visibility else ""
        lines.append(
            f"- [{entry.memory_type}] {entry.content} "
            f"(id={entry.id}{project}{visibility}, score={entry.score:.2f})"
        )
    return "\n".join(lines)
