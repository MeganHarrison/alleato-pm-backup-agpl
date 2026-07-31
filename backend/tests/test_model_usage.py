from decimal import Decimal

import pytest

from src.services.pipeline import model_usage


class _Result:
    data = []


class _BrokenTable:
    def select(self, *_args):
        return self

    def eq(self, *_args):
        return self

    def range(self, *_args):
        return self

    def execute(self):
        raise RuntimeError("ledger unavailable")


class _BrokenClient:
    def table(self, _name):
        return _BrokenTable()


class _InsertTable:
    def __init__(self, rows):
        self.rows = rows

    def insert(self, payload):
        self.rows.append(payload)
        return self

    def execute(self):
        return _Result()


class _InsertClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, _name):
        return _InsertTable(self.rows)


def test_budget_ledger_failure_fails_closed(monkeypatch):
    monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", "10")
    monkeypatch.delenv("PIPELINE_BUDGET_FAIL_OPEN", raising=False)
    monkeypatch.setattr(model_usage, "get_rag_read_client", lambda: _BrokenClient())

    with pytest.raises(model_usage.PipelineModelBudgetUnavailable, match="usage ledger"):
        model_usage.assert_background_model_budget_available(
            stage="test",
            operation="test_call",
            model="gpt-5.4-mini",
        )


def test_invalid_budget_fails_closed(monkeypatch):
    monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", "not-money")

    with pytest.raises(model_usage.PipelineModelBudgetUnavailable, match="invalid"):
        model_usage.assert_background_model_budget_available(
            stage="test",
            operation="test_call",
            model="gpt-5.4-mini",
        )


@pytest.mark.parametrize("configured_budget", [None, ""])
def test_required_budget_cannot_be_missing_or_blank(monkeypatch, configured_budget):
    monkeypatch.setenv("PIPELINE_BUDGET_REQUIRED", "true")
    if configured_budget is None:
        monkeypatch.delenv("PIPELINE_DAILY_MODEL_BUDGET_USD", raising=False)
    else:
        monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", configured_budget)

    with pytest.raises(model_usage.PipelineModelBudgetUnavailable, match="required"):
        model_usage.assert_background_model_budget_available(
            stage="test",
            operation="test_call",
            model="gpt-5.4-mini",
        )


@pytest.mark.parametrize("configured_budget", ["0", "-1"])
def test_non_positive_budget_fails_closed(monkeypatch, configured_budget):
    monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", configured_budget)

    with pytest.raises(model_usage.PipelineModelBudgetUnavailable, match="greater than zero"):
        model_usage.assert_background_model_budget_available(
            stage="test",
            operation="test_call",
            model="gpt-5.4-mini",
        )


def test_unpriced_model_fails_closed_when_budgeted(monkeypatch):
    monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", "10")

    with pytest.raises(model_usage.PipelineModelBudgetUnavailable, match="no governed price"):
        model_usage.assert_background_model_budget_available(
            stage="test",
            operation="test_call",
            model="unknown-expensive-model",
        )


def test_usage_records_actual_provider_and_runtime_owner(monkeypatch):
    rows = []
    monkeypatch.setattr(model_usage, "get_rag_write_client", lambda: _InsertClient(rows))
    monkeypatch.setenv("AI_GATEWAY_REQUIRED", "true")
    monkeypatch.setenv("RENDER_SERVICE_NAME", "alleato-backend")
    monkeypatch.setenv("RENDER_SERVICE_ID", "srv-test")

    model_usage.record_model_usage(
        model_usage.ModelUsageContext(stage="test", operation="provider_attribution"),
        model="gpt-5.4-mini",
    )

    assert rows[0]["provider"] == "vercel_gateway"
    assert rows[0]["metadata"]["render_service_name"] == "alleato-backend"
    assert rows[0]["metadata"]["render_service_id"] == "srv-test"


def test_known_model_cost_is_estimated():
    assert model_usage.estimate_cost_usd(
        "openai/gpt-5.4-mini",
        prompt_tokens=1_000_000,
    ) == Decimal("0.750000")
