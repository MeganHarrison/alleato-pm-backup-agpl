"""Tests for the Deep Agents LLM wiki endpoint."""

from __future__ import annotations

from pathlib import Path
from typing import Any

from src.services.agents.llm_wiki import WikiRequest, list_llm_wiki_archive, run_llm_wiki_agent


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


class _FakeWikiAgent:
    def __init__(self, captured: list[dict[str, Any]], workspace: Path):
        self.captured = captured
        self.workspace = workspace

    def invoke(self, payload: dict[str, Any], config: dict[str, Any] | None = None):
        prompt = payload["messages"][0]["content"]
        self.captured.append({"payload": payload, "config": config})
        if "FILING_DECISION" in prompt:
            return {"messages": [{"content": "ANSWER:\nAda was an early computing figure.\n\nFILING_DECISION: file\nFILING_REASON: durable summary"}]}
        if "Create or overwrite exactly" in prompt:
            output = self.workspace / "wiki" / "query" / "who-was-ada.md"
            output.parent.mkdir(parents=True, exist_ok=True)
            output.write_text("# Who was Ada?\n\nAda was an early computing figure.", encoding="utf-8")
            return {"messages": [{"content": "Filed query answer."}]}
        output = self.workspace / "wiki" / "concepts" / "ada-lovelace.md"
        output.parent.mkdir(parents=True, exist_ok=True)
        output.write_text("# Ada Lovelace\n\nEvidence from /raw/ada.md.", encoding="utf-8")
        return {"messages": [{"content": "Updated wiki/concepts/ada-lovelace.md."}]}


def test_llm_wiki_init_scaffolds_without_provider(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)
    monkeypatch.delenv("AI_GATEWAY_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    response = run_llm_wiki_agent(WikiRequest(userId="user-1", topic="Ada Lovelace", mode="init"))

    assert response.mode == "scaffold"
    assert any(artifact.path == "AGENTS.md" for artifact in response.artifacts)
    assert any(artifact.path == "wiki/index.md" for artifact in response.artifacts)
    assert response.tool_trace[0].status == "success"


def test_llm_wiki_ingest_stages_sources_and_updates_index(monkeypatch, tmp_path):
    captured: list[dict[str, Any]] = []
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)

    def fake_create_agent(**kwargs):
        return _FakeWikiAgent(captured, Path(kwargs["backend"].cwd))

    response = run_llm_wiki_agent(
        WikiRequest(
            userId="user-1",
            sessionId="session-1",
            topic="Ada Lovelace",
            mode="ingest",
            sources=[{"path": "ada.md", "content": "# Ada\n\nFirst source."}],
        ),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents", response.answer
    assert any(artifact.path == "raw/ada.md" for artifact in response.artifacts)
    assert any(artifact.path == "wiki/concepts/ada-lovelace.md" for artifact in response.artifacts)
    assert any(artifact.path == "log.md" and "ingest.apply" in (artifact.content or "") for artifact in response.artifacts)
    assert captured[0]["config"]["configurable"]["thread_id"] == "session-1"
    assert "Read all staged files in `/raw/`" in captured[0]["payload"]["messages"][0]["content"]


def test_llm_wiki_query_files_durable_answer(monkeypatch, tmp_path):
    captured: list[dict[str, Any]] = []
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)

    def fake_create_agent(**kwargs):
        return _FakeWikiAgent(captured, Path(kwargs["backend"].cwd))

    response = run_llm_wiki_agent(
        WikiRequest(userId="user-1", topic="Ada Lovelace", mode="query", question="Who was Ada?"),
        create_agent=fake_create_agent,
    )

    assert response.mode == "deep_agents"
    assert "Ada was an early computing figure" in response.answer
    assert any(artifact.path == "wiki/query/who-was-ada.md" for artifact in response.artifacts)
    assert any("query.apply" in (artifact.content or "") for artifact in response.artifacts if artifact.path == "log.md")


def test_llm_wiki_archive_lists_past_research_projects(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)

    run_llm_wiki_agent(WikiRequest(userId="user-1", sessionId="session-1", topic="Ada Lovelace", mode="init"))

    archive = list_llm_wiki_archive(user_id="user-1")

    assert archive.projects[0].user_id == "user-1"
    assert archive.projects[0].topic_slug == "ada-lovelace"
    assert archive.projects[0].session_id == "session-1"
    assert archive.projects[0].artifact_count >= 3
    assert archive.projects[0].log_summary == "Wiki scaffold initialized."


