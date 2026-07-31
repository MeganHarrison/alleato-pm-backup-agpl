"""Shared helpers for Alleato-hosted Deep Agents runtimes."""

from __future__ import annotations

import os
from typing import Any


def extract_agent_text(result: Any) -> str:
    if isinstance(result, dict):
        messages = result.get("messages")
        if isinstance(messages, list) and messages:
            last = messages[-1]
            content = getattr(last, "content", None)
            if content is None and isinstance(last, dict):
                content = last.get("content")
            if isinstance(content, str):
                return content.strip()
        for key in ("output", "content", "text"):
            value = result.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
    content = getattr(result, "content", None)
    if isinstance(content, str):
        return content.strip()
    return str(result or "").strip()


def _openai_model_name(model: str, *, gateway: bool) -> str:
    normalized = model.strip()
    if normalized.startswith("openai:"):
        normalized = normalized.split(":", 1)[1]
    if gateway:
        return normalized if normalized.startswith("openai/") else f"openai/{normalized}"
    return normalized.split("/", 1)[1] if normalized.startswith("openai/") else normalized


def _preflight_enabled() -> bool:
    return os.getenv("APP_DB_PREFLIGHT_ENABLED", "true").strip().lower() in {"1", "true", "yes", "on"}


def app_db_degraded_banner_if_unreachable(*, source: str) -> str | None:
    """Pre-flight app-DB probe for deep-agent runtimes.

    Runs one fast `SELECT 1` before the agent is invoked. If the app database is
    unreachable, fires a deduped Sentry/log alert and returns a degraded-mode
    banner the caller must prepend to the answer — so the user gets a loud
    "database unreachable" notice instead of a confident answer built with none
    of the structured project data. Returns None when the DB is reachable or the
    probe is disabled (`APP_DB_PREFLIGHT_ENABLED=false`). Never raises.
    """
    if not _preflight_enabled():
        return None
    # No DATABASE_URL configured at all is a distinct condition (surfaced by the
    # startup parity check and /health host-parity as "missing"); the pre-flight
    # banner is specifically for a *configured but unreachable* database.
    if not os.getenv("DATABASE_URL"):
        return None
    try:
        from src.services.agents.alleato_ai_tools.db_health import (
            degraded_db_banner,
            emit_db_connectivity_alert,
            probe_app_db,
        )

        probe = probe_app_db()
        if probe.reachable:
            return None
        emit_db_connectivity_alert(source=source, probe=probe)
        return degraded_db_banner(probe)
    except Exception:  # noqa: BLE001 — a broken probe must never block a run
        return None


def resolve_deep_agents_model(model: Any) -> Any:
    if not isinstance(model, str):
        return model

    from src.services.ai_transport import AI_GATEWAY_BASE_URL, get_ai_provider_path

    provider_path = get_ai_provider_path()
    if provider_path == "vercel_gateway":
        api_key = (os.getenv("AI_GATEWAY_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError(
                "AI_GATEWAY_API_KEY is required for the configured Vercel AI Gateway provider."
            )
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=_openai_model_name(model, gateway=True),
            api_key=api_key,
            base_url=AI_GATEWAY_BASE_URL,
            timeout=45,
            max_retries=1,
        )

    openai_key = (os.getenv("OPENAI_API_KEY") or "").strip()
    if openai_key:
        from langchain_openai import ChatOpenAI

        return ChatOpenAI(
            model=_openai_model_name(model, gateway=False),
            api_key=openai_key,
            timeout=45,
            max_retries=1,
        )
    return model
