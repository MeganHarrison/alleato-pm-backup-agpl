from decimal import Decimal
from types import SimpleNamespace

import pytest

from src.services.pipeline import document_parser, llm, model_usage
from src.services.pipeline.model_usage import ModelUsageContext, PipelineModelBudgetExceeded
from src.services.intelligence import client as intelligence_client


def test_generic_document_enrichment_is_disabled_by_default(monkeypatch):
    monkeypatch.delenv("PIPELINE_DOCUMENT_LLM_ENRICHMENT_ENABLED", raising=False)
    monkeypatch.setattr(
        document_parser.llm,
        "_call_llm",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("generic document parsing must not call the LLM by default")
        ),
    )

    segments = document_parser._segment_document_window(
        "[0] Scope item\n[1] Required submittal", "Scope.pdf"
    )
    summary = document_parser._generate_document_summary(
        "First paragraph of the source document.\n\nSecond paragraph.", "Scope.pdf"
    )

    assert len(segments) == 1
    assert summary.startswith("First paragraph")


def test_signal_budget_blocks_before_global_budget(monkeypatch):
    recorded = []
    monkeypatch.setenv("PIPELINE_DAILY_SIGNAL_BUDGET_USD", "2.00")
    monkeypatch.setenv("PIPELINE_DAILY_MODEL_BUDGET_USD", "10.00")
    monkeypatch.setattr(
        model_usage, "_today_estimated_spend_for_bucket_usd", lambda _bucket: Decimal("2.00")
    )
    monkeypatch.setattr(model_usage, "_today_estimated_spend_usd", lambda: Decimal("2.00"))
    monkeypatch.setattr(
        model_usage, "record_model_usage", lambda context, **kwargs: recorded.append((context, kwargs))
    )

    with pytest.raises(PipelineModelBudgetExceeded, match="PIPELINE_DAILY_SIGNAL_BUDGET_USD"):
        model_usage.assert_background_model_budget_available(
            stage="signals_extracted",
            operation="document_summary",
            model="gpt-5.4-mini",
            budget_bucket="signal",
            usage_context=ModelUsageContext(
                stage="signals_extracted",
                operation="document_summary",
                source_system="sharepoint",
                source_item_id="drive-item-42",
            ),
        )

    assert recorded[0][0].budget_bucket == "signal"
    assert recorded[0][0].source_system == "sharepoint"
    assert recorded[0][0].source_item_id == "drive-item-42"
    assert recorded[0][1]["error_code"] == "daily_signal_budget_exceeded"


def test_scoped_signal_call_is_source_attributed_and_completion_bounded(monkeypatch):
    calls = []
    recorded = []
    monkeypatch.setenv("PIPELINE_SIGNAL_COMPLETION_MAX_TOKENS", "321")
    monkeypatch.setattr(llm, "assert_background_model_budget_available", lambda **_kwargs: None)
    monkeypatch.setattr(
        llm,
        "retry_ai_call",
        lambda callback, **_kwargs: callback(),
    )
    monkeypatch.setattr(
        llm,
        "record_model_usage",
        lambda context, **kwargs: recorded.append((context, kwargs)),
    )

    class _Client:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    calls.append(kwargs)
                    return SimpleNamespace(
                        choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))],
                        usage=SimpleNamespace(
                            prompt_tokens=1,
                            completion_tokens=1,
                            total_tokens=2,
                        ),
                    )

    monkeypatch.setattr(llm, "_client", lambda: _Client())
    context = ModelUsageContext(
        stage="signals_extracted",
        operation="unused",
        source_system="sharepoint",
        source_item_id="drive-item-42",
        project_id=42,
    )

    with llm.model_usage_scope(context):
        llm._call_llm("extract this", json_mode=True, operation="document_summary")

    assert calls[0]["max_tokens"] == 321
    assert recorded[0][0].operation == "document_summary"
    assert recorded[0][0].source_system == "sharepoint"
    assert recorded[0][0].source_item_id == "drive-item-42"
    assert recorded[0][0].budget_bucket == "signal"


def test_invalid_signal_completion_limit_falls_back_in_intelligence_client(monkeypatch):
    calls = []
    monkeypatch.setenv("PIPELINE_SIGNAL_COMPLETION_MAX_TOKENS", "not-a-number")
    monkeypatch.setattr(
        intelligence_client,
        "assert_background_model_budget_available",
        lambda **_kwargs: None,
    )
    monkeypatch.setattr(intelligence_client, "record_model_usage", lambda *_args, **_kwargs: None)

    class _Client:
        class chat:
            class completions:
                @staticmethod
                def create(**kwargs):
                    calls.append(kwargs)
                    return SimpleNamespace(
                        choices=[SimpleNamespace(message=SimpleNamespace(content="{}"))],
                        usage=SimpleNamespace(
                            prompt_tokens=1,
                            completion_tokens=1,
                            total_tokens=2,
                        ),
                    )

    monkeypatch.setattr(intelligence_client, "_client", lambda: _Client())
    result = intelligence_client.extract_with_retry(
        [{"role": "user", "content": "extract"}],
        model="gpt-5.4-mini",
        max_retries=0,
        usage_context=ModelUsageContext(
            stage="signals_extracted",
            operation="deep_meeting_signal_extraction",
            budget_bucket="signal",
        ),
    )

    assert result["_extraction_failed"] is False
    assert calls[0]["max_tokens"] == 1200
