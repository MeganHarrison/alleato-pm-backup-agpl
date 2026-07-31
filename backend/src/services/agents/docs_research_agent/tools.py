"""MCP docs tools for the LangChain docs research agent."""

from __future__ import annotations

import os
import re
from typing import Any

from langchain_core.tools import tool


DEFAULT_DOCS_MCP_URL = "https://docs.langchain.com/mcp"
URL_RE = re.compile(r"https?://[^\s)\]>,]+")


def _clean_text(value: object) -> str:
    return re.sub(r"\s+", " ", str(value)).strip()


def _content_to_text(content: object) -> str:
    if isinstance(content, str):
        return content
    if isinstance(content, list):
        chunks: list[str] = []
        for item in content:
            text = getattr(item, "text", None)
            if isinstance(text, str):
                chunks.append(text)
                continue
            if isinstance(item, dict):
                maybe_text = item.get("text") or item.get("content")
                if isinstance(maybe_text, str):
                    chunks.append(maybe_text)
        return "\n".join(chunks)
    return str(content)


async def _call_docs_mcp(query: str, max_results: int, server_url: str) -> str:
    from mcp import ClientSession
    from mcp.client.streamable_http import streamablehttp_client

    async with streamablehttp_client(server_url, timeout=20) as (read_stream, write_stream, _):
        async with ClientSession(read_stream, write_stream) as session:
            await session.initialize()
            tool_result = await session.list_tools()
            tools = list(getattr(tool_result, "tools", []) or [])
            if not tools:
                return "MCP_DOCS_NO_TOOLS: docs MCP server returned no tools."

            preferred = [
                item
                for item in tools
                if any(token in getattr(item, "name", "").lower() for token in ("search", "query", "docs"))
            ]
            selected = preferred[0] if preferred else tools[0]
            tool_name = getattr(selected, "name", "")
            if not tool_name:
                return "MCP_DOCS_NO_TOOLS: docs MCP tool name was missing."

            candidate_payloads = (
                {"query": query, "max_results": max_results},
                {"query": query, "limit": max_results},
                {"q": query, "limit": max_results},
                {"query": query},
            )
            last_error: Exception | None = None
            for payload in candidate_payloads:
                try:
                    result = await session.call_tool(tool_name, payload)
                    text = _content_to_text(getattr(result, "content", result)).strip()
                    if text:
                        return f"Docs MCP tool: {tool_name}\n{text}"
                    return f"MCP_DOCS_EMPTY_RESULT: {tool_name} returned no text."
                except Exception as exc:  # pragma: no cover - exercised against live MCP
                    last_error = exc
            return f"MCP_DOCS_FAILED: {type(last_error).__name__}: {last_error}"


@tool
def docs_mcp_search(query: str, max_results: int = 5) -> str:
    """Search the LangChain docs MCP server and return grounded documentation results."""
    trimmed_query = _clean_text(query)
    if not trimmed_query:
        return "MCP_DOCS_FAILED: query must not be blank."

    server_url = os.getenv("LANGCHAIN_DOCS_MCP_URL", DEFAULT_DOCS_MCP_URL)
    try:
        import anyio

        return anyio.run(_call_docs_mcp, trimmed_query, max(1, min(8, int(max_results))), server_url)
    except Exception as exc:
        return (
            "MCP_DOCS_UNAVAILABLE: LangChain docs MCP search failed. "
            f"Server: {server_url}. Detail: {type(exc).__name__}: {exc}"
        )


def docs_research_tools() -> list[Any]:
    """Return docs research tools."""
    return [docs_mcp_search]


def extract_doc_urls(answer: str) -> list[str]:
    """Extract unique documentation URLs from an answer."""
    seen: set[str] = set()
    urls: list[str] = []
    for raw_url in URL_RE.findall(answer):
        url = raw_url.rstrip(".,;:")
        if url in seen:
            continue
        seen.add(url)
        urls.append(url)
    return urls
