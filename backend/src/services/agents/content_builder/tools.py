"""Runtime tools for the Alleato Deep Agents content builder."""

from __future__ import annotations

import os
import re
from pathlib import Path
from typing import Any, Literal

import httpx
from langchain_core.tools import tool


TAVILY_SEARCH_URL = "https://api.tavily.com/search"
_OUTPUT_ROOT = Path(os.getenv("CONTENT_BUILDER_OUTPUT_ROOT", "/tmp/alleato-content-builder"))


def set_output_root(path: Path) -> None:
    """Set the per-request output root used by image tools."""
    global _OUTPUT_ROOT
    _OUTPUT_ROOT = path


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _bounded_int(value: int, *, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))


def _safe_slug(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9._-]+", "-", value.strip()).strip("-")
    return slug[:100] or "content"


@tool
def web_search(
    query: str,
    max_results: int = 5,
    topic: Literal["general", "news"] = "general",
) -> dict[str, Any]:
    """Search the web for current information and return titled source results."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return {
            "error": (
                "WEB_SEARCH_UNAVAILABLE: TAVILY_API_KEY is not configured. "
                "Continue without external research and disclose that source gap."
            )
        }

    trimmed_query = _clean_text(query)
    if not trimmed_query:
        return {"error": "WEB_SEARCH_FAILED: query must not be blank."}

    payload = {
        "api_key": api_key,
        "query": trimmed_query,
        "max_results": _bounded_int(max_results, minimum=1, maximum=8),
        "topic": topic,
        "search_depth": "basic",
        "include_answer": False,
        "include_raw_content": False,
    }
    headers = {"Authorization": f"Bearer {api_key}"}
    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(TAVILY_SEARCH_URL, json=payload, headers=headers)
            response.raise_for_status()
            return response.json()
    except Exception as exc:
        return {"error": f"WEB_SEARCH_FAILED: {type(exc).__name__}: {exc}"}


def _save_gemini_image(prompt: str, output_path: Path) -> str:
    api_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
    if not api_key:
        return (
            "IMAGE_GENERATION_UNAVAILABLE: GOOGLE_API_KEY or GEMINI_API_KEY is "
            "not configured. Tell the caller the written content can still be used, "
            "but generated imagery is missing."
        )

    try:
        from google import genai
    except Exception as exc:
        return f"IMAGE_GENERATION_UNAVAILABLE: google-genai import failed: {exc}"

    try:
        client = genai.Client(api_key=api_key)
        response = client.models.generate_content(
            model=os.getenv("CONTENT_BUILDER_IMAGE_MODEL", "gemini-2.5-flash-image"),
            contents=[prompt],
        )
        parts = getattr(response, "parts", None) or []
        for part in parts:
            inline_data = getattr(part, "inline_data", None)
            if inline_data is None:
                continue
            image = part.as_image()
            output_path.parent.mkdir(parents=True, exist_ok=True)
            image.save(str(output_path))
            return f"Image saved to {output_path}"
        return "IMAGE_GENERATION_FAILED: Gemini returned no inline image data."
    except Exception as exc:
        return f"IMAGE_GENERATION_FAILED: {type(exc).__name__}: {exc}"


@tool
def generate_cover(prompt: str, slug: str) -> str:
    """Generate a cover image for a blog post and save it under blogs/<slug>/hero.png."""
    output_path = _OUTPUT_ROOT / "blogs" / _safe_slug(slug) / "hero.png"
    return _save_gemini_image(prompt, output_path)


@tool
def generate_social_image(prompt: str, platform: str, slug: str) -> str:
    """Generate an image for a social post and save it under <platform>/<slug>/image.png."""
    normalized_platform = _safe_slug(platform).lower()
    if normalized_platform not in {"linkedin", "tweets", "twitter", "x"}:
        normalized_platform = "linkedin"
    if normalized_platform in {"twitter", "x"}:
        normalized_platform = "tweets"
    output_path = _OUTPUT_ROOT / normalized_platform / _safe_slug(slug) / "image.png"
    return _save_gemini_image(prompt, output_path)


def content_builder_tools(*, include_images: bool) -> list[Any]:
    """Return tools for the content builder orchestrator."""
    tools: list[Any] = []
    if include_images:
        tools.extend([generate_cover, generate_social_image])
    return tools


def content_builder_research_tools() -> list[Any]:
    """Return tools available to the researcher subagent."""
    return [web_search]
