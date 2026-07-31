"""Sentry initialization for the FastAPI backend."""
from __future__ import annotations

import logging
import os
from typing import Any

logger = logging.getLogger(__name__)


def _env_flag(name: str, default: bool = False) -> bool:
    value = os.getenv(name)
    if value is None:
        return default
    return value.strip().lower() in {"1", "true", "yes", "on"}


def _parse_sample_rate(name: str, default: float) -> float:
    raw = os.getenv(name)
    if not raw:
        return default

    try:
        parsed = float(raw)
    except ValueError:
        logger.warning("[Sentry] Invalid %s=%r; using %.2f", name, raw, default)
        return default

    if 0 <= parsed <= 1:
        return parsed

    logger.warning("[Sentry] Invalid %s=%r; using %.2f", name, raw, default)
    return default


def _environment() -> str:
    return (
        os.getenv("SENTRY_ENVIRONMENT")
        or os.getenv("RENDER_SERVICE_TYPE")
        or os.getenv("ENVIRONMENT")
        or "production"
    )


def _is_deployed_runtime() -> bool:
    return bool(os.getenv("RENDER") or os.getenv("RENDER_SERVICE_ID"))


def _traces_sampler(sampling_context: dict[str, Any]) -> float:
    parent_sampled = sampling_context.get("parent_sampled")
    if parent_sampled is not None:
        return 1.0 if parent_sampled else 0.0

    transaction_context = sampling_context.get("transaction_context") or {}
    name = str(transaction_context.get("name") or "")
    op = str(transaction_context.get("op") or "")

    if name in {"/health", "GET /health"} or name.endswith(" /health"):
        return 0.0

    default_rate = _parse_sample_rate(
        "SENTRY_TRACES_SAMPLE_RATE",
        0.1 if _environment() == "production" else 1.0,
    )
    if op == "http.server":
        return default_rate
    if op == "task":
        return min(default_rate, 0.1)
    return min(default_rate, 0.05)


def init_sentry() -> bool:
    """Initialize Sentry if a backend DSN is configured."""
    dsn = os.getenv("SENTRY_BACKEND_DSN") or os.getenv("SENTRY_DSN")
    if not dsn:
        if _is_deployed_runtime():
            logger.warning(
                "[Sentry] SENTRY_BACKEND_DSN/SENTRY_DSN is not set; backend errors will not be reported to Sentry."
            )
        return False

    try:
        import sentry_sdk
    except ImportError as exc:
        raise RuntimeError(
            "SENTRY_BACKEND_DSN/SENTRY_DSN is set but sentry-sdk is not installed. "
            "Install backend requirements before starting the backend."
        ) from exc

    sentry_sdk.init(
        dsn=dsn,
        environment=_environment(),
        release=os.getenv("SENTRY_RELEASE") or os.getenv("RENDER_GIT_COMMIT"),
        send_default_pii=_env_flag("SENTRY_SEND_DEFAULT_PII"),
        enable_logs=True,
        traces_sampler=_traces_sampler,
        profile_session_sample_rate=_parse_sample_rate(
            "SENTRY_PROFILE_SESSION_SAMPLE_RATE",
            0.0,
        ),
        profile_lifecycle="trace",
        _experiments={"suppress_asgi_chained_exceptions": False},
    )
    logger.info("[Sentry] Backend Sentry initialized environment=%s", _environment())
    return True
