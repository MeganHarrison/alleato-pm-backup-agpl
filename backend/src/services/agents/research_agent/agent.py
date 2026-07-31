"""Alleato Deep Agents research runtime."""

from __future__ import annotations

import os
import re
import time
from pathlib import Path
from typing import Any, Callable, Optional

from src.services.agents.alleato_ai_tools import (
    READ_ONLY_PM_TOOLS,
    RESOLVERS,
    search_emails,
    search_meeting_transcripts,
    search_teams_messages,
    search_unstructured,
    think_tool,
)
from src.services.agents.alleato_ai_tools.subagents import ALL_SUBAGENTS
from src.services.agents.runtime_common import (
    app_db_degraded_banner_if_unreachable as _app_db_degraded_banner_if_unreachable,
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)
from src.services.agents.research_agent.contracts import (
    ResearchRequest,
    ResearchResponse,
    ResearchSource,
    ResearchTraceItem,
)
from src.services.agents.research_agent.tools import web_research_tools


URL_RE = re.compile(r"https?://[^\s)\]>,]+")
ORCHESTRATOR_NAME = "alleato-research-orchestrator"


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / ".agents" / "skills").exists() or (parent / "backend").exists():
            return parent
    return Path.cwd()


def _skill_roots() -> list[str]:
    roots: list[str] = []
    packaged_skills = Path(__file__).resolve().parent / "skills"
    if (packaged_skills / "web-research" / "SKILL.md").exists():
        roots.append(str(packaged_skills))

    for base in (_repo_root(), Path.cwd(), Path.cwd().parent):
        skill_root = base / ".agents" / "skills"
        if (skill_root / "web-research" / "SKILL.md").exists() and str(skill_root) not in roots:
            roots.append(str(skill_root))
    return roots


def _skills_loaded(skill_roots: list[str]) -> list[str]:
    loaded: list[str] = []
    for root in skill_roots:
        for name in ("web-research", "deep-agents-core"):
            if (Path(root) / name / "SKILL.md").exists() and name not in loaded:
                loaded.append(name)
    return loaded


def _research_backend() -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=str(_repo_root()), virtual_mode=True)
    except Exception:
        return None


def _deep_agents_memory_enabled() -> bool:
    return os.getenv("DEEP_AGENTS_MEMORY_ENABLED", "").strip().lower() == "true"


def _memory_middleware() -> list[Any]:
    if not _deep_agents_memory_enabled():
        return []
    try:
        from src.services.agents.memory import DbMemoryMiddleware

        return [DbMemoryMiddleware()]
    except Exception:
        return []


