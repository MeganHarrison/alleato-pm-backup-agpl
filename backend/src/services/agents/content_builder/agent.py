"""Alleato Deep Agents content builder runtime."""

from __future__ import annotations

import os
import shutil
import time
from pathlib import Path
from typing import Any, Callable, Optional
from uuid import uuid4

import yaml

from src.services.agents.content_builder.contracts import (
    ContentBuilderArtifact,
    ContentBuilderRequest,
    ContentBuilderResponse,
    ContentBuilderTraceItem,
)
from src.services.agents.content_builder.tools import (
    content_builder_research_tools,
    content_builder_tools,
    set_output_root,
    web_search,
)
from src.services.agents.runtime_common import (
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)


ORCHESTRATOR_NAME = "alleato-content-builder-orchestrator"
RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"
OUTPUT_BASE_DIR = Path(os.getenv("CONTENT_BUILDER_OUTPUT_ROOT", "/tmp/alleato-content-builder"))


def _workspace_for(request: ContentBuilderRequest) -> Path:
    safe_user = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in request.user_id)[:60]
    safe_session = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (request.session_id or ""))[:60]
    suffix = safe_session or uuid4().hex[:12]
    return OUTPUT_BASE_DIR / safe_user / suffix


def _prepare_workspace(workspace: Path) -> None:
    workspace.mkdir(parents=True, exist_ok=True)
    for name in ("AGENTS.md", "subagents.yaml"):
        source = RUNTIME_DIR / name
        target = workspace / name
        if source.exists() and not target.exists():
            shutil.copyfile(source, target)

    source_skills = RUNTIME_DIR / "skills"
    target_skills = workspace / "skills"
    if source_skills.exists() and not target_skills.exists():
        shutil.copytree(source_skills, target_skills)


def _skills_loaded(workspace: Path) -> list[str]:
    loaded: list[str] = []
    skills_root = workspace / "skills"
    for name in ("blog-post", "social-media"):
        if (skills_root / name / "SKILL.md").exists():
            loaded.append(name)
    if (workspace / "AGENTS.md").exists():
        loaded.append("content-builder-memory")
    return loaded


def _provider_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY"))


class _TestBackend:
    def __init__(self, workspace: Path):
        self.cwd = workspace


def _content_backend(workspace: Path, *, allow_fallback: bool = False) -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=workspace, virtual_mode=True)
    except Exception as exc:
        if allow_fallback:
            return _TestBackend(workspace)
        raise RuntimeError(f"Deep Agents filesystem backend unavailable: {exc}") from exc


