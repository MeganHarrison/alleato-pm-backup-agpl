"""Alleato-hosted Deep Agents LLM wiki runtime."""

from __future__ import annotations

import os
import re
import shutil
import time
from datetime import UTC, datetime
from pathlib import Path
from typing import Any, Callable, Optional
from uuid import uuid4

from src.services.agents.runtime_common import (
    extract_agent_text as _extract_agent_text,
    resolve_deep_agents_model as _resolve_deep_agents_model,
)
from src.services.agents.llm_wiki.contracts import (
    WikiArchiveProject,
    WikiArchiveResponse,
    WikiArtifact,
    WikiRequest,
    WikiResponse,
    WikiSource,
    WikiTraceItem,
)


ORCHESTRATOR_NAME = "alleato-llm-wiki-orchestrator"
RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"
OUTPUT_BASE_DIR = Path(os.getenv("LLM_WIKI_OUTPUT_ROOT", "/tmp/alleato-llm-wiki"))
ALLOWED_TEXT_SUFFIXES = {".md", ".txt", ".json", ".yaml", ".yml", ".csv"}


def storage_durability_status() -> dict[str, Any]:
    """Report whether deep-agent artifact roots survive a redeploy.

    Artifacts written under ``/tmp`` are wiped on every Render container
    restart/redeploy. Production must point each output root at the persistent
    disk (``/data/*``). The ``/health`` endpoint surfaces this so a monitor can
    alert when a root is ephemeral instead of silently losing saved research.
    """
    roots = {
        "llm_wiki": os.getenv("LLM_WIKI_OUTPUT_ROOT", "/tmp/alleato-llm-wiki"),
        "docs_research": os.getenv("DOCS_RESEARCH_OUTPUT_ROOT", "/tmp/alleato-docs-research"),
        "content_builder": os.getenv("CONTENT_BUILDER_OUTPUT_ROOT", "/tmp/alleato-content-builder"),
    }
    details = {
        name: {"path": path, "durable": not path.startswith("/tmp")}
        for name, path in roots.items()
    }
    return {
        "durable": all(entry["durable"] for entry in details.values()),
        "roots": details,
    }


class _TestBackend:
    def __init__(self, workspace: Path):
        self.cwd = workspace


def _provider_available() -> bool:
    return bool(os.getenv("OPENAI_API_KEY") or os.getenv("ANTHROPIC_API_KEY"))


def _slugify(value: str) -> str:
    slug = re.sub(r"[^a-zA-Z0-9]+", "-", value.strip().lower()).strip("-")
    return slug[:100] or "topic"


def _workspace_for(request: WikiRequest) -> Path:
    safe_user = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in request.user_id)[:60]
    safe_session = "".join(ch if ch.isalnum() or ch in "-_" else "-" for ch in (request.session_id or ""))[:60]
    suffix = safe_session or uuid4().hex[:12]
    return OUTPUT_BASE_DIR / safe_user / _slugify(request.topic) / suffix


def _safe_write(path: Path, content: str, *, append: bool = False) -> None:
    if path.is_symlink():
        raise RuntimeError(f"Refusing to write to symlink path: {path}")
    path.parent.mkdir(parents=True, exist_ok=True)
    mode = "a" if append else "w"
    with path.open(mode, encoding="utf-8") as handle:
        handle.write(content)


def _index_text(topic: str, workspace: Path) -> str:
    wiki_dir = workspace / "wiki"
    pages = [path for path in sorted(wiki_dir.rglob("*.md")) if path.name != "index.md"]
    lines = [
        f"# {topic} Wiki",
        "",
        "Content catalog for wiki navigation and retrieval.",
        "Read this page first during query workflows.",
        "",
    ]
    if not pages:
        lines.extend(["## Other Pages", "", "- _No pages yet._"])
        return "\n".join(lines) + "\n"

    grouped: dict[str, list[str]] = {
        "Entities": [],
        "Concepts": [],
        "Sources": [],
        "Timelines": [],
        "Queries": [],
        "Syntheses": [],
        "Other Pages": [],
    }
    directory_categories = {
        "entity": "Entities",
        "entities": "Entities",
        "concept": "Concepts",
        "concepts": "Concepts",
        "source": "Sources",
        "sources": "Sources",
        "timeline": "Timelines",
        "timelines": "Timelines",
        "query": "Queries",
        "queries": "Queries",
        "synthesis": "Syntheses",
        "syntheses": "Syntheses",
    }
    for page in pages:
        relative = page.relative_to(wiki_dir)
        content = page.read_text(encoding="utf-8", errors="replace")
        title = next(
            (line.lstrip("#").strip() for line in content.splitlines() if line.strip().startswith("#")),
            relative.stem.replace("-", " ").title(),
        )
        summary = next(
            (
                re.sub(r"\s+", " ", line.strip().lstrip("-*+ ")).strip()
                for line in content.splitlines()
                if line.strip() and not line.strip().startswith("#")
            ),
            "No summary available.",
        )
        if len(summary) > 150:
            summary = f"{summary[:147].rstrip()}..."
        category = directory_categories.get(relative.parts[0].lower(), "Other Pages") if len(relative.parts) > 1 else "Other Pages"
        grouped[category].append(f"- [{title}]({relative.as_posix()}) - {summary}")

    for category, entries in grouped.items():
        if not entries:
            continue
        lines.extend([f"## {category}", "", *entries, ""])
    return "\n".join(lines).rstrip() + "\n"


