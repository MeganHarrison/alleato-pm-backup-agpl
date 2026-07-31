"""Alleato App Expert Deep Agents runtime."""

from __future__ import annotations

import re
import time
from pathlib import Path
from typing import Any, Callable, Optional

from src.services.agents.app_expert.contracts import (
    AppExpertRequest,
    AppExpertResponse,
    AppExpertSource,
    AppExpertTraceItem,
)
from src.services.agents.app_expert.tools import app_expert_tools
from src.services.agents.runtime_common import (
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)


ORCHESTRATOR_NAME = "app-expert"
RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "backend").exists() and (parent / "frontend").exists():
            return parent
    return Path.cwd()


def _skill_roots() -> list[str]:
    skills = RUNTIME_DIR / "skills"
    return [str(skills)] if skills.exists() else []


def _memory_files() -> list[str]:
    memory = RUNTIME_DIR / "AGENTS.md"
    return [str(memory)] if memory.exists() else []


def _skills_loaded() -> list[str]:
    loaded: list[str] = []
    if (RUNTIME_DIR / "AGENTS.md").exists():
        loaded.append("app-expert-memory")
    skills = RUNTIME_DIR / "skills"
    for name in (
        "app-navigation-and-sitemap",
        "feature-status-and-limitations",
        "permissions-and-visibility",
    ):
        if (skills / name / "SKILL.md").exists():
            loaded.append(name)
    return loaded


def _provider_available() -> bool:
    import os

    return bool(os.getenv("OPENAI_API_KEY"))


class _TestBackend:
    def __init__(self, root: Path):
        self.cwd = root


def _app_expert_backend(*, allow_fallback: bool = False) -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=str(_repo_root()), virtual_mode=True)
    except Exception as exc:
        if allow_fallback:
            return _TestBackend(_repo_root())
        raise RuntimeError(f"Deep Agents filesystem backend unavailable: {exc}") from exc