def _agent_config(request: ContentBuilderRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"content-builder:{request.user_id}"
    return {"configurable": {"thread_id": thread_id}}


def _content_prompt(request: ContentBuilderRequest) -> str:
    type_hint = f"Requested content type: {request.content_type}." if request.content_type else "Infer the right content type from the prompt."
    image_instruction = (
        "Generate the required companion image using the available image tool."
        if request.include_images
        else "Do not generate images; write the content and explicitly note imagery was disabled by the caller."
    )
    return (
        f"Content request:\n{request.prompt}\n\n"
        f"{type_hint}\n"
        f"Search budget: use at most {request.max_searches} public web searches unless an essential evidence gap remains.\n\n"
        "Required workflow:\n"
        "1. Use the packaged memory and the relevant packaged skill before writing.\n"
        "2. Delegate research to the researcher subagent before producing blog or social content.\n"
        "3. Save research under research/<slug>.md.\n"
        "4. Save blog posts under blogs/<slug>/post.md, LinkedIn posts under linkedin/<slug>/post.md, "
        "and Twitter/X threads under tweets/<slug>/thread.md.\n"
        f"5. {image_instruction}\n"
        "6. If web search, provider calls, filesystem writes, or image generation are unavailable, include the exact "
        "failed capability in the final answer. Never return a blank answer."
    )


def _load_subagents(config_path: Path) -> list[dict[str, Any]]:
    if not config_path.exists():
        return []

    available_tools = {"web_search": web_search}
    with config_path.open() as handle:
        config = yaml.safe_load(handle) or {}

    subagents: list[dict[str, Any]] = []
    for name, spec in config.items():
        if not isinstance(spec, dict):
            continue
        subagent: dict[str, Any] = {
            "name": name,
            "description": spec.get("description", ""),
            "system_prompt": spec.get("system_prompt", ""),
        }
        configured_model = spec.get("model")
        if isinstance(configured_model, str) and configured_model.strip():
            subagent["model"] = configured_model.strip()
        tool_names = spec.get("tools") or []
        tools = [available_tools[tool_name] for tool_name in tool_names if tool_name in available_tools]
        if tools:
            subagent["tools"] = tools
        subagents.append(subagent)
    return subagents


def _artifact_kind(path: Path) -> str:
    lowered = path.name.lower()
    if lowered.endswith((".png", ".jpg", ".jpeg", ".webp")):
        return "image"
    if "research" in path.parts:
        return "research"
    if lowered.endswith(".md"):
        return "markdown"
    return "other"


def _collect_artifacts(workspace: Path) -> list[ContentBuilderArtifact]:
    artifacts: list[ContentBuilderArtifact] = []
    for path in sorted(workspace.rglob("*")):
        if not path.is_file() or path.name in {"AGENTS.md", "subagents.yaml", "SKILL.md"}:
            continue
        if "skills" in path.parts:
            continue
        relative_path = path.relative_to(workspace).as_posix()
        size = path.stat().st_size
        content: str | None = None
        if path.suffix.lower() in {".md", ".txt"} and size <= 100_000:
            content = path.read_text(errors="replace")
        artifacts.append(
            ContentBuilderArtifact(
                path=relative_path,
                kind=_artifact_kind(path),  # type: ignore[arg-type]
                bytes=size,
                content=content,
            )
        )
    return artifacts


def run_content_builder_agent(
    request: ContentBuilderRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "openai:gpt-5.4-mini",
) -> ContentBuilderResponse:
    """Run the packaged Deep Agents content builder and return a typed response."""
    started = time.perf_counter()
    workspace = _workspace_for(request)
    loaded_skills: list[str] = []
    try:
        _prepare_workspace(workspace)
        set_output_root(workspace)
        loaded_skills = _skills_loaded(workspace)

        if create_agent is None:
            if not _provider_available():
                raise RuntimeError("OPENAI_API_KEY is required for Deep Agents content generation.")
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        kwargs: dict[str, Any] = {
            "name": ORCHESTRATOR_NAME,
            "model": model,
            "memory": [str(workspace / "AGENTS.md")],
            "skills": [str(workspace / "skills")],
            "tools": content_builder_tools(include_images=request.include_images),
            "subagents": _load_subagents(workspace / "subagents.yaml"),
            "backend": _content_backend(workspace, allow_fallback=create_agent is not None),
            "system_prompt": (
                "You are Alleato's isolated content builder running inside the Render FastAPI backend. "
                "Use the packaged memory, skills, researcher subagent, and virtual filesystem workspace. "
                "Write files only inside the provided workspace. Fail loudly when provider calls, web search, "
                "image generation, or filesystem writes are unavailable."
            ),
        }
        if not kwargs["subagents"]:
            kwargs["subagents"] = [
                {
                    "name": "researcher",
                    "description": "Research content topics with web_search and summarize findings with URLs.",
                    "system_prompt": "Use web_search for 2-3 targeted searches and include source URLs.",
                    "tools": content_builder_research_tools(),
                }
            ]

        agent = create_agent(**kwargs)
        result = agent.invoke(
            {"messages": [{"role": "user", "content": _content_prompt(request)}]},
            config=_agent_config(request),
        )
        answer = _extract_agent_text(result)
        if not answer:
            raise RuntimeError("Deep Agents content builder returned an empty response.")

        return ContentBuilderResponse(
            answer=answer,
            mode="deep_agents",
            artifacts=_collect_artifacts(workspace),
            toolTrace=[
                ContentBuilderTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_content_builder_runtime",
                    status="success",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=f"Workspace: {workspace}",
                )
            ],
            skillsLoaded=loaded_skills,
            orchestrator=ORCHESTRATOR_NAME,
        )
    except Exception as exc:
        return ContentBuilderResponse(
            answer=(
                "The Alleato content builder could not complete this request. "
                f"Failed capability: deepagents_content_builder_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            artifacts=_collect_artifacts(workspace) if workspace.exists() else [],
            toolTrace=[
                ContentBuilderTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="deepagents_content_builder_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            skillsLoaded=loaded_skills,
            orchestrator=ORCHESTRATOR_NAME,
        )
