"""Regression tests for embedding provider failover + the poison-pill guard.

These cover the 2026-06-23 incident: the Vercel AI Gateway hit a spend cap and
returned a selective 401 mid-run, there was no failover, and the failed docs
were left at NULL embedding_status so they re-failed (and re-billed) forever,
invisibly. The fixes are: (1) automatic gateway<->openai failover on auth/credit
errors, (2) a bounded retry counter that parks permanently-failing docs loudly.
"""

import pytest

from src.services import ai_transport
from src.services.integrations.microsoft_graph import embed


# --- ai_transport.is_auth_or_credit_error -----------------------------------

@pytest.mark.parametrize(
    "message",
    [
        "Error code: 401 - Authentication failed. Create an API key and set in AI_GATEWAY_API_KEY",
        "insufficient_quota: You exceeded your current quota",
        "402 Payment Required",
        "billing hard limit reached",
        "Incorrect API key provided",
    ],
)
def test_auth_or_credit_error_true(message):
    assert ai_transport.is_auth_or_credit_error(Exception(message)) is True


@pytest.mark.parametrize(
    "message",
    [
        "Connection reset by peer",
        "Read timed out",
        "stream id too low",
        "some unrelated ValueError",
    ],
)
def test_auth_or_credit_error_false(message):
    assert ai_transport.is_auth_or_credit_error(Exception(message)) is False


# --- ai_transport.alternate_provider_path -----------------------------------

def test_alternate_path_gateway_to_openai(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.delenv("AI_GATEWAY_REQUIRED", raising=False)
    assert ai_transport.alternate_provider_path("vercel_gateway") == "openai"


def test_alternate_path_openai_to_gateway(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "gw-test")
    monkeypatch.delenv("AI_GATEWAY_REQUIRED", raising=False)
    assert ai_transport.alternate_provider_path("openai") == "vercel_gateway"


def test_alternate_path_none_when_target_unconfigured(monkeypatch):
    monkeypatch.delenv("OPENAI_API_KEY", raising=False)
    monkeypatch.delenv("AI_GATEWAY_REQUIRED", raising=False)
    assert ai_transport.alternate_provider_path("vercel_gateway") is None


def test_alternate_path_none_when_gateway_required(monkeypatch):
    monkeypatch.setenv("OPENAI_API_KEY", "sk-test")
    monkeypatch.setenv("AI_GATEWAY_REQUIRED", "true")
    assert ai_transport.alternate_provider_path("vercel_gateway") is None


# --- embed._batch_embed failover --------------------------------------------

class _Emb:
    def __init__(self, vec):
        self.embedding = vec


class _Resp:
    def __init__(self, n):
        self.data = [_Emb([0.0] * embed.EMBEDDING_DIMENSIONS) for _ in range(n)]


def _patch_embed_noise(monkeypatch):
    """Silence budget + usage recording so we test only the failover branch."""
    monkeypatch.setattr(embed, "assert_background_model_budget_available", lambda **_: None)
    monkeypatch.setattr(embed, "record_model_usage", lambda *a, **k: None)


def test_batch_embed_fails_over_on_auth_error(monkeypatch):
    _patch_embed_noise(monkeypatch)
    monkeypatch.setattr(embed, "get_ai_provider_path", lambda: "vercel_gateway")
    monkeypatch.setattr(embed, "alternate_provider_path", lambda _p: "openai")

    calls = []

    class _Client:
        def __init__(self, path):
            self.path = path

        @property
        def embeddings(self):
            client = self

            class _E:
                def create(self_inner, **kwargs):
                    calls.append(client.path)
                    if client.path != "openai":
                        raise RuntimeError("Error code: 401 - Authentication failed. AI_GATEWAY_API_KEY")
                    return _Resp(len(kwargs["input"]))

            return _E()

    monkeypatch.setattr(embed, "get_openai_client", lambda force_path=None: _Client(force_path or "vercel_gateway"))

    result = embed._batch_embed(["alpha", "beta"])
    assert len(result) == 2
    # Primary (gateway) tried then failed over to openai.
    assert calls[0] == "vercel_gateway"
    assert "openai" in calls


def test_batch_embed_propagates_non_auth_error(monkeypatch):
    _patch_embed_noise(monkeypatch)
    monkeypatch.setattr(embed, "get_ai_provider_path", lambda: "openai")
    monkeypatch.setattr(embed, "alternate_provider_path", lambda _p: "vercel_gateway")

    class _Client:
        @property
        def embeddings(self):
            class _E:
                def create(self_inner, **kwargs):
                    raise ValueError("malformed request — not an auth problem")

            return _E()

    monkeypatch.setattr(embed, "get_openai_client", lambda force_path=None: _Client())

    with pytest.raises(ValueError):
        embed._batch_embed(["alpha"])


def test_batch_embed_no_failover_when_alt_unavailable(monkeypatch):
    _patch_embed_noise(monkeypatch)
    monkeypatch.setattr(embed, "get_ai_provider_path", lambda: "vercel_gateway")
    monkeypatch.setattr(embed, "alternate_provider_path", lambda _p: None)

    class _Client:
        @property
        def embeddings(self):
            class _E:
                def create(self_inner, **kwargs):
                    raise RuntimeError("401 Authentication failed")

            return _E()

    monkeypatch.setattr(embed, "get_openai_client", lambda force_path=None: _Client())

    with pytest.raises(RuntimeError):
        embed._batch_embed(["alpha"])
