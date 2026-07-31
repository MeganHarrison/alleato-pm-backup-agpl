"""Tests for the Alleato App Expert Deep Agents endpoint."""

from __future__ import annotations

from typing import Any

from src.services.agents.app_expert import AppExpertRequest, run_app_expert_agent
from src.services.agents.app_expert.tools import (
    get_app_expert_artifact_status,
    lookup_app_route,
    search_feature_registry,
)


def _override_app_expert_auth(app, path="/api/intelligence/app-expert"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"App Expert route was not registered: {path}")


def _clear_app_expert_auth(app, path="/api/intelligence/app-expert"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def _app_expert_route_endpoint(app, path="/api/intelligence/app-expert"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"App Expert route was not registered: {path}")


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
                        "Use /[projectId]/change-events for project change events. "
                        "Source: docs/alleato-os-docs/help/articles/change-events.mdx and "
                        "frontend/src/app/(main)/[projectId]/change-events/page.tsx."
                    )
                }
            ]
        }


def test_app_expert_tools_read_generated_artifacts():
    status = get_app_expert_artifact_status.func()
    assert "app-sitemap.generated.json" in status
    assert '"ok": true' in status

    route = lookup_app_route.func("/[projectId]/change-events")
    assert '"ok": true' in route
    assert "change-events" in route

    features = search_feature_registry.func("permissions visibility", 3)
    assert '"ok": true' in features
    assert "permissions" in features.lower()


def test_run_app_expert_agent_uses_read_only_tools_and_skills():
    captured: dict[str, Any] = {}

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        return _FakeAgent(captured)

    response = run_app_expert_agent(
        AppExpertRequest(
            userId="user-1",
            sessionId="session-1",
            currentRoute="/983/change-events",
            projectId=983,
            question="Where do I create a change event?",
            approvedSkillContext=(
                "## Approved Skill Library Context\n\n"
                "### Explain change event navigation (v1, app_help, low risk)\n"
                "Instructions: Explain the route and page controls first."
            ),
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents"
    assert response.orchestrator == "app-expert"
    assert "app-navigation-and-sitemap" in response.skills_loaded
    assert captured["name"] == "app-expert"
    tool_names = [getattr(tool, "name", "") for tool in captured["tools"]]
    assert "search_app_sitemap" in tool_names
    assert "search_feature_registry" in tool_names
    assert "query_db" not in tool_names
    assert "draft_rfi" not in tool_names
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    assert captured["config"]["configurable"]["project_id"] == 983
    prompt = captured["payload"]["messages"][0]["content"]
    assert "Current route supplied by caller: /983/change-events" in prompt
    assert "Approved app-help Skill Library context" in prompt
    assert "Explain change event navigation" in prompt
    assert response.approved_skill_context is not None
    assert "Explain change event navigation" in response.approved_skill_context
    assert "Do not perform writes" in captured["system_prompt"]


def test_run_app_expert_agent_fails_loudly_on_empty_runtime_response():
    class EmptyAgent:
        def invoke(self, *_args, **_kwargs):
            return {"messages": [{"content": ""}]}

    response = run_app_expert_agent(
        AppExpertRequest(userId="user-1", question="What page owns RFIs?"),
        create_agent=lambda **_kwargs: EmptyAgent(),
    )

    assert response.mode == "unavailable"
    assert response.tool_trace[0].status == "failed"
    assert "empty response" in response.answer


def test_app_expert_route_is_feature_gated(client, monkeypatch):
    _override_app_expert_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_APP_EXPERT_ENABLED", "false")
    try:
        response = client.post(
            "/api/intelligence/app-expert",
            json={"userId": "user-1", "question": "Where are RFIs?"},
        )
    finally:
        _clear_app_expert_auth(client.app)

    assert response.status_code == 503
    assert "DEEP_AGENTS_APP_EXPERT_ENABLED=true" in response.json()["detail"]


def test_app_expert_route_returns_payload(client, monkeypatch):
    _override_app_expert_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_APP_EXPERT_ENABLED", "true")

    def fake_run_app_expert_agent(request, *, model):
        assert request.question == "Where are RFIs?"
        assert model == "openai:gpt-5.4-mini"
        return run_app_expert_agent(
            request,
            create_agent=lambda **_kwargs: _FakeAgent({}),
            model=model,
        )

    monkeypatch.setitem(
        _app_expert_route_endpoint(client.app).__globals__,
        "run_app_expert_agent",
        fake_run_app_expert_agent,
    )
    try:
        response = client.post(
            "/api/intelligence/app-expert",
            json={"userId": "user-1", "sessionId": "session-1", "question": "Where are RFIs?"},
        )
    finally:
        _clear_app_expert_auth(client.app)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"


def test_app_expert_route_accepts_approved_skill_context(client, monkeypatch):
    _override_app_expert_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_APP_EXPERT_ENABLED", "true")

    captured: dict[str, Any] = {}

    def fake_run_app_expert_agent(request, *, model):
        captured["approved_skill_context"] = request.approved_skill_context
        return run_app_expert_agent(
            request,
            create_agent=lambda **_kwargs: _FakeAgent({}),
            model=model,
        )

    monkeypatch.setitem(
        _app_expert_route_endpoint(client.app).__globals__,
        "run_app_expert_agent",
        fake_run_app_expert_agent,
    )
    try:
        response = client.post(
            "/api/intelligence/app-expert",
            json={
                "userId": "user-1",
                "sessionId": "session-1",
                "question": "Where are RFIs?",
                "approvedSkillContext": (
                    "## Approved Skill Library Context\n\n"
                    "### Explain RFI navigation (v1, app_help, low risk)"
                ),
            },
        )
    finally:
        _clear_app_expert_auth(client.app)

    assert response.status_code == 200
    assert "Explain RFI navigation" in captured["approved_skill_context"]
    assert "Explain RFI navigation" in response.json()["approvedSkillContext"]
