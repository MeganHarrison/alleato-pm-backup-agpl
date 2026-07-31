"""Request-scoped Deep Agents memory tools."""

from __future__ import annotations

from collections.abc import Callable
from typing import Literal

try:
    from langchain_core.tools import StructuredTool
except Exception:
    from langchain_core.tools import tool

    class StructuredTool:  # type: ignore[no-redef]
        @staticmethod
        def from_function(func, name: str, description: str):
            wrapped = tool(func)
            wrapped.name = name
            wrapped.description = description
            return wrapped

from src.services.agents.memory.contracts import MemoryCandidate
from src.services.agents.memory.store import (
    format_memory_entries,
    recall_project_memories,
    recall_team_memories,
    recall_user_memories,
)

MemoryScope = Literal["user", "project", "organization"]


def build_memory_tools(
    *,
    user_id: str,
    project_id: int | None = None,
    candidate_sink: list[MemoryCandidate] | None = None,
) -> list[StructuredTool]:
    """Build memory tools bound to the current caller context."""

    def recall_user_memory(query: str = "", memory_type: str | None = None, limit: int = 8) -> str:
        """Recall durable memories for the current user.

        Use this when the question depends on preferences, prior commitments,
        lessons learned, recent context, or facts from previous conversations.
        """
        return format_memory_entries(
            recall_user_memories(
                user_id,
                query,
                project_id=project_id,
                memory_type=memory_type,
                limit=limit,
            )
        )

    def recall_project_memory(query: str = "", limit: int = 8) -> str:
        """Recall durable memories attached to the current project."""
        if project_id is None:
            return "No project_id is available for project memory recall."
        return format_memory_entries(recall_project_memories(project_id, query, user_id=user_id, limit=limit))

    def recall_team_memory(query: str = "", limit: int = 6) -> str:
        """Recall durable team-visible memories shared across Alleato users."""
        return format_memory_entries(recall_team_memories(query, limit=limit))

    def propose_memory_candidate(scope: MemoryScope, fact: str) -> str:
        """Propose a durable memory candidate for human approval.

        This does not write to the database. Use it for stable preferences,
        commitments, project facts, or lessons that should be reviewed before
        becoming permanent memory.
        """
        cleaned = " ".join(fact.split())
        if not cleaned:
            return "Memory candidate rejected: fact is blank."
        if len(cleaned) > 500:
            cleaned = cleaned[:497].rstrip() + "..."
        candidate = MemoryCandidate(scope=scope, fact=cleaned, requiresApproval=True)
        if candidate_sink is not None:
            candidate_sink.append(candidate)
        return (
            "Memory candidate captured for approval. "
            f"scope={candidate.scope}; requiresApproval=true; fact={candidate.fact}"
        )

    factories: list[tuple[str, Callable[..., str], str]] = [
        ("recall_user_memory", recall_user_memory, "Recall current user's durable Alleato memories."),
        ("recall_project_memory", recall_project_memory, "Recall durable memories attached to the current project."),
        ("recall_team_memory", recall_team_memory, "Recall team-visible durable Alleato memories."),
        (
            "propose_memory_candidate",
            propose_memory_candidate,
            "Capture an approval-only durable memory candidate without writing to the database.",
        ),
    ]
    return [
        StructuredTool.from_function(func=func, name=name, description=description)
        for name, func, description in factories
    ]
