"""Alleato-hosted LangChain docs Deep Agents runtime."""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Optional
from uuid import uuid4

from src.services.agents.runtime_common import (
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)
from src.services.agents.docs_research_agent.contracts import (
    DocsResearchRequest,
    DocsResearchResponse,
    DocsResearchSource,
    DocsResearchTraceItem,
)
from src.services.agents.docs_research_agent.tools import (
    DEFAULT_DOCS_MCP_URL,
    docs_research_tools,
    extract_doc_urls,
)


ORCHESTRATOR_NAME = "alleato-docs-mcp-research-orchestrator"
RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"
OUTPUT_BASE_DIR = Path(os.getenv("DOCS_RESEARCH_OUTPUT_ROOT", "/tmp/alleato-docs-research"))


class _TestBackend:
    def __init__(self, workspace: Path):
        self.cwd = workspace


def _provider_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))


def _workspace_for(request: DocsResearchRequest) -> Path:
    safe_user = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in request.user_id)[:60]
    safe_session = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (request.session_id or ""))[:60]
    return OUTPUT_BASE_DIR / safe_user / (safe_session or uuid4().hex[:12])


def _prepare_workspace(workspace: Path) -> None:
    workspace.mkdir(parents=True, exist_ok=True)
    source = RUNTIME_DIR / "AGENTS.md"
    target = workspace / "AGENTS.md"
    if source.exists() and not target.exists():
        shutil.copyfile(source, target)


def _backend(workspace: Path, *, allow_fallback: bool = False) -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=workspace, virtual_mode=True)
    except Exception as exc:
        if allow_fallback:
            return _TestBackend(workspace)
        raise RuntimeError(f"Deep Agents filesystem backend unavailable: {exc}") from exc


def _agent_config(request: DocsResearchRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"docs-research:{request.user_id}"
    return {"configurable": {"thread_id": thread_id, "user_id": request.user_id}}


def _prompt(request: DocsResearchRequest) -> str:
    return (
        f"Docs question:\n{request.question}\n\n"
        f"Use at most {request.max_docs} docs search results unless the answer would be materially incomplete.\n\n"
        "Required workflow:\n"
        "1. Read the packaged AGENTS.md instructions.\n"
        "2. Use docs_mcp_search before answering.\n"
        "3. Cite documentation URLs or page titles found by the docs tool.\n"
        "4. If docs_mcp_search is unavailable or incomplete, say exactly which capability failed and label any inference.\n"
        "5. Return a concise technical answer with practical code/config guidance when useful."
    )


def _sources(answer: str) -> list[DocsResearchSource]:
    return [DocsResearchSource(title=url, url=url) for url in extract_doc_urls(answer)]


def run_docs_research_agent(
    request: DocsResearchRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "openai:gpt-5.4-mini",
) -> DocsResearchResponse:
    """Run the packaged docs MCP Deep Agent and return a typed response."""
    started = time.perf_counter()
    workspace = _workspace_for(request)
    docs_server = os.getenv("LANGCHAIN_DOCS_MCP_URL", DEFAULT_DOCS_MCP_URL)
    try:
        _prepare_workspace(workspace)

        if create_agent is None:
            if not _provider_available():
                raise RuntimeError("OPENAI_API_KEY or ANTHROPIC_API_KEY is required for docs research.")
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        kwargs: dict[str, Any] = {
            "name": ORCHESTRATOR_NAME,
            "model": model,
            "memory": [str(workspace / "AGENTS.md")],
            "tools": docs_research_tools(),
            "backend": _backend(workspace, allow_fallback=create_agent is not None),
            "system_prompt": (
                "You are Alleato's docs-first LangChain/Deep Agents research runtime. "
                "Use the docs MCP search tool before answering. Fail loudly when MCP, "
                "provider calls, or documentation evidence are unavailable."
            ),
        }
        agent = create_agent(**kwargs)
        result = agent.invoke(
            {"messages": [{"role": "user", "content": _prompt(request)}]},
            config=_agent_config(request),
        )
        answer = _extract_agent_text(result)
        if not answer:
            raise RuntimeError("Deep Agents docs research runtime returned an empty response.")

        return DocsResearchResponse(
            answer=answer,
            mode="deep_agents",
            sources=_sources(answer),
            toolTrace=[
                DocsResearchTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="docs_mcp_research_runtime",
                    status="success",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=f"Docs server: {docs_server}",
                )
            ],
            orchestrator=ORCHESTRATOR_NAME,
            docsServer=docs_server,
        )
    except Exception as exc:
        return DocsResearchResponse(
            answer=(
                "The LangChain docs research agent could not complete this request. "
                f"Failed capability: docs_mcp_research_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            sources=[],
            toolTrace=[
                DocsResearchTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="docs_mcp_research_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            orchestrator=ORCHESTRATOR_NAME,
            docsServer=docs_server,
        )
