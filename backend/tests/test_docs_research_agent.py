"""Tests for the LangChain docs MCP Deep Agents endpoint."""

from __future__ import annotations

from typing import Any

from src.services.agents.docs_research_agent import DocsResearchRequest, run_docs_research_agent
from src.services.agents.docs_research_agent.tools import docs_mcp_search


def _override_route_auth(app, path: str):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"Route was not registered: {path}")


def _clear_route_auth(app, path: str):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def _route_endpoint(app, path: str):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"Route was not registered: {path}")


class _FakeDocsAgent:
    def __init__(self, captured: dict[str, Any]):
        self.captured = captured

    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        self.captured["payload"] = payload
        self.captured["config"] = config
        return {
            "messages": [
                {
                    "content": (
                        "Use FilesystemBackend with skills for local skill loading. "
                        "See https://docs.langchain.com/deepagents/mcp"
                    )
                }
            ]
        }


def test_run_docs_research_uses_packaged_memory_mcp_tool_and_thread(monkeypatch, tmp_path):
    captured: dict[str, Any] = {}
    monkeypatch.setenv("DOCS_RESEARCH_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.docs_research_agent.agent.OUTPUT_BASE_DIR", tmp_path)

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        return _FakeDocsAgent(captured)

    response = run_docs_research_agent(
        DocsResearchRequest(userId="user-1", sessionId="session-1", question="How do Deep Agents load skills?"),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents", response.answer
    assert response.orchestrator == "alleato-docs-mcp-research-orchestrator"
    assert response.docs_server == "https://docs.langchain.com/mcp"
    assert captured["name"] == "alleato-docs-mcp-research-orchestrator"
    assert captured["memory"][0].endswith("AGENTS.md")
    assert any(getattr(tool, "name", "") == "docs_mcp_search" for tool in captured["tools"])
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    assert response.sources[0].url == "https://docs.langchain.com/deepagents/mcp"
    assert "Use docs_mcp_search before answering" in captured["payload"]["messages"][0]["content"]


def test_docs_mcp_tool_reports_unavailable(monkeypatch):
    async def fake_call_docs_mcp(*_args, **_kwargs):
        raise RuntimeError("network down")

    monkeypatch.setattr("src.services.agents.docs_research_agent.tools._call_docs_mcp", fake_call_docs_mcp)
    result = docs_mcp_search.func("memory in Deep Agents", 3)

    assert "MCP_DOCS_UNAVAILABLE" in result
    assert "network down" in result


def test_docs_research_route_is_feature_gated(client, monkeypatch):
    path = "/api/intelligence/deep-agent/docs-research"
    _override_route_auth(client.app, path)
    monkeypatch.setenv("DEEP_AGENTS_DOCS_RESEARCH_ENABLED", "false")
    try:
        response = client.post(path, json={"userId": "user-1", "question": "How do I configure MCP?"})
    finally:
        _clear_route_auth(client.app, path)

    assert response.status_code == 503
    assert "DEEP_AGENTS_DOCS_RESEARCH_ENABLED=true" in response.json()["detail"]


def test_docs_research_route_returns_payload(client, monkeypatch):
    path = "/api/intelligence/deep-agent/docs-research"
    _override_route_auth(client.app, path)
    monkeypatch.setenv("DEEP_AGENTS_DOCS_RESEARCH_ENABLED", "true")

    def fake_run_docs_research_agent(request, *, model):
        assert request.question == "How do I configure MCP?"
        assert model == "openai:gpt-5.4-mini"
        return run_docs_research_agent(
            request,
            create_agent=lambda **kwargs: _FakeDocsAgent({}),
            model=model,
        )

    monkeypatch.setitem(
        _route_endpoint(client.app, path).__globals__,
        "run_docs_research_agent",
        fake_run_docs_research_agent,
    )
    try:
        response = client.post(path, json={"userId": "user-1", "question": "How do I configure MCP?"})
    finally:
        _clear_route_auth(client.app, path)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"