def _append_log(workspace: Path, phase: str, outcome: str, summary: str) -> None:
    now = datetime.now(UTC)
    normalized = re.sub(r"\s+", " ", summary).strip()[:320] or "No summary provided."
    entry = (
        f"\n## [{now:%Y-%m-%d}] {phase} | outcome={outcome}\n"
        f"- timestamp: {now:%Y-%m-%dT%H:%M:%SZ}\n"
        f"- summary: {normalized}\n"
    )
    _safe_write(workspace / "log.md", entry, append=True)


def _prepare_workspace(request: WikiRequest, workspace: Path) -> None:
    workspace.mkdir(parents=True, exist_ok=True)
    (workspace / "raw").mkdir(parents=True, exist_ok=True)
    (workspace / "wiki").mkdir(parents=True, exist_ok=True)
    runtime_agents = RUNTIME_DIR / "AGENTS.md"
    if runtime_agents.exists() and not (workspace / "AGENTS.md").exists():
        shutil.copyfile(runtime_agents, workspace / "AGENTS.md")
    if not (workspace / "log.md").exists():
        _safe_write(workspace / "log.md", "# Change Log\n")
    if not (workspace / "wiki" / "index.md").exists():
        _safe_write(workspace / "wiki" / "index.md", _index_text(request.topic, workspace))


def _stage_sources(workspace: Path, sources: list[WikiSource]) -> list[str]:
    staged: list[str] = []
    for source in sources:
        relative = Path(source.path)
        if relative.suffix.lower() not in ALLOWED_TEXT_SUFFIXES:
            raise RuntimeError(f"Unsupported source file type for {source.path}.")
        target = workspace / "raw" / relative.name
        counter = 2
        while target.exists() or target.is_symlink():
            target = workspace / "raw" / f"{relative.stem}-{counter}{relative.suffix}"
            counter += 1
        _safe_write(target, source.content)
        staged.append(f"/raw/{target.name}")
    return staged


def _backend(workspace: Path, *, allow_fallback: bool = False) -> Any:
    try:
        from deepagents.backends import FilesystemBackend

        return FilesystemBackend(root_dir=workspace, virtual_mode=True)
    except Exception as exc:
        if allow_fallback:
            return _TestBackend(workspace)
        raise RuntimeError(f"Deep Agents filesystem backend unavailable: {exc}") from exc


def _permissions(*, read_only: bool) -> list[Any]:
    try:
        from deepagents.middleware.filesystem import FilesystemPermission
    except Exception:
        return []
    if read_only:
        return [
            FilesystemPermission(operations=["write"], paths=["/raw/**"], mode="deny"),
            FilesystemPermission(operations=["write"], paths=["/wiki/**"], mode="deny"),
            FilesystemPermission(operations=["write"], paths=["/log.md"], mode="deny"),
            FilesystemPermission(operations=["write"], paths=["/AGENTS.md"], mode="deny"),
        ]
    return [
        FilesystemPermission(operations=["write"], paths=["/raw/**"], mode="deny"),
        FilesystemPermission(operations=["write"], paths=["/AGENTS.md"], mode="deny"),
        FilesystemPermission(operations=["write"], paths=["/log.md"], mode="deny"),
        FilesystemPermission(operations=["write"], paths=["/wiki/**"], mode="allow"),
    ]


