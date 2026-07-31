from __future__ import annotations

import logging
import os
import time
from typing import Callable, Optional, TypeVar

import httpx

T = TypeVar("T")

logger = logging.getLogger(__name__)

AI_GATEWAY_BASE_URL = os.getenv("AI_GATEWAY_BASE_URL", "https://ai-gateway.vercel.sh/v1")

_TRANSIENT_MESSAGE_SNIPPETS = (
    "streamidtoolowerror",
    "stream id too low",
    "server disconnected",
    "connectionterminated",
    "connection terminated",
    "remoteprotocolerror",
    "connection reset",
    "temporarily unavailable",
    "timed out",
    "timeout",
    "econnreset",
    "broken pipe",
    "503",
    "502",
    "429",
)


def is_transient_ai_error_message(message: str) -> bool:
    normalized = str(message or "").lower()
    return any(snippet in normalized for snippet in _TRANSIENT_MESSAGE_SNIPPETS)


def is_transient_ai_error(exc: Exception) -> bool:
    if isinstance(
        exc,
        (
            httpx.TimeoutException,
            httpx.NetworkError,
            httpx.ProtocolError,
            httpx.RemoteProtocolError,
        ),
    ):
        return True

    return is_transient_ai_error_message(str(exc))


_AUTH_CREDIT_MESSAGE_SNIPPETS = (
    "authentication failed",
    "incorrect api key",
    "invalid api key",
    "ai_gateway_api_key",
    "insufficient_quota",
    "insufficient quota",
    "exceeded your current quota",
    "credit",
    "billing",
    "payment required",
    "402",
    "401",
    "403",
)


def is_auth_or_credit_error(exc: Exception) -> bool:
    """True for provider failures a *different* provider could satisfy.

    Auth (401/403), quota/credit/billing (402, insufficient_quota), and the
    Vercel AI Gateway's selective "set AI_GATEWAY_API_KEY" 401 it returns when a
    spend cap is hit mid-run. These are NOT transient — retrying the same
    provider will fail identically — but the *alternate* provider (direct OpenAI
    vs. gateway) is usually healthy, so they are the trigger for failover.
    """
    status = getattr(exc, "status_code", None) or getattr(exc, "code", None)
    if status in {401, 402, 403, 429} or str(status) in {"401", "402", "403"}:
        return True
    normalized = str(exc or "").lower()
    return any(snippet in normalized for snippet in _AUTH_CREDIT_MESSAGE_SNIPPETS)


def ai_gateway_required() -> bool:
    return (os.getenv("AI_GATEWAY_REQUIRED") or "").strip().lower() in {
        "1",
        "true",
        "yes",
        "on",
    }


def get_ai_provider_path() -> str:
    if ai_gateway_required():
        return "vercel_gateway"

    explicit_path = (os.getenv("AI_PROVIDER_PATH") or "").strip().lower()
    if explicit_path in {"openai", "direct", "direct_openai"}:
        return "openai"
    if explicit_path in {"vercel_gateway", "ai_gateway", "gateway", "vercel"}:
        return "vercel_gateway"
    if explicit_path:
        raise RuntimeError(
            f"Unsupported AI_PROVIDER_PATH '{explicit_path}'. Use 'openai' or 'vercel_gateway'."
        )
    return "vercel_gateway" if os.getenv("AI_GATEWAY_API_KEY") else "openai"


def ai_gateway_configured() -> bool:
    return bool((os.getenv("AI_GATEWAY_API_KEY") or "").strip())


def openai_configured() -> bool:
    return bool((os.getenv("OPENAI_API_KEY") or "").strip())


def embedding_provider_configured() -> bool:
    provider_path = get_ai_provider_path()
    if provider_path == "vercel_gateway":
        return ai_gateway_configured()
    return openai_configured()


def alternate_provider_path(provider_path: str) -> Optional[str]:
    """Return the other provider path if it is configured and usable.

    Failover only makes sense when the gateway is NOT mandatory (AI_GATEWAY_REQUIRED)
    and the alternate provider actually has credentials. Returns None otherwise.
    """
    if ai_gateway_required():
        return None
    if provider_path == "vercel_gateway":
        return "openai" if openai_configured() else None
    if provider_path == "openai":
        return "vercel_gateway" if ai_gateway_configured() else None
    return None


# Reuse one OpenAI client (and its httpx connection pool) per
# (provider_path, api_key, base_url). Constructing a fresh client on every
# embedding/LLM call opened a new connection pool each time and never closed it,
# leaking sockets/file descriptors under load — which surfaced as
# `httpx.ReadError/WriteError: [Errno 35] Resource temporarily unavailable`
# (EAGAIN) and stale-connection RemoteProtocolError during heavy Fireflies/Graph
# embedding batches. Keying on api_key means a rotated key still yields a fresh
# client rather than reusing a stale one.
_CLIENT_CACHE: dict[tuple[str, str, str], object] = {}


def get_openai_client(force_path: Optional[str] = None):
    """Return an OpenAI-compatible client for the configured backend provider.

    Vercel AI Gateway is preferred when AI_GATEWAY_API_KEY is present. Direct
    OpenAI is only used when explicitly selected or no gateway key is available.

    Pass ``force_path`` ('openai' | 'vercel_gateway') to bypass the configured
    routing — used by embedding failover to reach the healthy provider when the
    primary one has hit an auth/credit wall.

    The client is cached and reused so concurrent callers share one bounded
    connection pool instead of leaking a new pool per call.
    """
    from openai import OpenAI

    provider_path = force_path or get_ai_provider_path()
    if provider_path == "vercel_gateway":
        api_key = (os.getenv("AI_GATEWAY_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError(
                "AI_GATEWAY_API_KEY is required when AI_PROVIDER_PATH=vercel_gateway."
            )
        base_url = AI_GATEWAY_BASE_URL
    else:
        api_key = (os.getenv("OPENAI_API_KEY") or "").strip()
        if not api_key:
            raise RuntimeError(
                "OPENAI_API_KEY is required when AI_PROVIDER_PATH=openai or AI_GATEWAY_API_KEY is unavailable."
            )
        base_url = ""

    cache_key = (provider_path, api_key, base_url)
    client = _CLIENT_CACHE.get(cache_key)
    if client is None:
        client = (
            OpenAI(api_key=api_key, base_url=base_url)
            if base_url
            else OpenAI(api_key=api_key)
        )
        _CLIENT_CACHE[cache_key] = client
    return client


def retry_ai_call(
    fn: Callable[[], T],
    *,
    provider_name: str,
    operation: str,
    max_retries: int = 2,
    base_delay_seconds: float = 1.0,
) -> T:
    attempt = 0
    while True:
        try:
            return fn()
        except Exception as exc:
            if attempt >= max_retries or not is_transient_ai_error(exc):
                raise

            delay = base_delay_seconds * (2**attempt)
            logger.warning(
                "[AITransport] %s transient failure via %s (attempt %d/%d): %s. Retrying in %.1fs",
                operation,
                provider_name,
                attempt + 1,
                max_retries + 1,
                exc,
                delay,
            )
            time.sleep(delay)
            attempt += 1
