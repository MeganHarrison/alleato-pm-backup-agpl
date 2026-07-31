"""Tests for the standalone Alleato Deep Agents research endpoint."""

from __future__ import annotations

from typing import Any

from src.api import main as api_main
from src.services.agents.research_agent import ResearchRequest, run_research_agent
from src.services.agents.research_agent.tools import web_search


def _override_research_auth(app, path="/api/intelligence/research"):
    """Override the admin dependency even when test conftest imports it as a mock."""
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"Research route was not registered: {path}")


def _clear_research_auth(app, path="/api/intelligence/research"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def _research_route_endpoint(app, path="/api/intelligence/research"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"Research route was not registered: {path}")


class _FakeAgent:
    def __init__(self, captured: dict[str, Any]):
        self.captured = captured

    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        self.captured["payload"] = payload
        self.captured["config"] = config
        return {
            "messages": [
                {
                    "content": (
                        "Research complete. Public source: "
                        "https://example.com/report. Alleato internal evidence was checked separately."
                    )
                }
            ]
        }


def test_run_research_agent_uses_deep_agents_tools_subagents_and_skills():
    captured: dict[str, Any] = {}

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        return _FakeAgent(captured)

    response = run_research_agent(
        ResearchRequest(
            userId="user-1",
            sessionId="session-1",
            projectId=983,
            question="Research current procurement risks for this project",
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents"
    assert response.orchestrator == "alleato-research-orchestrator"
    assert response.sources[0].url == "https://example.com/report"
    assert "web-research" in response.skills_loaded
    assert captured["name"] == "alleato-research-orchestrator"
    assert any(getattr(tool, "name", "") == "web_search" for tool in captured["tools"])
    assert any(subagent["name"] == "web_researcher" for subagent in captured["subagents"])
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    assert captured["config"]["configurable"]["user_id"] == "user-1"
    assert captured["config"]["configurable"]["project_id"] == 983
    prompt = captured["payload"]["messages"][0]["content"]
    assert "Project ID supplied by caller: 983" in prompt
    assert "research-only" in prompt


def test_run_research_agent_attaches_memory_middleware_when_enabled(monkeypatch):
    captured: dict[str, Any] = {}

    monkeypatch.setenv("DEEP_AGENTS_MEMORY_ENABLED", "true")

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        return _FakeAgent(captured)

    response = run_research_agent(
        ResearchRequest(
            userId="user-1",
            sessionId="session-1",
            projectId=983,
            question="Research procurement risks",
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents"
    assert captured["middleware"]
    assert captured["middleware"][0].__class__.__name__ == "DbMemoryMiddleware"
    tool_names = [getattr(tool, "name", getattr(tool, "__name__", "")) for tool in captured["tools"]]
    assert "recall_user_memory" in tool_names
    assert "recall_project_memory" in tool_names
    assert "propose_memory_candidate" in tool_names
    assert "durable memory" in response.tool_trace[0].detail


def test_run_research_agent_fails_loudly_on_empty_runtime_response():
    class EmptyAgent:
        def invoke(self, *_args, **_kwargs):
            return {"messages": [{"content": ""}]}

    response = run_research_agent(
        ResearchRequest(userId="user-1", question="Research something"),
        create_agent=lambda **_kwargs: EmptyAgent(),
    )

    assert response.mode == "unavailable"
    assert response.tool_trace[0].status == "failed"
    assert "empty response" in response.answer


def test_web_search_reports_missing_tavily_key(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)

    result = web_search.func("Alleato construction AI", 2)

    assert "WEB_SEARCH_UNAVAILABLE" in result
    assert "TAVILY_API_KEY" in result


def test_research_route_is_feature_gated(client, monkeypatch):
    _override_research_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_RESEARCH_ENABLED", "false")
    try:
        response = client.post(
            "/api/intelligence/research",
            json={"userId": "user-1", "question": "Research test"},
        )
    finally:
        _clear_research_auth(client.app)

    assert response.status_code == 503
    assert "DEEP_AGENTS_RESEARCH_ENABLED=true" in response.json()["detail"]


def test_research_route_returns_research_payload(client, monkeypatch):
    _override_research_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_RESEARCH_ENABLED", "true")

    def fake_run_research_agent(request, *, model):
        assert request.question == "Research test"
        assert model == "openai:gpt-5.4-mini"
        return run_research_agent(
            request,
            create_agent=lambda **_kwargs: _FakeAgent({}),
            model=model,
        )

    monkeypatch.setitem(_research_route_endpoint(client.app).__globals__, "run_research_agent", fake_run_research_agent)
    try:
        response = client.post(
            "/api/intelligence/research",
            json={"userId": "user-1", "sessionId": "session-1", "question": "Research test"},
        )
    finally:
        _clear_research_auth(client.app)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"
