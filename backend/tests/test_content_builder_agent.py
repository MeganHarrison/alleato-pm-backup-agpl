"""Tests for the standalone Alleato Deep Agents content builder endpoint."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.api import main as api_main
from src.services.agents.content_builder import ContentBuilderRequest, run_content_builder_agent
from src.services.agents.content_builder.tools import generate_cover, web_search


def _override_content_builder_auth(app, path="/api/intelligence/content-builder"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides[dependency.call] = lambda: None
            return
    raise AssertionError(f"Content builder route was not registered: {path}")


def _clear_content_builder_auth(app, path="/api/intelligence/content-builder"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            for dependency in getattr(route, "dependant", None).dependencies:
                if dependency.name == "_":
                    app.dependency_overrides.pop(dependency.call, None)


def _content_builder_route_endpoint(app, path="/api/intelligence/content-builder"):
    for route in app.routes:
        if getattr(route, "path", None) == path:
            return route.endpoint
    raise AssertionError(f"Content builder route was not registered: {path}")


class _FakeAgent:
    def __init__(self, captured: dict[str, Any], workspace: Path):
        self.captured = captured
        self.workspace = workspace

    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        self.captured["payload"] = payload
        self.captured["config"] = config
        output_dir = self.workspace / "blogs" / "ai-agents"
        output_dir.mkdir(parents=True, exist_ok=True)
        (output_dir / "post.md").write_text("# AI Agents\n\nDraft content.", encoding="utf-8")
        return {"messages": [{"content": "Content complete. Saved blogs/ai-agents/post.md."}]}


def test_run_content_builder_uses_packaged_memory_skills_subagents_and_workspace(monkeypatch, tmp_path):
    captured: dict[str, Any] = {}
    monkeypatch.setenv("CONTENT_BUILDER_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.content_builder.agent.OUTPUT_BASE_DIR", tmp_path)

    def fake_create_agent(**kwargs):
        captured.update(kwargs)
        workspace = Path(kwargs["backend"].cwd)
        return _FakeAgent(captured, workspace)

    response = run_content_builder_agent(
        ContentBuilderRequest(
            userId="user-1",
            sessionId="session-1",
            prompt="Write a blog post about AI agents",
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents", response.answer
    assert response.orchestrator == "alleato-content-builder-orchestrator"
    assert "blog-post" in response.skills_loaded
    assert "social-media" in response.skills_loaded
    assert "content-builder-memory" in response.skills_loaded
    assert any(artifact.path == "blogs/ai-agents/post.md" for artifact in response.artifacts)
    assert captured["name"] == "alleato-content-builder-orchestrator"
    assert Path(captured["memory"][0]).name == "AGENTS.md"
    assert Path(captured["skills"][0]).name == "skills"
    assert any(subagent["name"] == "researcher" for subagent in captured["subagents"])
    assert any(
        subagent["name"] == "researcher"
        and subagent["model"] == "anthropic:claude-haiku-4-5-20251001"
        for subagent in captured["subagents"]
    )
    assert captured["config"]["configurable"]["thread_id"] == "session-1"
    prompt = captured["payload"]["messages"][0]["content"]
    assert "Save research under research/<slug>.md" in prompt
    assert "Generate the required companion image" in prompt


def test_run_content_builder_fails_loudly_without_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("CONTENT_BUILDER_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.content_builder.agent.OUTPUT_BASE_DIR", tmp_path)
    monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = run_content_builder_agent(
        ContentBuilderRequest(userId="user-1", prompt="Write a LinkedIn post about AI agents")
    )

    assert response.mode == "unavailable"
    assert response.tool_trace[0].status == "failed"
    assert "AI_GATEWAY_API_KEY or OPENAI_API_KEY" in response.answer


def test_content_builder_tools_report_missing_external_keys(monkeypatch):
    monkeypatch.delenv("TAVILY_API_KEY", raising=False)
    monkeypatch.delenv("GOOGLE_API_KEY", raising=False)
    monkeypatch.delenv("GEMINI_API_KEY", raising=False)

    search_result = web_search.func("Alleato construction AI", 2)
    image_result = generate_cover.func("Minimal AI agents illustration", "ai-agents")

    assert "WEB_SEARCH_UNAVAILABLE" in search_result["error"]
    assert "IMAGE_GENERATION_UNAVAILABLE" in image_result


def test_content_builder_route_is_feature_gated(client, monkeypatch):
    _override_content_builder_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_CONTENT_BUILDER_ENABLED", "false")
    try:
        response = client.post(
            "/api/intelligence/content-builder",
            json={"userId": "user-1", "prompt": "Write a blog post"},
        )
    finally:
        _clear_content_builder_auth(client.app)

    assert response.status_code == 503
    assert "DEEP_AGENTS_CONTENT_BUILDER_ENABLED=true" in response.json()["detail"]


def test_content_builder_route_returns_payload(client, monkeypatch):
    _override_content_builder_auth(client.app)
    monkeypatch.setenv("DEEP_AGENTS_CONTENT_BUILDER_ENABLED", "true")

    def fake_run_content_builder_agent(request, *, model):
        assert request.prompt == "Write a blog post"
        assert model == "openai:gpt-5.4-mini"
        return run_content_builder_agent(
            request,
            create_agent=lambda **kwargs: _FakeAgent({}, Path(kwargs["backend"].cwd)),
            model=model,
        )

    monkeypatch.setitem(
        _content_builder_route_endpoint(client.app).__globals__,
        "run_content_builder_agent",
        fake_run_content_builder_agent,
    )
    try:
        response = client.post(
            "/api/intelligence/content-builder",
            json={"userId": "user-1", "sessionId": "session-1", "prompt": "Write a blog post"},
        )
    finally:
        _clear_content_builder_auth(client.app)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"