def _agent_config(request: ResearchRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"research:{request.user_id}"
    configurable: dict[str, Any] = {
        "thread_id": thread_id,
        "user_id": request.user_id,
    }
    if request.project_id is not None:
        configurable["project_id"] = request.project_id
    return {"configurable": configurable}


def _invoke_agent(agent: Any, payload: dict[str, Any], config: dict[str, Any]) -> Any:
    try:
        return agent.invoke(payload, config=config)
    except TypeError as exc:
        if "config" not in str(exc):
            raise
        return agent.invoke(payload)


def _research_prompt(request: ResearchRequest) -> str:
    scope = "No project ID was provided."
    if request.project_id:
        scope = f"Project ID supplied by caller: {request.project_id}."

    return (
        f"Research question:\n{request.question}\n\n"
        f"{scope}\n"
        f"Search budget: use at most {request.max_searches} public web searches unless a clear gap remains.\n\n"
        "Required workflow:\n"
        "1. Make a concise research plan before searching.\n"
        "2. Use Alleato internal tools for company/project context when the question mentions Alleato data, projects, "
        "vendors, contracts, cost codes, meetings, emails, Teams, or recent activity.\n"
        "3. Use web_search and fetch_url for current public facts. Cite URLs inline.\n"
        "4. Separate what is known from Alleato internal sources from what came from public web sources.\n"
        "5. If a tool says it is unavailable or failed, say exactly what capability was unavailable and continue with "
        "the remaining tools.\n"
        "6. Do not claim that emails, Teams posts, RFIs, tasks, commitments, change events, or database writes were "
        "sent or created. This endpoint is research-only."
    )


def _extract_sources(answer: str) -> list[ResearchSource]:
    seen: set[str] = set()
    sources: list[ResearchSource] = []
    for raw_url in URL_RE.findall(answer):
        url = raw_url.rstrip(".,;:")
        if url in seen:
            continue
        seen.add(url)
        sources.append(ResearchSource(title=url, url=url, sourceType="web"))
    return sources


def _subagents() -> list[dict[str, Any]]:
    web_tools = web_research_tools()
    internal_tools = [
        *RESOLVERS,
        search_unstructured,
        search_meeting_transcripts,
        search_emails,
        search_teams_messages,
        think_tool,
    ]
    return [
        {
            "name": "web_researcher",
            "description": "Research current public web sources and return citations with URLs.",
            "system_prompt": (
                "You are the public web research subagent. Build a small search plan, use web_search/fetch_url, "
                "and return concise findings with source URLs. Do not invent citations."
            ),
            "tools": web_tools,
        },
        {
            "name": "alleato_internal_researcher",
            "description": "Research Alleato PM, RAG, email, Teams, meetings, project, vendor, and contract context.",
            "system_prompt": (
                "You are the Alleato internal research subagent. Use only read-only internal tools. "
                "Call out missing, stale, or unavailable evidence instead of guessing."
            ),
            "tools": internal_tools,
        },
        *ALL_SUBAGENTS,
    ]


def _tools() -> list[Any]:
    return [*web_research_tools(), *READ_ONLY_PM_TOOLS]


def run_research_agent(
    request: ResearchRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "openai:gpt-5.5",
) -> ResearchResponse:
    """Run the Alleato research Deep Agent and return a typed response."""
    started = time.perf_counter()
    skill_roots = _skill_roots()
    loaded_skills = _skills_loaded(skill_roots)
    # Pre-flight: if the app DB is unreachable, every structured PM tool
    # (portfolio_overview, recent_activity, resolvers) will silently fail. Detect
    # it up front so the answer carries a loud degraded-mode banner instead of a
    # confident "no project data" built with none of the structured evidence.
    db_degraded_banner = _app_db_degraded_banner_if_unreachable(source="research_agent")
    try:
        if create_agent is None:
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        kwargs: dict[str, Any] = {
            "name": ORCHESTRATOR_NAME,
            "model": model,
            "tools": _tools(),
            "system_prompt": (
                "You are Alleato's research agent running inside the Render FastAPI backend. "
                "Use Deep Agents planning, delegation, filesystem, and available skills for multi-step research. "
                "Always cite public web claims with URLs. Always label Alleato internal evidence separately. "
                "Fail loudly: if credits, API keys, provider calls, search tools, or internal tools fail, include the "
                "specific failed capability and what evidence is therefore missing. Never produce a blank answer."
            ),
            "subagents": _subagents(),
        }
        backend = _research_backend()
        if backend is not None:
            kwargs["backend"] = backend
        if skill_roots:
            kwargs["skills"] = skill_roots

        middleware = _memory_middleware()
        if middleware:
            from src.services.agents.memory import build_memory_tools

            kwargs["tools"] = [
                *kwargs["tools"],
                *build_memory_tools(user_id=request.user_id, project_id=request.project_id),
            ]
            kwargs["middleware"] = middleware

        agent = create_agent(**kwargs)
        result = _invoke_agent(
            agent,
            {"messages": [{"role": "user", "content": _research_prompt(request)}]},
            _agent_config(request),
        )
        answer = _extract_agent_text(result)
        if not answer:
            raise RuntimeError("Deep Agents research runtime returned an empty response.")

        if db_degraded_banner:
            answer = db_degraded_banner + "\n" + answer

        trace: list[ResearchTraceItem] = [
            ResearchTraceItem(
                agent=ORCHESTRATOR_NAME,
                tool="deepagents_research_runtime",
                status="degraded" if db_degraded_banner else "success",
                durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                detail=(
                    "App database unreachable — structured PM tools were degraded; "
                    "answer carries a degraded-mode banner."
                    if db_degraded_banner
                    else (
                        "Deep Agents research runtime produced an answer"
                        + (" with durable memory." if middleware else ".")
                    )
                ),
            )
        ]

        return ResearchResponse(
            answer=answer,
            mode="deep_agents_degraded" if db_degraded_banner else "deep_agents",
            sources=_extract_sources(answer),
            toolTrace=trace,
            skillsLoaded=loaded_skills,
            orchestrator=ORCHESTRATOR_NAME,
        )
    except Exception as exc:
        return ResearchResponse(
            answer=(
                "The Alleato research agent could not complete this request. "
                f"Failed capability: deepagents_research_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            sources=[],
            toolTrace=[
                ResearchTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_research_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            skillsLoaded=loaded_skills,
            orchestrator=ORCHESTRATOR_NAME,
        )
