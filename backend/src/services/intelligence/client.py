"""LLM client helpers for Teams conversation intelligence compilation."""

from __future__ import annotations

import json
import logging
import os
from typing import Any, Dict, List

from openai import OpenAI

from ..pipeline.config import MODEL_PROJECT_INTELLIGENCE, MODEL_SIGNAL_EXTRACTION
from ..pipeline.model_usage import (
    ModelUsageContext,
    PipelineModelBudgetExceeded,
    assert_background_model_budget_available,
    record_model_usage,
    signal_completion_limit,
)
from ..ai_transport import get_ai_provider_path

logger = logging.getLogger(__name__)

# Project-intelligence synthesis uses the frontier tier; source-by-source
# extraction uses the cheaper tier to protect background-model budgets.
COMPILER_REQUEST_TIMEOUT_SECONDS = int(os.getenv("TEAMS_COMPILER_REQUEST_TIMEOUT_SECONDS", "60"))

# Default sampling temperature for extraction. The gpt-5 family (and o-series
# reasoning models) reject any non-default temperature with HTTP 400
# ("Only the default (1) value is supported"), which the retry wrapper would
# otherwise swallow into a silent _extraction_failed. For those models we omit
# the param entirely; for everything else we keep the low-variance default.
COMPILER_TEMPERATURE = float(os.getenv("TEAMS_COMPILER_TEMPERATURE", "0.2"))


def _supports_custom_temperature(model: str) -> bool:
    """False for models that only accept the default temperature (gpt-5*, o1*, o3*)."""
    m = (model or "").lower()
    # Strip a leading "openai/" (or other provider) prefix used via the gateway.
    m = m.split("/", 1)[-1]
    return not (m.startswith("gpt-5") or m.startswith("o1") or m.startswith("o3") or m.startswith("o4"))


def _is_response_format_rejected(exc: Exception) -> bool:
    message = str(exc).lower()
    return (
        "response_format" in message
        and (
            "invalid input" in message
            or "invalid_request_error" in message
            or "unsupported" in message
        )
    )


def _client() -> OpenAI:
    from ..ai_transport import get_openai_client
    return get_openai_client()


def _failed_extraction(errors: List[str]) -> Dict[str, Any]:
    return {
        "overview": "",
        "conversation_topic": "",
        "confidence": 0,
        "insights": [],
        "tasks": [],
        "risks": [],
        "decisions": [],
        "sentiment": None,
        "initiative_signals": [],
        "_extraction_failed": True,
        "_errors": errors,
    }


def extract_with_retry(
    messages: List[Dict[str, Any]],
    model: str = MODEL_PROJECT_INTELLIGENCE,
    max_retries: int = 2,
    timeout: int | None = None,
    usage_context: ModelUsageContext | None = None,
) -> Dict[str, Any]:
    """
    Call LLM with JSON mode across configured providers.

    AI Gateway does not support response_format=json_object, so JSON is enforced
    through the prompt on that provider. This function never raises; callers get a
    valid dict with _extraction_failed=True after provider exhaustion.

    ``timeout`` overrides the per-request timeout (seconds). Large full-transcript
    passes need far more than the Teams-compiler default; callers pass their own.
    """
    request_timeout = timeout if timeout is not None else COMPILER_REQUEST_TIMEOUT_SECONDS
    context = usage_context or ModelUsageContext(stage="intelligence", operation="extract_with_retry")
    for attempt in range(max_retries + 1):
        try:
            assert_background_model_budget_available(
                stage=context.stage,
                operation=context.operation,
                model=model,
                budget_bucket=context.budget_bucket,
                usage_context=context,
            )
            kwargs: Dict[str, Any] = {
                "model": model,
                "messages": messages,
                "timeout": request_timeout,
                "response_format": {"type": "json_object"},
            }
            if context.budget_bucket == "signal":
                kwargs["max_tokens"] = signal_completion_limit()
            # Only send temperature to models that accept a non-default value;
            # gpt-5/o-series reject it with a 400 that would silently fail extraction.
            if _supports_custom_temperature(model):
                kwargs["temperature"] = COMPILER_TEMPERATURE
            try:
                response = _client().chat.completions.create(**kwargs)
            except Exception as exc:
                if not _is_response_format_rejected(exc):
                    raise
                logger.warning(
                    "[TeamsCompiler] %s rejected response_format=json_object; retrying once with prompt-only JSON contract.",
                    model,
                )
                fallback_kwargs = dict(kwargs)
                fallback_kwargs.pop("response_format", None)
                response = _client().chat.completions.create(**fallback_kwargs)
            record_model_usage(
                context,
                model=model,
                provider=get_ai_provider_path(),
                response=response,
                status="succeeded",
            )
            raw = response.choices[0].message.content or ""
            raw = raw.strip()
            if raw.startswith("```"):
                raw = raw.split("\n", 1)[-1].rsplit("```", 1)[0].strip()
            parsed = json.loads(raw)
            if not isinstance(parsed, dict):
                raise json.JSONDecodeError("top-level JSON value is not an object", raw, 0)
            parsed.setdefault("_extraction_failed", False)
            return parsed
        except json.JSONDecodeError as exc:
            logger.warning("[TeamsCompiler] JSON parse failure (attempt=%d): %s", attempt, exc)
            if attempt == max_retries:
                record_model_usage(
                    context,
                    model=model,
                    status="failed",
                    error_code="json_parse_failed",
                    error_message=str(exc),
                )
                return _failed_extraction([f"JSON parse failed after {max_retries + 1} attempts"])
        except PipelineModelBudgetExceeded as exc:
            logger.error("[TeamsCompiler] Model budget blocked call: %s", exc)
            return _failed_extraction([str(exc)])
        except Exception as exc:
            logger.error("[TeamsCompiler] OpenAI call failed: %s", exc)
            record_model_usage(
                context,
                model=model,
                status="failed",
                error_code=exc.__class__.__name__,
                error_message=str(exc),
            )
            return _failed_extraction([str(exc)])

    return _failed_extraction(["max retries exceeded"])
