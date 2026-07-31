"""Regression tests for backend AI provider health runway checks."""

from src.services.health import ai_provider_health


class _Response:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


def test_ai_gateway_credit_floor_fails_when_balance_is_below_hard_floor(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "test-gateway-key")
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_MIN_CREDITS_USD", 1.0)
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_WARN_CREDITS_USD", 5.0)
    monkeypatch.setattr(
        ai_provider_health.httpx,
        "get",
        lambda *_args, **_kwargs: _Response(200, {"balance": "0.82", "total_used": "30.17"}),
    )

    result = ai_provider_health._check_ai_gateway_credit_floor()

    assert result["status"] == "down"
    assert result["reason"] == "low_credits"
    assert result["http_status"] == 402
    assert result["gateway_credits"] == {
        "balance": 0.82,
        "total_used": "30.17",
        "floor": 1.0,
        "warning_floor": 5.0,
    }
    assert "below the hard floor" in result["detail"]


def test_ai_gateway_credit_floor_warns_without_failing(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "test-gateway-key")
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_MIN_CREDITS_USD", 1.0)
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_WARN_CREDITS_USD", 5.0)
    monkeypatch.setattr(
        ai_provider_health.httpx,
        "get",
        lambda *_args, **_kwargs: _Response(200, {"balance": "4.82", "total_used": "30.17"}),
    )

    result = ai_provider_health._check_ai_gateway_credit_floor()

    assert result["status"] == "ok"
    assert result["gateway_credits"] == {
        "balance": 4.82,
        "total_used": "30.17",
        "floor": 1.0,
        "warning_floor": 5.0,
    }
    assert result["warnings"] == [
        "AI Gateway credits are below the warning floor: balance=$4.8200, warning=$5.00"
    ]


def test_ai_gateway_credit_floor_passes_when_balance_is_healthy(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "test-gateway-key")
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_MIN_CREDITS_USD", 1.0)
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_WARN_CREDITS_USD", 5.0)
    monkeypatch.setattr(
        ai_provider_health.httpx,
        "get",
        lambda *_args, **_kwargs: _Response(200, {"balance": "8.50", "total_used": "31.50"}),
    )

    result = ai_provider_health._check_ai_gateway_credit_floor()

    assert result == {
        "status": "ok",
        "gateway_credits": {
            "balance": 8.5,
            "total_used": "31.50",
            "floor": 1.0,
            "warning_floor": 5.0,
        },
        "warnings": [],
    }


def test_ai_gateway_credit_floor_fails_when_probe_is_unreadable(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "test-gateway-key")
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_MIN_CREDITS_USD", 1.0)
    monkeypatch.setattr(ai_provider_health, "AI_GATEWAY_WARN_CREDITS_USD", 5.0)
    monkeypatch.setattr(
        ai_provider_health.httpx,
        "get",
        lambda *_args, **_kwargs: _Response(200, {"unexpected": "shape"}),
    )

    result = ai_provider_health._check_ai_gateway_credit_floor()

    assert result["status"] == "down"
    assert result["reason"] == "credit_probe_failed"
    assert result["http_status"] == 200
    assert "malformed payload" in result["detail"]


def test_ai_gateway_credit_floor_fails_when_gateway_rejects_probe(monkeypatch):
    monkeypatch.setenv("AI_GATEWAY_API_KEY", "test-gateway-key")
    monkeypatch.setattr(
        ai_provider_health.httpx,
        "get",
        lambda *_args, **_kwargs: _Response(
            401,
            {"error": {"message": "invalid AI Gateway key"}},
        ),
    )

    result = ai_provider_health._check_ai_gateway_credit_floor()

    assert result["status"] == "down"
    assert result["reason"] == "credit_probe_failed"
    assert result["http_status"] == 401
    assert result["detail"] == "invalid AI Gateway key"
