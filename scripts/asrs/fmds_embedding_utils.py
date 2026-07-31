"""Shared FMDS embedding and chunk-splitting utilities without PDF dependencies."""

from __future__ import annotations

import os
from typing import Any, Iterable, Sequence

from openai import OpenAI


def required_env(name: str) -> str:
    value = os.environ.get(name)
    if not value:
        raise RuntimeError(f"Missing required environment variable: {name}")
    return value


def batches(values: Sequence[Any], size: int) -> Iterable[Sequence[Any]]:
    if size <= 0:
        raise ValueError("Batch size must be positive")
    for start in range(0, len(values), size):
        yield values[start : start + size]


def split_long_text(text: str, max_chars: int) -> list[str]:
    if len(text) <= max_chars:
        return [text]
    pieces: list[str] = []
    remaining = text
    while len(remaining) > max_chars:
        split_at = remaining.rfind("\n", 0, max_chars)
        if split_at < max_chars // 2:
            split_at = remaining.rfind(". ", 0, max_chars)
            if split_at >= 0:
                split_at += 1
        if split_at < max_chars // 2:
            split_at = max_chars
        pieces.append(remaining[:split_at].strip())
        remaining = remaining[split_at:].strip()
    if remaining:
        pieces.append(remaining)
    return pieces


def embedding_client() -> tuple[OpenAI, str, str]:
    provider_path = os.environ.get("AI_PROVIDER_PATH", "").strip().lower()
    if provider_path in {"vercel_gateway", "ai_gateway", "vercel"}:
        provider_path = "gateway"
    if provider_path == "openai":
        direct_key = required_env("OPENAI_API_KEY")
        model = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
        return OpenAI(api_key=direct_key), model, "openai"
    if provider_path not in ("", "gateway"):
        raise RuntimeError(
            "Unsupported AI_PROVIDER_PATH "
            f"{provider_path!r}; expected 'vercel_gateway' or 'openai'"
        )
    gateway_key = os.environ.get("AI_GATEWAY_API_KEY")
    if gateway_key:
        base_url = os.environ.get("AI_GATEWAY_BASE_URL", "https://ai-gateway.vercel.sh/v1")
        model = os.environ.get("AI_GATEWAY_EMBEDDING_MODEL", "openai/text-embedding-3-large")
        return OpenAI(api_key=gateway_key, base_url=base_url), model, "ai-gateway"
    direct_key = required_env("OPENAI_API_KEY")
    model = os.environ.get("OPENAI_EMBEDDING_MODEL", "text-embedding-3-large")
    return OpenAI(api_key=direct_key), model, "openai"