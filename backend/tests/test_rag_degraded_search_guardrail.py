"""Guardrail tests for the degraded vector-search detector in alleato_ai_tools.rag.

Regression coverage for the 2026-06-24 incident: the Microsoft Executive Assistant
reported "no matching passages" for a sudden-resignation question whose evidence
(the resignation email thread + an interview meeting) was fully embedded. The
backend vector search returned empty across email, Teams, AND files simultaneously
— the signature of a degraded embedding/search backend (provider/key/model drift)
masquerading as a clean negative.

The guardrail probes with a sentinel on every empty result and raises
``CorpusSearchDegradedError`` when the backend is degraded, so callers fail loudly
instead of asserting absence of evidence.
"""
from unittest.mock import patch

import pytest

from src.services.agents.alleato_ai_tools import rag


def _reset_health_cache():
    rag._health_cache["checked_at"] = 0.0
    rag._health_cache["healthy"] = True


def test_empty_result_with_healthy_backend_returns_empty(monkeypatch):
    """A genuine true-negative: RPC empty, but the sentinel probe succeeds."""
    _reset_health_cache()
    monkeypatch.setenv("RAG_SEARCH_HEALTHCHECK_ENABLED", "true")
    monkeypatch.delenv("COHERE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with patch.object(rag, "_embed_query", return_value="[0.0]"), patch.object(
        rag, "_corpus_search_healthy", return_value=True
    ), patch.object(rag, "get_rag_read_client") as mock_client:
        mock_client.return_value.rpc.return_value.execute.return_value.data = []
        assert rag.retrieve("anything", source_types=["email"]) == []


def test_empty_result_with_degraded_backend_raises(monkeypatch):
    """The incident: RPC empty AND the sentinel probe fails -> loud error."""
    _reset_health_cache()
    monkeypatch.setenv("RAG_SEARCH_HEALTHCHECK_ENABLED", "true")
    monkeypatch.delenv("COHERE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with patch.object(rag, "_embed_query", return_value="[0.0]"), patch.object(
        rag, "_corpus_search_healthy", return_value=False
    ), patch.object(rag, "get_rag_read_client") as mock_client:
        mock_client.return_value.rpc.return_value.execute.return_value.data = []
        with pytest.raises(rag.CorpusSearchDegradedError):
            rag.retrieve("resignation effective immediately", source_types=["email"])


def test_healthcheck_disabled_never_raises(monkeypatch):
    """The kill switch: with the guardrail disabled, empty stays empty."""
    _reset_health_cache()
    monkeypatch.setenv("RAG_SEARCH_HEALTHCHECK_ENABLED", "false")
    monkeypatch.delenv("COHERE_API_KEY", raising=False)
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)

    with patch.object(rag, "_embed_query", return_value="[0.0]"), patch.object(
        rag, "_corpus_search_healthy", side_effect=AssertionError("must not probe")
    ), patch.object(rag, "get_rag_read_client") as mock_client:
        mock_client.return_value.rpc.return_value.execute.return_value.data = []
        assert rag.retrieve("anything", source_types=["email"]) == []


def test_sentinel_probe_unhealthy_on_low_similarity(monkeypatch):
    """An incompatible embedding space yields near-zero similarities -> unhealthy."""
    _reset_health_cache()
    with patch.object(rag, "_embed_query", return_value="[0.0]"), patch.object(
        rag, "get_rag_read_client"
    ) as mock_client:
        mock_client.return_value.rpc.return_value.execute.return_value.data = [
            {"similarity": 0.01}
        ]
        assert rag._corpus_search_healthy("search_document_chunks") is False


def test_sentinel_probe_healthy_on_strong_similarity(monkeypatch):
    """A healthy index returns a strong neighbour for an in-domain sentinel."""
    _reset_health_cache()
    with patch.object(rag, "_embed_query", return_value="[0.0]"), patch.object(
        rag, "get_rag_read_client"
    ) as mock_client:
        mock_client.return_value.rpc.return_value.execute.return_value.data = [
            {"similarity": 0.55}
        ]
        assert rag._corpus_search_healthy("search_document_chunks") is True


def test_graph_api_email_search_surfaces_degraded_marker(monkeypatch):
    """search_emails must convert the degraded error into the loud marker."""
    from src.services.agents.alleato_ai_tools import graph_api

    with patch.object(
        graph_api, "retrieve", side_effect=rag.CorpusSearchDegradedError("backend down")
    ):
        out = graph_api.search_emails.func(query="resignation")  # type: ignore[attr-defined]
    assert out.startswith(graph_api._SEARCH_DEGRADED_MARKER)
