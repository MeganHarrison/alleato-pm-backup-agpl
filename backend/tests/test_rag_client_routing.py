"""Guardrail tests for RAG client routing in supabase_helpers.

Regression coverage for the 2026-06-10 incident: a backend service (the
``alleato-fireflies-sync`` cron) was missing ``RAG_DATABASE_READS_ENABLED`` while
``RAG_SUPABASE_URL`` was configured. The old resolver silently fell back to the
PM APP client, which no longer has ``rag_document_metadata`` — every Fireflies
segmentation job failed with PGRST205 and meetings got zero ``meeting_segments``.

The resolver must route RAG reads/writes to the AI Database whenever RAG
credentials are configured, regardless of the cutover flag.
"""
from unittest.mock import patch

from src.services import supabase_helpers as helpers


def _patch_clients():
    """Return (rag_sentinel, app_sentinel) and patch the two client factories."""
    rag_sentinel = object()
    app_sentinel = object()
    return (
        rag_sentinel,
        app_sentinel,
        patch.object(helpers, "get_rag_supabase_client", return_value=rag_sentinel),
        patch.object(helpers, "get_supabase_client", return_value=app_sentinel),
    )


def test_rag_reads_use_ai_db_when_configured_even_if_flag_off(monkeypatch):
    """The incident case: RAG URL set, READS flag missing -> still AI DB."""
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.supabase.co")
    monkeypatch.delenv("RAG_DATABASE_READS_ENABLED", raising=False)
    helpers._RAG_FLAG_DRIFT_WARNED.clear()

    rag_sentinel, _app, p_rag, p_app = _patch_clients()
    with p_rag, p_app:
        assert helpers.get_rag_read_client() is rag_sentinel


def test_rag_writes_use_ai_db_when_configured_even_if_flag_off(monkeypatch):
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.supabase.co")
    monkeypatch.delenv("RAG_DATABASE_WRITES_ENABLED", raising=False)
    helpers._RAG_FLAG_DRIFT_WARNED.clear()

    rag_sentinel, _app, p_rag, p_app = _patch_clients()
    with p_rag, p_app:
        assert helpers.get_rag_write_client() is rag_sentinel


def test_rag_reads_use_ai_db_when_flag_on(monkeypatch):
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.supabase.co")
    monkeypatch.setenv("RAG_DATABASE_READS_ENABLED", "true")
    helpers._RAG_FLAG_DRIFT_WARNED.clear()

    rag_sentinel, _app, p_rag, p_app = _patch_clients()
    with p_rag, p_app:
        assert helpers.get_rag_read_client() is rag_sentinel


def test_falls_back_to_app_db_only_when_rag_unconfigured(monkeypatch):
    """Pre-migration/legacy deployments with no RAG URL keep using the PM APP DB."""
    monkeypatch.delenv("RAG_SUPABASE_URL", raising=False)
    monkeypatch.delenv("RAG_DATABASE_READS_ENABLED", raising=False)
    monkeypatch.delenv("RAG_DATABASE_WRITES_ENABLED", raising=False)
    helpers._RAG_FLAG_DRIFT_WARNED.clear()

    _rag, app_sentinel, p_rag, p_app = _patch_clients()
    with p_rag, p_app:
        assert helpers.get_rag_read_client() is app_sentinel
        assert helpers.get_rag_write_client() is app_sentinel


def test_flag_drift_warning_emitted_once(monkeypatch, caplog):
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.supabase.co")
    monkeypatch.delenv("RAG_DATABASE_READS_ENABLED", raising=False)
    helpers._RAG_FLAG_DRIFT_WARNED.clear()

    _rag, _app, p_rag, p_app = _patch_clients()
    with p_rag, p_app:
        with caplog.at_level("WARNING"):
            helpers.get_rag_read_client()
            helpers.get_rag_read_client()
    drift_warnings = [r for r in caplog.records if "RAG_DATABASE_READS_ENABLED" in r.getMessage()]
    assert len(drift_warnings) == 1