def test_llm_wiki_archive_returns_selected_artifacts(monkeypatch, tmp_path):
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)

    run_llm_wiki_agent(WikiRequest(userId="user-1", sessionId="session-1", topic="Ada Lovelace", mode="init"))

    archive = list_llm_wiki_archive(user_id="user-1", topic_slug="ada-lovelace", session_id="session-1")

    assert archive.selected_project is not None
    assert any(artifact.path == "wiki/index.md" and artifact.content for artifact in archive.artifacts)


def test_llm_wiki_route_is_feature_gated(client, monkeypatch):
    path = "/api/intelligence/deep-agent/llm-wiki"
    _override_route_auth(client.app, path)
    monkeypatch.setenv("DEEP_AGENTS_LLM_WIKI_ENABLED", "false")
    try:
        response = client.post(path, json={"userId": "user-1", "topic": "Ada", "mode": "init"})
    finally:
        _clear_route_auth(client.app, path)

    assert response.status_code == 503
    assert "DEEP_AGENTS_LLM_WIKI_ENABLED=true" in response.json()["detail"]


def test_llm_wiki_route_returns_payload(client, monkeypatch):
    path = "/api/intelligence/deep-agent/llm-wiki"
    _override_route_auth(client.app, path)
    monkeypatch.setenv("DEEP_AGENTS_LLM_WIKI_ENABLED", "true")

    def fake_run_llm_wiki_agent(request, *, model):
        assert request.topic == "Ada"
        assert model == "openai:gpt-5.4-mini"
        return run_llm_wiki_agent(request, create_agent=lambda **kwargs: _FakeWikiAgent([], Path(kwargs["backend"].cwd)), model=model)

    monkeypatch.setitem(
        _route_endpoint(client.app, path).__globals__,
        "run_llm_wiki_agent",
        fake_run_llm_wiki_agent,
    )
    try:
        response = client.post(
            path,
            json={
                "userId": "user-1",
                "topic": "Ada",
                "mode": "ingest",
                "sources": [{"path": "ada.md", "content": "Ada source"}],
            },
        )
    finally:
        _clear_route_auth(client.app, path)

    assert response.status_code == 200
    body = response.json()
    assert body["mode"] == "deep_agents"
    assert body["toolTrace"][0]["status"] == "success"


def test_llm_wiki_archive_route_returns_payload(client, monkeypatch, tmp_path):
    path = "/api/intelligence/deep-agent/llm-wiki/archive"
    _override_route_auth(client.app, path)
    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", str(tmp_path))
    monkeypatch.setattr("src.services.agents.llm_wiki.agent.OUTPUT_BASE_DIR", tmp_path)
    monkeypatch.setitem(
        _route_endpoint(client.app, path).__globals__,
        "list_llm_wiki_archive",
        list_llm_wiki_archive,
    )
    run_llm_wiki_agent(WikiRequest(userId="user-1", sessionId="session-1", topic="Ada Lovelace", mode="init"))

    try:
        response = client.get(path, params={"userId": "user-1", "topicSlug": "ada-lovelace", "sessionId": "session-1"})
    finally:
        _clear_route_auth(client.app, path)

    assert response.status_code == 200
    body = response.json()
    assert body["selectedProject"]["topicSlug"] == "ada-lovelace"
    assert any(artifact["path"] == "wiki/index.md" for artifact in body["artifacts"])


def test_storage_durability_status_flags_tmp_roots(monkeypatch):
    from src.services.agents.llm_wiki.agent import storage_durability_status

    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", "/tmp/alleato-llm-wiki")
    monkeypatch.delenv("DOCS_RESEARCH_OUTPUT_ROOT", raising=False)
    monkeypatch.delenv("CONTENT_BUILDER_OUTPUT_ROOT", raising=False)

    status = storage_durability_status()

    assert status["durable"] is False
    assert status["roots"]["llm_wiki"]["durable"] is False
    assert status["roots"]["docs_research"]["durable"] is False


def test_storage_durability_status_passes_for_persistent_disk(monkeypatch):
    from src.services.agents.llm_wiki.agent import storage_durability_status

    monkeypatch.setenv("LLM_WIKI_OUTPUT_ROOT", "/data/llm-wiki")
    monkeypatch.setenv("DOCS_RESEARCH_OUTPUT_ROOT", "/data/docs-research")
    monkeypatch.setenv("CONTENT_BUILDER_OUTPUT_ROOT", "/data/content-builder")

    status = storage_durability_status()

    assert status["durable"] is True
    assert all(entry["durable"] for entry in status["roots"].values())
