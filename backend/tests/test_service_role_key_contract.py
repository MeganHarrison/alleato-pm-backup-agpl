from pathlib import Path

import pytest

from src.services import supabase_helpers


def test_app_client_rejects_the_retired_service_key_alias(monkeypatch):
    monkeypatch.setenv("SUPABASE_URL", "https://app.example.supabase.co")
    monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("SUPABASE_SERVICE_KEY", "retired-key")
    supabase_helpers.get_supabase_client.cache_clear()

    with pytest.raises(RuntimeError, match="SUPABASE_SERVICE_ROLE_KEY"):
        supabase_helpers.get_supabase_client()


def test_rag_client_rejects_the_retired_service_key_alias(monkeypatch):
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.example.supabase.co")
    monkeypatch.delenv("RAG_SUPABASE_SERVICE_ROLE_KEY", raising=False)
    monkeypatch.setenv("RAG_SUPABASE_SERVICE_KEY", "retired-key")
    supabase_helpers.get_rag_supabase_client.cache_clear()

    with pytest.raises(RuntimeError, match="RAG_SUPABASE_SERVICE_ROLE_KEY"):
        supabase_helpers.get_rag_supabase_client()


def test_runtime_source_has_no_retired_service_key_aliases():
    backend_root = Path(__file__).resolve().parents[1]
    retired_names = ("SUPABASE_SERVICE" + "_KEY", "RAG_SUPABASE_SERVICE" + "_KEY")
    runtime_files = [
        path
        for path in backend_root.rglob("*.py")
        if "tests" not in path.parts and "__pycache__" not in path.parts
    ]

    offenders = [
        str(path.relative_to(backend_root))
        for path in runtime_files
        if any(name in path.read_text() for name in retired_names)
    ]

    assert offenders == []