def _agent_config(request: WikiRequest) -> dict[str, Any]:
    thread_id = request.session_id or f"llm-wiki:{request.user_id}:{_slugify(request.topic)}"
    return {"configurable": {"thread_id": thread_id, "user_id": request.user_id}}


def _base_system_prompt() -> str:
    return (
        "You are an expert research synthesizer building a long-lived topic knowledge base. "
        "Use Deep Agents planning and filesystem tools deliberately. Read source material before writing. "
        "Write only under /wiki/. Never edit /raw/, /log.md, or /AGENTS.md. Fail loudly when evidence, "
        "provider calls, or filesystem writes are unavailable."
    )


def _ingest_prompt(request: WikiRequest, staged: list[str]) -> str:
    source_block = "\n".join(f"- {path}" for path in staged)
    note = request.note or "(none)"
    return (
        f"Apply an ingest update for topic '{request.topic}'.\n\n"
        "Required workflow:\n"
        "1. Read all staged files in `/raw/` before editing wiki content.\n"
        "2. Update canonical concept/entity/theme pages with high-signal evidence.\n"
        "3. Preserve contradictions and unresolved uncertainty.\n"
        "4. Update `/wiki/index.md`.\n"
        "5. Do not edit `/log.md`; the runner appends timeline entries.\n\n"
        f"Staged sources:\n{source_block}\n\nOperator note: {note}\n"
    )


def _query_review_prompt(request: WikiRequest) -> str:
    return (
        f"Answer this question about '{request.topic}': {request.question}\n\n"
        "This is analysis-only. Do not create, edit, move, or delete files.\n"
        "Read `/wiki/index.md` first, then recent `/log.md`, then relevant canonical wiki pages. "
        "Provide a grounded answer with wiki file path citations.\n\n"
        "Output format:\nANSWER:\n<answer>\n\nFILING_DECISION: file|skip\nFILING_REASON: <one sentence>\n"
    )


def _query_apply_prompt(request: WikiRequest, answer: str) -> str:
    target = f"/wiki/query/{_slugify(request.question or 'query')[:80]}.md"
    return (
        f"File a durable query answer for topic '{request.topic}'.\n"
        f"Create or overwrite exactly: `{target}`\n\n"
        "Include sections: `Question`, `Answer`, and `Sources`. Preserve citations.\n\n"
        f"Question: {request.question}\n\nAnswer draft:\n{answer}\n"
    )


def _lint_prompt(request: WikiRequest) -> str:
    return (
        f"Run a single-pass lint reconciliation for the '{request.topic}' wiki under `/wiki/`.\n"
        "Read recent `/log.md` entries first. Reconcile contradictions, stale claims, orphan pages, "
        "missing cross-references, and key concept gaps. Apply updates immediately under `/wiki/` only.\n\n"
        "Return sections: ## Reconciled Changes, ## Remaining Gaps, ## Suggested Next Questions and Sources.\n"
        f"Operator note: {request.note or '(none)'}\n"
    )


def _invoke(agent: Any, payload: dict[str, Any], config: dict[str, Any]) -> Any:
    try:
        return agent.invoke(payload, config=config)
    except TypeError as exc:
        if "config" not in str(exc):
            raise
        return agent.invoke(payload)


def _create_agent_kwargs(
    workspace: Path,
    *,
    read_only: bool,
    model: str,
    allow_fallback_backend: bool = False,
) -> dict[str, Any]:
    kwargs: dict[str, Any] = {
        "name": ORCHESTRATOR_NAME,
        "model": model,
        "memory": [str(workspace / "AGENTS.md")],
        "backend": _backend(workspace, allow_fallback=allow_fallback_backend),
        "permissions": _permissions(read_only=read_only),
        "system_prompt": _base_system_prompt(),
    }
    return kwargs


def _parse_query_answer(raw: str) -> tuple[str, bool]:
    decision_match = re.search(r"^FILING_DECISION:\s*(file|skip)\s*$", raw, re.IGNORECASE | re.MULTILINE)
    should_file = bool(decision_match and decision_match.group(1).lower() == "file")
    answer = raw[: decision_match.start()].strip() if decision_match else raw.strip()
    if answer.upper().startswith("ANSWER:"):
        answer = answer[len("ANSWER:") :].strip()
    return answer or raw or "No answer returned.", should_file


