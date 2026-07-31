"""Research tools for the Alleato Deep Agents research endpoint."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from langchain_core.tools import tool


TAVILY_SEARCH_URL = "https://api.tavily.com/search"


@dataclass(frozen=True)
class PublicWebSearchResult:
    """Structured Tavily result shared by research and deterministic jobs."""

    title: str
    url: str
    snippet: str
    raw_content: str
    score: float


class PublicWebSearchError(RuntimeError):
    """Named public-web search failure safe to surface to backend callers."""


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _bounded_int(value: int, *, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))


def search_public_web(
    query: str,
    max_results: int = 5,
    *,
    search_depth: str = "basic",
    include_raw_content: bool = False,
) -> list[PublicWebSearchResult]:
    """Return structured Tavily results or raise a named capability failure."""

    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        raise PublicWebSearchError(
            "WEB_SEARCH_UNAVAILABLE: TAVILY_API_KEY is not configured for the backend runtime."
        )

    trimmed_query = _clean_text(query)
    if not trimmed_query:
        raise PublicWebSearchError("WEB_SEARCH_FAILED: query must not be blank.")

    normalized_depth = search_depth.strip().lower()
    if normalized_depth not in {"basic", "advanced"}:
        raise PublicWebSearchError(
            f"WEB_SEARCH_FAILED: unsupported search depth '{search_depth}'."
        )

    limit = _bounded_int(max_results, minimum=1, maximum=8)
    payload = {
        "api_key": api_key,
        "query": trimmed_query,
        "search_depth": normalized_depth,
        "max_results": limit,
        "include_answer": False,
        "include_raw_content": include_raw_content,
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(TAVILY_SEARCH_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        raise PublicWebSearchError(
            f"WEB_SEARCH_FAILED: {type(exc).__name__}: {exc}"
        ) from exc

    raw_results = data.get("results")
    if not isinstance(raw_results, list) or not raw_results:
        raise PublicWebSearchError(
            f"WEB_SEARCH_NO_RESULTS: No public web results found for '{trimmed_query}'."
        )

    results: list[PublicWebSearchResult] = []
    for item in raw_results[:limit]:
        if not isinstance(item, dict):
            continue
        url = _clean_text(str(item.get("url") or ""))
        if not url:
            continue
        try:
            score = float(item.get("score") or 0)
        except (TypeError, ValueError):
            score = 0
        results.append(
            PublicWebSearchResult(
                title=_clean_text(str(item.get("title") or "Untitled result")),
                url=url,
                snippet=_clean_text(
                    str(item.get("content") or item.get("snippet") or "")
                ),
                raw_content=_clean_text(str(item.get("raw_content") or "")),
                score=max(0.0, min(1.0, score)),
            )
        )

    if not results:
        raise PublicWebSearchError(
            f"WEB_SEARCH_NO_RESULTS: Tavily returned no usable URLs for '{trimmed_query}'."
        )
    return results


@tool
def web_search(query: str, max_results: int = 5) -> str:
    """Search the public web and return titled results with source URLs."""
    try:
        results = search_public_web(query, max_results)
    except PublicWebSearchError as exc:
        return str(exc)

    lines = [f"Web search results for: {_clean_text(query)}"]
    for index, item in enumerate(results, start=1):
        lines.append(
            f"{index}. {item.title}\nURL: {item.url}\nSnippet: {item.snippet}"
        )
    return "\n\n".join(lines)


@tool
def fetch_url(url: str, max_chars: int = 6000) -> str:
    """Fetch a public web page and return readable text for citation review."""
    parsed = urlparse(url.strip())
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        return "FETCH_URL_FAILED: URL must be absolute and use http or https."

    limit = _bounded_int(max_chars, minimum=500, maximum=12000)
    try:
        with httpx.Client(
            timeout=20,
            follow_redirects=True,
            headers={"User-Agent": "AlleatoResearchAgent/1.0"},
        ) as client:
            response = client.get(url)
            response.raise_for_status()
    except Exception as exc:
        return f"FETCH_URL_FAILED: {type(exc).__name__}: {exc}"

    content_type = response.headers.get("content-type", "")
    if "text" not in content_type and "html" not in content_type and not response.text:
        return f"FETCH_URL_FAILED: unsupported content type '{content_type}'."

    soup = BeautifulSoup(response.text, "html.parser")
    for tag in soup(["script", "style", "noscript", "svg"]):
        tag.decompose()
    title = _clean_text(soup.title.get_text(" ")) if soup.title else url
    body = _clean_text(soup.get_text(" "))
    if not body:
        return f"FETCH_URL_NO_TEXT: No readable page text found for {url}."
    return f"Title: {title}\nURL: {url}\nContent:\n{body[:limit]}"


def web_research_tools() -> list[Any]:
    """Return public-web research tools."""
    return [web_search, fetch_url]
