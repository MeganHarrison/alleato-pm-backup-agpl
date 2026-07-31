"""Research tools for the Alleato Deep Agents research endpoint."""

from __future__ import annotations

import os
import re
from typing import Any
from urllib.parse import urlparse

import httpx
from bs4 import BeautifulSoup
from langchain_core.tools import tool


TAVILY_SEARCH_URL = "https://api.tavily.com/search"


def _clean_text(value: str) -> str:
    return re.sub(r"\s+", " ", value).strip()


def _bounded_int(value: int, *, minimum: int, maximum: int) -> int:
    return max(minimum, min(maximum, int(value)))


@tool
def web_search(query: str, max_results: int = 5) -> str:
    """Search the public web and return titled results with source URLs."""
    api_key = os.getenv("TAVILY_API_KEY")
    if not api_key:
        return (
            "WEB_SEARCH_UNAVAILABLE: TAVILY_API_KEY is not configured for the "
            "backend runtime. Continue with Alleato internal tools if useful, "
            "and tell the user external web search is unavailable."
        )

    trimmed_query = _clean_text(query)
    if not trimmed_query:
        return "WEB_SEARCH_FAILED: query must not be blank."

    limit = _bounded_int(max_results, minimum=1, maximum=8)
    payload = {
        "api_key": api_key,
        "query": trimmed_query,
        "search_depth": "basic",
        "max_results": limit,
        "include_answer": False,
        "include_raw_content": False,
    }
    headers = {"Authorization": f"Bearer {api_key}"}

    try:
        with httpx.Client(timeout=20) as client:
            response = client.post(TAVILY_SEARCH_URL, json=payload, headers=headers)
            response.raise_for_status()
            data = response.json()
    except Exception as exc:
        return f"WEB_SEARCH_FAILED: {type(exc).__name__}: {exc}"

    results = data.get("results")
    if not isinstance(results, list) or not results:
        return f"WEB_SEARCH_NO_RESULTS: No public web results found for '{trimmed_query}'."

    lines = [f"Web search results for: {trimmed_query}"]
    for index, item in enumerate(results[:limit], start=1):
        if not isinstance(item, dict):
            continue
        title = _clean_text(str(item.get("title") or "Untitled result"))
        url = _clean_text(str(item.get("url") or ""))
        snippet = _clean_text(str(item.get("content") or item.get("snippet") or ""))
        lines.append(f"{index}. {title}\nURL: {url}\nSnippet: {snippet}")
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