def _collect_artifacts(workspace: Path, *, include_content: bool = True) -> list[WikiArtifact]:
    artifacts: list[WikiArtifact] = []
    for path in sorted(workspace.rglob("*")):
        if path.is_symlink():
            continue
        if not path.is_file():
            continue
        relative = path.relative_to(workspace).as_posix()
        size = path.stat().st_size
        kind = "other"
        if relative.startswith("raw/"):
            kind = "source"
        elif relative == "log.md":
            kind = "log"
        elif path.suffix.lower() == ".md":
            kind = "markdown"
        content = None
        if include_content and path.suffix.lower() in {".md", ".txt", ".json", ".yaml", ".yml", ".csv"} and size <= 100_000:
            content = path.read_text(encoding="utf-8", errors="replace")
        artifacts.append(WikiArtifact(path=relative, kind=kind, bytes=size, content=content))  # type: ignore[arg-type]
    return artifacts


def _first_heading(content: str, fallback: str) -> str:
    for line in content.splitlines():
        stripped = line.strip()
        if stripped.startswith("#"):
            heading = stripped.lstrip("#").strip()
            if heading:
                return heading
    return fallback


def _latest_log_summary(log_content: str) -> Optional[str]:
    summaries = re.findall(r"^- summary:\s*(.+)$", log_content, flags=re.MULTILINE)
    return summaries[-1].strip() if summaries else None


def _archive_project_from_workspace(workspace: Path) -> Optional[WikiArchiveProject]:
    try:
        relative = workspace.relative_to(OUTPUT_BASE_DIR)
    except ValueError:
        return None

    if len(relative.parts) != 3 or not (workspace / "wiki").is_dir():
        return None

    artifacts = _collect_artifacts(workspace, include_content=False)
    latest_mtime = max(
        (path.stat().st_mtime for path in workspace.rglob("*") if path.is_file() and not path.is_symlink()),
        default=workspace.stat().st_mtime,
    )
    user_id, topic_slug, session_id = relative.parts
    index_path = workspace / "wiki" / "index.md"
    index_content = index_path.read_text(encoding="utf-8", errors="replace") if index_path.exists() else ""
    log_path = workspace / "log.md"
    log_content = log_path.read_text(encoding="utf-8", errors="replace") if log_path.exists() else ""
    title = _first_heading(index_content, topic_slug.replace("-", " ").title())
    topic = title[:-5] if title.lower().endswith(" wiki") else title

    return WikiArchiveProject(
        userId=user_id,
        topic=topic,
        topicSlug=topic_slug,
        sessionId=session_id,
        wikiPath=str(workspace),
        title=title,
        updatedAt=datetime.fromtimestamp(latest_mtime, UTC).strftime("%Y-%m-%dT%H:%M:%SZ"),
        artifactCount=len(artifacts),
        markdownCount=sum(1 for artifact in artifacts if artifact.kind == "markdown"),
        sourceCount=sum(1 for artifact in artifacts if artifact.kind == "source"),
        logSummary=_latest_log_summary(log_content),
    )


def list_llm_wiki_archive(
    *,
    user_id: Optional[str] = None,
    topic_slug: Optional[str] = None,
    session_id: Optional[str] = None,
    limit: int = 50,
) -> WikiArchiveResponse:
    """List persisted LLM wiki workspaces and optionally include one workspace's artifacts."""
    if limit < 1 or limit > 200:
        raise RuntimeError("Archive limit must be between 1 and 200.")

    root = OUTPUT_BASE_DIR
    projects: list[WikiArchiveProject] = []
    if root.exists():
        workspace_candidates = [
            path for path in root.glob("*/*/*")
            if path.is_dir() and not path.is_symlink()
        ]
        for workspace in workspace_candidates:
            project = _archive_project_from_workspace(workspace)
            if project is None:
                continue
            if user_id and project.user_id != user_id:
                continue
            if topic_slug and project.topic_slug != topic_slug:
                continue
            if session_id and project.session_id != session_id:
                continue
            projects.append(project)

    projects.sort(key=lambda project: project.updated_at, reverse=True)
    selected_project = projects[0] if user_id and topic_slug and session_id and projects else None
    artifacts: list[WikiArtifact] = []
    if selected_project:
        selected_path = (root / selected_project.user_id / selected_project.topic_slug / selected_project.session_id).resolve()
        root_path = root.resolve()
        if root_path not in selected_path.parents:
            selected_project = None
        else:
            artifacts = _collect_artifacts(selected_path)

    return WikiArchiveResponse(
        projects=projects[:limit],
        selectedProject=selected_project,
        artifacts=artifacts,
    )


