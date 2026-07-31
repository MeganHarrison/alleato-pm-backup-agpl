from types import SimpleNamespace

import pytest

from src.services.pipeline import workflow_client


def test_workflow_client_requires_secret(monkeypatch):
    monkeypatch.delenv("RAG_PIPELINE_WORKFLOW_SECRET", raising=False)
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)

    with pytest.raises(
        RuntimeError,
        match="RAG_PIPELINE_WORKFLOW_SECRET or ADMIN_API_KEY",
    ):
        workflow_client.enqueue_document_workflow("doc-1")


def test_workflow_client_posts_authenticated_request_and_returns_run_id(
    monkeypatch,
):
    calls = []

    class _Response:
        def raise_for_status(self):
            return None

        def json(self):
            return {"runId": "wrun-1", "status": "queued"}

    monkeypatch.setenv("RAG_PIPELINE_WORKFLOW_SECRET", "test-secret")
    monkeypatch.setenv("ADMIN_API_KEY", "admin-fallback")
    monkeypatch.setenv(
        "RAG_PIPELINE_WORKFLOW_URL",
        "https://example.test/api/rag-pipeline/process/",
    )
    monkeypatch.setattr(
        workflow_client.httpx,
        "post",
        lambda url, **kwargs: calls.append((url, kwargs)) or _Response(),
    )

    result = workflow_client.enqueue_document_workflow(
        "doc-2",
        source_type="sharepoint",
        project_hint=67,
    )

    assert result["runId"] == "wrun-1"
    assert calls == [
        (
            "https://example.test/api/rag-pipeline/process",
            {
                "headers": {
                    "Authorization": "Bearer test-secret",
                    "Content-Type": "application/json",
                },
                "json": {
                    "documentId": "doc-2",
                    "sourceType": "sharepoint",
                    "projectHint": 67,
                },
                "timeout": 20.0,
            },
        )
    ]


def test_workflow_client_uses_existing_admin_key_as_server_fallback(monkeypatch):
    calls = []
    response = SimpleNamespace(
        raise_for_status=lambda: None,
        json=lambda: {"runId": "wrun-fallback", "status": "queued"},
    )
    monkeypatch.delenv("RAG_PIPELINE_WORKFLOW_SECRET", raising=False)
    monkeypatch.setenv("ADMIN_API_KEY", "admin-fallback")
    monkeypatch.setenv(
        "RAG_PIPELINE_WORKFLOW_URL",
        "https://example.test/api/rag-pipeline/process",
    )
    monkeypatch.setattr(
        workflow_client.httpx,
        "post",
        lambda url, **kwargs: calls.append((url, kwargs)) or response,
    )

    result = workflow_client.enqueue_document_workflow("doc-fallback")

    assert result["runId"] == "wrun-fallback"
    assert calls[0][1]["headers"]["Authorization"] == "Bearer admin-fallback"


def test_workflow_client_uses_stable_production_url_when_render_env_drifts(
    monkeypatch,
):
    monkeypatch.delenv("RAG_PIPELINE_WORKFLOW_URL", raising=False)
    monkeypatch.delenv("FRONTEND_URL", raising=False)

    assert workflow_client._workflow_url() == (
        "https://frontend-iota-ochre-85.vercel.app/api/rag-pipeline/process"
    )


def test_workflow_client_rejects_success_without_run_id(monkeypatch):
    response = SimpleNamespace(
        raise_for_status=lambda: None,
        json=lambda: {"status": "accepted"},
    )
    monkeypatch.setenv("RAG_PIPELINE_WORKFLOW_SECRET", "test-secret")
    monkeypatch.setenv("FRONTEND_URL", "https://app.example.test/")
    monkeypatch.delenv("RAG_PIPELINE_WORKFLOW_URL", raising=False)
    monkeypatch.setattr(workflow_client.httpx, "post", lambda *_a, **_k: response)

    with pytest.raises(RuntimeError, match="without a runId"):
        workflow_client.enqueue_document_workflow("doc-3")