def _agent_config(request: AppExpertRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"app-expert:{request.user_id}"
    configurable: dict[str, Any] = {
        "thread_id": thread_id,
        "user_id": request.user_id,
    }
    if request.project_id is not None:
        configurable["project_id"] = request.project_id
    if request.current_route:
        configurable["current_route"] = request.current_route
    return {"configurable": configurable}


def _app_expert_prompt(request: AppExpertRequest) -> str:
    route_context = (
        f"Current route supplied by caller: {request.current_route}."
        if request.current_route
        else "No current route was supplied."
    )
    project_context = (
        f"Project ID supplied by caller: {request.project_id}."
        if request.project_id
        else "No project ID was supplied."
    )
    approved_skill_context = (
        "Approved app-help Skill Library context:\n"
        f"{request.approved_skill_context.strip()}\n\n"
        if request.approved_skill_context and request.approved_skill_context.strip()
        else ""
    )
    return (
        f"App Expert question:\n{request.question}\n\n"
        f"{route_context}\n"
        f"{project_context}\n\n"
        f"{approved_skill_context}"
        "Required workflow:\n"
        "1. Check App Expert artifact status if freshness or availability is relevant.\n"
        "2. Search curated feature/help metadata before answering general app-use questions.\n"
        "3. If feature metadata returns a helpArticle path, read that help article before claiming behavior is uncertain.\n"
        "4. Use route lookup for page-specific or current-route questions.\n"
        "5. Distinguish documented user-facing behavior from route-discovered implementation evidence.\n"
        "6. Never claim a write action is executable unless the feature registry, help article, or action metadata says so.\n"
        "7. If evidence is missing or conflicts, say what was checked and what remains uncertain.\n"
        "8. Include exact routes, help article paths, or source files when available."
    )


def _extract_sources(answer: str) -> list[AppExpertSource]:
    sources: list[AppExpertSource] = []
    seen: set[tuple[str, str]] = set()
    route_pattern = (
        r"(?<![`\\w])/"
        r"(?:\[[^\]]+\]|[A-Za-z0-9._~!$&'()*+,;=:@%-]+)"
        r"(?:/(?:\[[^\]]+\]|[A-Za-z0-9._~!$&'()*+,;=:@%-]+))*"
    )
    for route in re.findall(route_pattern, answer):
        key = ("sitemap", route)
        if key not in seen:
            seen.add(key)
            sources.append(AppExpertSource(title=route, sourceType="sitemap", route=route))
    help_article_pattern = (
        r"docs/alleato-os-docs/help/articles/"
        r"[A-Za-z0-9._~!$&'()*+,;=:@%/-]+\\.(?:md|mdx)"
    )
    source_file_pattern = (
        r"frontend/src/app/[A-Za-z0-9._~!$&'()*+,;=:@%/\\[\\]-]+/page\\.(?:tsx|ts|jsx|js)"
    )
    for file_path in re.findall(rf"({help_article_pattern}|{source_file_pattern})", answer):
        key = ("file", file_path)
        if key not in seen:
            seen.add(key)
            source_type = "help_article" if "/help/articles/" in file_path else "source_map"
            sources.append(AppExpertSource(title=file_path, sourceType=source_type, filePath=file_path))
    return sources[:20]


def _invoke_agent(agent: Any, payload: dict[str, Any], config: dict[str, Any]) -> Any:
    try:
        return agent.invoke(payload, config=config)
    except TypeError as exc:
        if "config" not in str(exc):
            raise
        return agent.invoke(payload)


def run_app_expert_agent(
    request: AppExpertRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "openai:gpt-5.4-mini",
) -> AppExpertResponse:
    """Run the App Expert Deep Agent and return a typed response."""
    started = time.perf_counter()
    loaded_skills = _skills_loaded()
    try:
        if create_agent is None:
            if not _provider_available():
                raise RuntimeError("OPENAI_API_KEY is required for the App Expert.")
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        kwargs: dict[str, Any] = {
            "name": ORCHESTRATOR_NAME,
            "model": model,
            "tools": app_expert_tools(),
            "backend": _app_expert_backend(allow_fallback=create_agent is not None),
            "system_prompt": (
                "You are the Alleato PM App Expert, a read-only specialist delegated to by the Chief Strategist. "
                "Your job is to answer questions about the web application itself: navigation, routes, features, "
                "workflow behavior, permissions, assistant action status, and implementation-backed source references. "
                "Use curated app-help and generated artifacts first. When a feature registry result points to a help "
                "article, read the article before answering workflow or capability questions. Use route-discovered "
                "evidence only when curated docs are missing, and label it as implementation evidence. Fail loudly "
                "for missing artifacts, stale artifact status, empty tool results, or uncertainty. Do not perform writes."
            ),
        }
        skill_roots = _skill_roots()
        if skill_roots:
            kwargs["skills"] = skill_roots
        memory_files = _memory_files()
        if memory_files:
            kwargs["memory"] = memory_files

        agent = create_agent(**kwargs)
        result = _invoke_agent(
            agent,
            {"messages": [{"role": "user", "content": _app_expert_prompt(request)}]},
            _agent_config(request),
        )
        answer = _extract_agent_text(result)
        if not answer:
            raise RuntimeError("App Expert returned an empty response.")

        return AppExpertResponse(
            answer=answer,
            mode="deep_agents",
            sources=_extract_sources(answer),
            toolTrace=[
                AppExpertTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_app_expert_runtime",
                    status="success",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail="App Expert produced an answer from read-only app knowledge tools.",
                )
            ],
            skillsLoaded=loaded_skills,
            approvedSkillContext=request.approved_skill_context,
            orchestrator=ORCHESTRATOR_NAME,
        )
    except Exception as exc:
        return AppExpertResponse(
            answer=(
                "The App Expert could not complete this request. "
                f"Failed capability: deepagents_app_expert_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            sources=[],
            toolTrace=[
                AppExpertTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_app_expert_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            skillsLoaded=loaded_skills,
            approvedSkillContext=request.approved_skill_context,
            orchestrator=ORCHESTRATOR_NAME,
        )
