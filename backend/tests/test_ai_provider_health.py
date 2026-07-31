"""Regression tests for backend AI provider health runway checks."""

from src.services.health import ai_provider_health


class _Response:
    def __init__(self, status_code, payload):
        self.status_code = status_code
        self._payload = payload

    def json(self):
        return self._payload


class _ProviderError(Exception):
    """Stand-in for an openai.APIStatusError with a status_code + body."""

    def __init__(self, status_code, body, message=""):
        super().__init__(message or str(body))
        self.status_code = status_code
        self.body = body


def test_classify_402_payment_required_is_low_credits():
    # The real production outage: AI Gateway balance exhausted -> HTTP 402.
    exc = _ProviderError(
        402,
        {"error": {"message": "Payment Required", "type": "invalid_request_error"}},
    )

    verdict = ai_provider_health._classify_exception(exc)

    assert verdict == {"reason": "low_credits", "http_status": 402}


def test_classify_403_model_not_found_is_model_access_not_outage():
    # The misleading alert: probe model not enabled on the key's project.
    exc = _ProviderError(
        403,
        {
            "error": {
                "message": "Project `proj_x` does not have access to model `gpt-4o-mini`",
                "type": "invalid_request_error",
                "code": "model_not_found",
            }
        },
    )

    verdict = ai_provider_health._classify_exception(exc)

    assert verdict == {"reason": "model_access", "http_status": 403}
    # And it must NOT be confused with a real provider-down reason.
    assert verdict["reason"] not in {"insufficient_quota", "auth", "rate_limit"}


def test_generic_403_is_not_model_access_and_still_pages():
    # A 403 that is NOT model_not_found (suspended account, org block, IP
    # allowlist) is a REAL outage — it must fall through to a paging reason,
    # never be softened to the non-paging model_access.
    exc = _ProviderError(
        403,
        {
            "error": {
                "message": "Your account has been suspended for policy violations",
                "type": "permission_error",
            }
        },
    )

    verdict = ai_provider_health._classify_exception(exc)

    assert verdict["reason"] == "unknown"
    assert verdict["reason"] != "model_access"


def test_model_access_has_a_dedicated_alert_message():
    assert "model_access" in ai_provider_health._REASON_MESSAGE
    assert "canary" in ai_provider_health._REASON_MESSAGE["model_access"].lower()


def test_classify_400_bad_probe_request_is_probe_error_not_outage():
    # Gateway rejects max_output_tokens < 16 with a 400 — a canary bug, not an outage.
    exc = _ProviderError(
        400,
        {
            "error": {
                "message": "Invalid 'max_output_tokens': integer below minimum value. "
                "Expected a value >= 16, but got 1 instead.",
                "type": "AI_APICallError",
            }
        },
    )

    verdict = ai_provider_health._classify_exception(exc)

    assert verdict == {"reason": "probe_error", "http_status": 400}
    assert verdict["reason"] not in {"insufficient_quota", "auth", "rate_limit", "low_credits"}


def test_probe_max_tokens_meets_gateway_floor():
    # The gateway rejects max_output_tokens < 16; the probe must not trip that.
    assert ai_provider_health.AI_PROVIDER_HEALTH_MAX_TOKENS >= 16


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
