"""Model usage ledger and background budget guard for AI/RAG pipeline calls."""

from __future__ import annotations

import logging
import os
from dataclasses import dataclass
from datetime import datetime, timezone
from decimal import Decimal
from typing import Any, Mapping, Optional

from ..supabase_helpers import get_rag_read_client, get_rag_write_client

logger = logging.getLogger(__name__)

_MISSING_LEDGER_WARNED = False


class PipelineModelBudgetExceeded(RuntimeError):
    """Raised before an LLM/embedding call when the configured daily cap is spent."""


@dataclass(frozen=True)
class ModelUsageContext:
    stage: str
    operation: str
    source_system: Optional[str] = None
    source_item_id: Optional[str] = None
    project_id: Optional[int] = None
    metadata: Optional[Mapping[str, Any]] = None


def _env_decimal(name: str, default: str) -> Decimal:
    raw = os.getenv(name, default)
    try:
        return Decimal(str(raw))
    except Exception:
        logger.warning("[ModelUsage] Invalid decimal env %s=%r; using %s", name, raw, default)
        return Decimal(default)


# Standard OpenAI API rates per 1M tokens, reviewed 2026-06-17. Keep env
# overrides so pricing can be changed without a deploy.
_MODEL_PRICING_USD_PER_1M: dict[str, tuple[Decimal, Decimal, Decimal]] = {
    "gpt-5.5": (
        _env_decimal("OPENAI_PRICE_GPT_5_5_INPUT_PER_1M", "5.00"),
        _env_decimal("OPENAI_PRICE_GPT_5_5_CACHED_INPUT_PER_1M", "0.50"),
        _env_decimal("OPENAI_PRICE_GPT_5_5_OUTPUT_PER_1M", "30.00"),
    ),
    "gpt-5.5-mini": (
        _env_decimal("OPENAI_PRICE_GPT_5_5_MINI_INPUT_PER_1M", "1.00"),
        _env_decimal("OPENAI_PRICE_GPT_5_5_MINI_CACHED_INPUT_PER_1M", "0.10"),
        _env_decimal("OPENAI_PRICE_GPT_5_5_MINI_OUTPUT_PER_1M", "6.00"),
    ),
    "gpt-5.4": (
        _env_decimal("OPENAI_PRICE_GPT_5_4_INPUT_PER_1M", "2.50"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_CACHED_INPUT_PER_1M", "0.25"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_OUTPUT_PER_1M", "15.00"),
    ),
    "gpt-5.4-mini": (
        _env_decimal("OPENAI_PRICE_GPT_5_4_MINI_INPUT_PER_1M", "0.75"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_MINI_CACHED_INPUT_PER_1M", "0.075"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_MINI_OUTPUT_PER_1M", "4.50"),
    ),
    "gpt-5.4-nano": (
        _env_decimal("OPENAI_PRICE_GPT_5_4_NANO_INPUT_PER_1M", "0.20"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_NANO_CACHED_INPUT_PER_1M", "0.02"),
        _env_decimal("OPENAI_PRICE_GPT_5_4_NANO_OUTPUT_PER_1M", "1.25"),
    ),
    # The public pricing page does not expose embedding rows in the same table;
    # these defaults preserve the historical OpenAI embedding prices and can be
    # overridden if the provider changes them.
    "text-embedding-3-large": (
        _env_decimal("OPENAI_PRICE_TEXT_EMBEDDING_3_LARGE_INPUT_PER_1M", "0.13"),
        Decimal("0"),
        Decimal("0"),
    ),
    "text-embedding-3-small": (
        _env_decimal("OPENAI_PRICE_TEXT_EMBEDDING_3_SMALL_INPUT_PER_1M", "0.02"),
        Decimal("0"),
        Decimal("0"),
    ),
}


def _normalize_model(model: str) -> str:
    return (model or "").removeprefix("openai:").removeprefix("openai/").strip()


def _usage_field(usage: Any, name: str) -> int:
    if usage is None:
        return 0
    if isinstance(usage, Mapping):
        value = usage.get(name)
    else:
        value = getattr(usage, name, None)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def _cached_prompt_tokens(usage: Any) -> int:
    details = None
    if isinstance(usage, Mapping):
        details = usage.get("prompt_tokens_details")
    elif usage is not None:
        details = getattr(usage, "prompt_tokens_details", None)
    if details is None:
        return 0
    if isinstance(details, Mapping):
        value = details.get("cached_tokens")
    else:
        value = getattr(details, "cached_tokens", None)
    try:
        return int(value or 0)
    except (TypeError, ValueError):
        return 0


def extract_usage_counts(response: Any) -> dict[str, int]:
    usage = getattr(response, "usage", None)
    prompt_tokens = _usage_field(usage, "prompt_tokens")
    completion_tokens = _usage_field(usage, "completion_tokens")
    total_tokens = _usage_field(usage, "total_tokens") or (prompt_tokens + completion_tokens)
    cached_prompt_tokens = _cached_prompt_tokens(usage)
    return {
        "prompt_tokens": prompt_tokens,
        "cached_prompt_tokens": cached_prompt_tokens,
        "completion_tokens": completion_tokens,
        "total_tokens": total_tokens,
    }


def estimate_cost_usd(
    model: str,
    *,
    prompt_tokens: int = 0,
    cached_prompt_tokens: int = 0,
    completion_tokens: int = 0,
) -> Optional[Decimal]:
    normalized = _normalize_model(model)
    pricing = _MODEL_PRICING_USD_PER_1M.get(normalized)
    if not pricing:
        return None
    input_rate, cached_input_rate, output_rate = pricing
    uncached_prompt = max(prompt_tokens - cached_prompt_tokens, 0)
    cost = (
        Decimal(uncached_prompt) * input_rate
        + Decimal(cached_prompt_tokens) * cached_input_rate
        + Decimal(completion_tokens) * output_rate
    ) / Decimal(1_000_000)
    return cost.quantize(Decimal("0.000001"))


def _daily_budget_usd() -> Optional[Decimal]:
    raw = os.getenv("PIPELINE_DAILY_MODEL_BUDGET_USD")
    if raw is None or raw.strip() == "":
        return None
    try:
        value = Decimal(raw)
    except Exception:
        logger.warning("[ModelUsage] Invalid PIPELINE_DAILY_MODEL_BUDGET_USD=%r; budget disabled", raw)
        return None
    return value if value > 0 else None


def _utc_today() -> str:
    return datetime.now(timezone.utc).date().isoformat()


def _today_estimated_spend_usd() -> Decimal:
    total = Decimal("0")
    page_size = 1000
    start = 0
    client = get_rag_read_client()
    while True:
        response = (
            client.table("pipeline_model_usage")
            .select("estimated_cost_usd")
            .eq("usage_date", _utc_today())
            .range(start, start + page_size - 1)
            .execute()
        )
        rows = response.data or []
        for row in rows:
            value = row.get("estimated_cost_usd")
            if value is not None:
                total += Decimal(str(value))
        if len(rows) < page_size:
            break
        start += page_size
    return total


def assert_background_model_budget_available(
    *,
    stage: str,
    operation: str,
    model: str,
) -> None:
    """Fail before provider spend when the configured daily background cap is hit."""

    budget = _daily_budget_usd()
    if budget is None:
        return
    try:
        spent = _today_estimated_spend_usd()
    except Exception as exc:
        logger.warning("[ModelUsage] Could not read usage ledger for budget check: %s", exc)
        return
    if spent < budget:
        return
    record_model_usage(
        ModelUsageContext(stage=stage, operation=operation),
        model=model,
        status="budget_blocked",
        error_code="daily_budget_exceeded",
        error_message=f"Daily model budget reached: spent ${spent} of ${budget}.",
    )
    raise PipelineModelBudgetExceeded(
        f"PIPELINE_DAILY_MODEL_BUDGET_USD reached for {stage}/{operation}: "
        f"spent ${spent} of ${budget}."
    )


def record_model_usage(
    context: ModelUsageContext,
    *,
    model: str,
    provider: str = "openai",
    response: Any = None,
    status: str = "succeeded",
    input_items: int = 0,
    output_items: int = 0,
    error_code: Optional[str] = None,
    error_message: Optional[str] = None,
    metadata: Optional[Mapping[str, Any]] = None,
) -> None:
    """Best-effort RAG-side usage ledger write. Never hide the primary result."""

    global _MISSING_LEDGER_WARNED
    usage_counts = extract_usage_counts(response)
    estimated_cost = estimate_cost_usd(
        model,
        prompt_tokens=usage_counts["prompt_tokens"],
        cached_prompt_tokens=usage_counts["cached_prompt_tokens"],
        completion_tokens=usage_counts["completion_tokens"],
    )
    merged_metadata: dict[str, Any] = dict(context.metadata or {})
    merged_metadata.update(metadata or {})
    payload: dict[str, Any] = {
        "provider": provider,
        "model": _normalize_model(model),
        "stage": context.stage,
        "operation": context.operation,
        "source_system": context.source_system,
        "source_item_id": context.source_item_id,
        "project_id": context.project_id,
        "status": status,
        "prompt_tokens": usage_counts["prompt_tokens"],
        "cached_prompt_tokens": usage_counts["cached_prompt_tokens"],
        "completion_tokens": usage_counts["completion_tokens"],
        "total_tokens": usage_counts["total_tokens"],
        "input_items": input_items,
        "output_items": output_items,
        "estimated_cost_usd": str(estimated_cost) if estimated_cost is not None else None,
        "error_code": error_code,
        "error_message": error_message[:1000] if error_message else None,
        "metadata": merged_metadata,
    }
    try:
        get_rag_write_client().table("pipeline_model_usage").insert(payload).execute()
    except Exception as exc:
        if not _MISSING_LEDGER_WARNED:
            _MISSING_LEDGER_WARNED = True
            logger.warning("[ModelUsage] Could not write pipeline_model_usage row: %s", exc)
