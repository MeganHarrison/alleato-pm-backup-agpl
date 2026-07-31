"""Regression tests for the cached OpenAI client in ai_transport.

Constructing a fresh client on every embedding/LLM call leaked a new httpx
connection pool each time and never closed it, exhausting sockets/file
descriptors under load (httpx ReadError/WriteError: [Errno 35] Resource
temporarily unavailable). The client must be reused per (provider, key).
"""
import sys
import types
from unittest.mock import MagicMock, patch

import pytest

from services import ai_transport


@pytest.fixture(autouse=True)
def _clear_cache_and_stub_openai(monkeypatch):
    ai_transport._CLIENT_CACHE.clear()
    constructed = {"count": 0}

    def _fake_openai(**kwargs):
        constructed["count"] += 1
        client = MagicMock(name=f"OpenAIClient#{constructed['count']}")
        client._kwargs = kwargs
        return client

    fake_module = types.ModuleType("openai")
    fake_module.OpenAI = _fake_openai
    monkeypatch.setitem(sys.modules, "openai", fake_module)
    yield constructed
    ai_transport._CLIENT_CACHE.clear()


def test_reuses_client_for_same_provider_and_key(_clear_cache_and_stub_openai, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER_PATH", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-stable")

    first = ai_transport.get_openai_client()
    second = ai_transport.get_openai_client()

    assert first is second, "client must be reused, not rebuilt per call"
    assert _clear_cache_and_stub_openai["count"] == 1


def test_rotated_key_builds_a_fresh_client(_clear_cache_and_stub_openai, monkeypatch):
    monkeypatch.setenv("AI_PROVIDER_PATH", "openai")
    monkeypatch.setenv("OPENAI_API_KEY", "sk-old")
    old = ai_transport.get_openai_client()

    monkeypatch.setenv("OPENAI_API_KEY", "sk-new")
    new = ai_transport.get_openai_client()

    assert old is not new, "a rotated key must not reuse the stale client"
    assert _clear_cache_and_stub_openai["count"] == 2
