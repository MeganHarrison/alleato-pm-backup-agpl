"""Tests for backend durable Deep Agents memory."""

from __future__ import annotations

from src.services.agents.memory.middleware import DbMemoryMiddleware, _fetch_memory_block
from src.services.agents.memory.store import (
    MemoryEntry,
    ProjectMemory,
    UserMemory,
    build_memory_block,
    format_memory_entries,
)
from src.services.agents.memory import store as memory_store
from src.services.agents.memory.tools import build_memory_tools


def test_build_memory_block_formats_user_and_project_memory():
    block = build_memory_block(
        UserMemory(
            user_id="user-1",
            entries=[("preference", "Keep answers concise.")],
            raw_markdown="## User Memory\n\n### Preferences\n\n- Keep answers concise.",
        ),
        ProjectMemory(
            project_id=983,
            project_name="Union Collective",
            entries=[("commitment", "Owner asked for Division 9 detail.")],
            raw_markdown="## Project Memory - Union Collective\n\n### Commitments\n\n- Owner asked for Division 9 detail.",
        ),
    )

    assert "## User Memory" in block
    assert "Keep answers concise." in block
    assert "## Project Memory - Union Collective" in block
    assert "Owner asked for Division 9 detail." in block


def test_fetch_memory_block_uses_configurable_user_and_project(monkeypatch):
    captured: dict[str, object] = {}

    def fake_user_memory(user_id):
        captured["user_id"] = user_id
        return UserMemory(
            user_id=user_id,
            entries=[("preference", "Prefer live DB evidence.")],
            raw_markdown="## User Memory\n\n### Preferences\n\n- Prefer live DB evidence.",
        )

    def fake_project_memory(project_id, user_id=None):
        captured["project_id"] = project_id
        captured["project_user_id"] = user_id
        return ProjectMemory(
            project_id=int(project_id),
            project_name="Union Collective",
            entries=[("context", "Division 9 cost codes were requested.")],
            raw_markdown="## Project Memory - Union Collective\n\n### Contexts\n\n- Division 9 cost codes were requested.",
        )

    monkeypatch.setattr("src.services.agents.memory.middleware.load_user_memory", fake_user_memory)
    monkeypatch.setattr("src.services.agents.memory.middleware.load_project_memory", fake_project_memory)

    block = _fetch_memory_block(
        {
            "configurable": {
                "thread_id": "session-1",
                "user_id": "user-1",
                "project_id": 983,
            }
        }
    )

    assert captured == {"user_id": "user-1", "project_id": 983, "project_user_id": "user-1"}
    assert "Prefer live DB evidence." in block
    assert "Division 9 cost codes were requested." in block


def test_memory_tools_recall_bound_user_project_and_capture_candidate(monkeypatch):
    captured: dict[str, object] = {}

    def fake_recall_user_memories(user_id, query="", *, project_id=None, memory_type=None, limit=8):
        captured["user"] = {
            "user_id": user_id,
            "query": query,
            "project_id": project_id,
            "memory_type": memory_type,
            "limit": limit,
        }
        return [
            MemoryEntry(
                id="mem-1",
                memory_type="preference",
                content="Prefer direct DB evidence.",
                project_id=None,
                source="manual",
                visibility="private",
                created_at="2026-05-18T00:00:00Z",
                importance=0.9,
                confidence=0.95,
                score=3.2,
            )
        ]

    def fake_recall_project_memories(project_id, query="", *, user_id=None, limit=8):
        captured["project"] = {"project_id": project_id, "query": query, "user_id": user_id, "limit": limit}
        return [
            MemoryEntry(
                id="mem-2",
                memory_type="context",
                content="Division 9 cost codes were requested.",
                project_id=int(project_id),
                source="conversation",
                visibility="private",
                created_at="2026-05-18T00:00:00Z",
                importance=0.8,
                confidence=0.9,
                score=2.9,
            )
        ]

    monkeypatch.setattr("src.services.agents.memory.tools.recall_user_memories", fake_recall_user_memories)
    monkeypatch.setattr("src.services.agents.memory.tools.recall_project_memories", fake_recall_project_memories)

    candidates = []
    tools = {tool.name: tool for tool in build_memory_tools(user_id="user-1", project_id=983, candidate_sink=candidates)}

    user_output = tools["recall_user_memory"].invoke({"query": "evidence", "memory_type": "preference", "limit": 3})
    project_output = tools["recall_project_memory"].invoke({"query": "Division 9", "limit": 2})
    candidate_output = tools["propose_memory_candidate"].invoke(
        {"scope": "project", "fact": "Owner wants Division 9 cost code detail."}
    )

    assert "Prefer direct DB evidence." in user_output
    assert "Division 9 cost codes were requested." in project_output
    assert captured["user"] == {
        "user_id": "user-1",
        "query": "evidence",
        "project_id": 983,
        "memory_type": "preference",
        "limit": 3,
    }
    assert captured["project"] == {"project_id": 983, "query": "Division 9", "user_id": "user-1", "limit": 2}
    assert "requiresApproval=true" in candidate_output
    assert len(candidates) == 1
    assert candidates[0].scope == "project"
    assert candidates[0].requires_approval is True


def test_format_memory_entries_reports_no_matches_loudly():
    assert format_memory_entries([]) == "No matching durable memories found."


def test_project_memory_recall_filters_private_rows_to_owner_or_team(monkeypatch):
    captured: dict[str, object] = {}

    def fake_query(clauses, params, query, limit):
        captured["clauses"] = clauses
        captured["params"] = params
        captured["query"] = query
        captured["limit"] = limit
        return []

    monkeypatch.setattr(memory_store, "_query_and_rank_memories", fake_query)

    memory_store.recall_project_memories(983, "Division 9", user_id="user-1", limit=4)

    assert "(visibility = 'team' OR user_id = :uid)" in captured["clauses"]
    assert captured["params"]["uid"] == "user-1"
    assert captured["params"]["pid"] == 983
    assert captured["limit"] == 4


def test_project_memory_recall_without_user_only_returns_team_memory(monkeypatch):
    captured: dict[str, object] = {}

    def fake_query(clauses, params, query, limit):
        captured["clauses"] = clauses
        captured["params"] = params
        return []

    monkeypatch.setattr(memory_store, "_query_and_rank_memories", fake_query)

    memory_store.recall_project_memories(983, "Division 9")

    assert "visibility = 'team'" in captured["clauses"]
    assert "uid" not in captured["params"]


def test_memory_middleware_loads_once(monkeypatch):
    monkeypatch.setattr(
        "src.services.agents.memory.middleware._fetch_memory_block",
        lambda config: "## User Memory\n\n- Prefer concise answers.",
    )
    middleware = DbMemoryMiddleware()

    first = middleware.before_agent({}, runtime=None, config={"configurable": {"user_id": "user-1"}})
    second = middleware.before_agent({"_memory_loaded": True}, runtime=None, config={"configurable": {"user_id": "user-1"}})

    assert first == {
        "_memory_loaded": True,
        "_memory_block": "## User Memory\n\n- Prefer concise answers.",
    }
    assert second is None