def run_llm_wiki_agent(
    request: WikiRequest,
    *,
    create_agent: Optional[Callable[..., Any]] = None,
    model: str = "openai:gpt-5.4-mini",
) -> WikiResponse:
    """Run the packaged LLM wiki workflow and return a typed response."""
    started = time.perf_counter()
    workspace = _workspace_for(request)
    try:
        _prepare_workspace(request, workspace)
        staged = _stage_sources(workspace, request.sources) if request.sources else []

        if request.mode == "init":
            _safe_write(workspace / "wiki" / "index.md", _index_text(request.topic, workspace))
            _append_log(workspace, "init.apply", "applied", "Wiki scaffold initialized.")
            return WikiResponse(
                answer="Wiki scaffold initialized.",
                mode="scaffold",
                wikiPath=str(workspace),
                artifacts=_collect_artifacts(workspace),
                toolTrace=[
                    WikiTraceItem(
                        agent=ORCHESTRATOR_NAME,
                        tool="llm_wiki_scaffold",
                        status="success",
                        durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                        detail=f"Workspace: {workspace}",
                    )
                ],
                orchestrator=ORCHESTRATOR_NAME,
            )

        if create_agent is None:
            if not _provider_available():
                raise RuntimeError("OPENAI_API_KEY or ANTHROPIC_API_KEY is required for LLM wiki agent modes.")
            from deepagents import create_deep_agent as create_agent

            model = _resolve_deep_agents_model(model)

        def make_agent(*, read_only: bool):
            kwargs = _create_agent_kwargs(
                workspace,
                read_only=read_only,
                model=model,
                allow_fallback_backend=create_agent is not None,
            )
            return create_agent(**kwargs)

        if request.mode == "ingest":
            prompt = _ingest_prompt(request, staged)
            answer = _extract_agent_text(_invoke(make_agent(read_only=False), {"messages": [{"role": "user", "content": prompt}]}, _agent_config(request)))
            _safe_write(workspace / "wiki" / "index.md", _index_text(request.topic, workspace))
            _append_log(workspace, "ingest.apply", "applied", answer or "Ingest applied.")
        elif request.mode == "query":
            review = _extract_agent_text(_invoke(make_agent(read_only=True), {"messages": [{"role": "user", "content": _query_review_prompt(request)}]}, _agent_config(request)))
            answer, should_file = _parse_query_answer(review)
            _append_log(workspace, "query.review", "file" if should_file else "skip", answer)
            if should_file and request.file_query_answer:
                _invoke(make_agent(read_only=False), {"messages": [{"role": "user", "content": _query_apply_prompt(request, answer)}]}, _agent_config(request))
                _safe_write(workspace / "wiki" / "index.md", _index_text(request.topic, workspace))
                _append_log(workspace, "query.apply", "filed", answer)
        else:
            answer = _extract_agent_text(_invoke(make_agent(read_only=False), {"messages": [{"role": "user", "content": _lint_prompt(request)}]}, _agent_config(request)))
            _safe_write(workspace / "wiki" / "index.md", _index_text(request.topic, workspace))
            _append_log(workspace, "lint.apply", "applied", answer or "Lint applied.")

        if not answer:
            raise RuntimeError("Deep Agents LLM wiki runtime returned an empty response.")

        return WikiResponse(
            answer=answer,
            mode="deep_agents",
            wikiPath=str(workspace),
            artifacts=_collect_artifacts(workspace),
            toolTrace=[
                WikiTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="llm_wiki_runtime",
                    status="success",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=f"Workspace: {workspace}",
                )
            ],
            orchestrator=ORCHESTRATOR_NAME,
        )
    except Exception as exc:
        return WikiResponse(
            answer=(
                "The LLM wiki agent could not complete this request. "
                f"Failed capability: llm_wiki_runtime. Detail: {exc}"
            ),
            mode="unavailable",
            wikiPath=str(workspace),
            artifacts=_collect_artifacts(workspace) if workspace.exists() else [],
            toolTrace=[
                WikiTraceItem(
                    agent=ORCHESTRATOR_NAME,
                    tool="llm_wiki_runtime",
                    status="failed",
                    durationMs=max(0, int((time.perf_counter() - started) * 1000)),
                    detail=str(exc),
                )
            ],
            orchestrator=ORCHESTRATOR_NAME,
        )
