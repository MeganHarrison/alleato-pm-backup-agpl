"""Read-only tools for the Alleato App Expert agent."""

from __future__ import annotations

import json
import re
from functools import lru_cache
from pathlib import Path
from typing import Any

from langchain_core.tools import tool


def _repo_root() -> Path:
    current = Path(__file__).resolve()
    for parent in current.parents:
        if (parent / "frontend").exists() and (parent / "backend").exists():
            return parent
    return Path.cwd()


RUNTIME_DIR = Path(__file__).resolve().parent / "runtime"
GENERATED_DIRS = [
    _repo_root() / "docs" / "architecture" / "generated",
    RUNTIME_DIR / "generated",
]
HELP_ROOTS = [
    _repo_root() / "docs" / "alleato-os-docs" / "help" / "articles",
    RUNTIME_DIR / "help" / "articles",
]
SITEMAP_PATHS = [directory / "app-sitemap.generated.json" for directory in GENERATED_DIRS]
FEATURE_REGISTRY_PATHS = [directory / "feature-registry.generated.json" for directory in GENERATED_DIRS]


def _first_existing_path(paths: list[Path]) -> Path:
    for path in paths:
        if path.exists():
            return path
    return paths[0]


def _normalize(value: str) -> str:
    normalized = re.sub(r"[^a-z0-9\[\]]+", " ", value.lower())
    return re.sub(r"\s+", " ", normalized).strip()


def _query_terms(value: str) -> list[str]:
    terms: list[str] = []
    for term in _normalize(value).split():
        if len(term) > 3 and term.endswith("s"):
            term = term[:-1]
        if term and term not in terms:
            terms.append(term)
    return terms


def _search_score(query: str, haystack: str) -> int:
    normalized_query = _normalize(query)
    normalized_haystack = _normalize(haystack)
    terms = _query_terms(query)
    if not terms:
        return 0
    score = 0
    if normalized_query and normalized_query in normalized_haystack:
        score += len(terms) + 4
    for term in terms:
        if re.search(rf"\b{re.escape(term)}s?\b", normalized_haystack):
            score += 1
    return score


def _route_normalize(value: str) -> str:
    stripped = value.strip()
    if not stripped:
        return "/"
    return stripped if stripped.startswith("/") else f"/{stripped}"


def _bounded_limit(value: int, *, default: int = 8, maximum: int = 20) -> int:
    try:
        parsed = int(value)
    except Exception:
        return default
    return max(1, min(maximum, parsed))


@lru_cache(maxsize=4)
def _load_json(path: str) -> dict[str, Any]:
    file_path = Path(path)
    if not file_path.exists():
        return {
            "error": (
                f"APP_EXPERT_ARTIFACT_MISSING: {file_path} does not exist. "
                "Run `npm run docs:generate-app-expert` before using App Expert tools."
            )
        }
    try:
        parsed = json.loads(file_path.read_text(encoding="utf-8"))
        return parsed if isinstance(parsed, dict) else {"error": f"APP_EXPERT_ARTIFACT_INVALID: {file_path}"}
    except Exception as exc:
        return {"error": f"APP_EXPERT_ARTIFACT_READ_FAILED: {type(exc).__name__}: {exc}"}


def _sitemap() -> dict[str, Any]:
    return _load_json(str(_first_existing_path(SITEMAP_PATHS)))


def _feature_registry() -> dict[str, Any]:
    return _load_json(str(_first_existing_path(FEATURE_REGISTRY_PATHS)))


def _json_result(payload: dict[str, Any]) -> str:
    return json.dumps(payload, indent=2, sort_keys=True)


def _safe_help_article_path(file_path: str) -> Path | None:
    raw = file_path.strip()
    if not raw:
        return None
    relative = raw
    for prefix in [
        "docs/alleato-os-docs/help/articles/",
        "docs/help/articles/",
    ]:
        relative = relative.removeprefix(prefix)
    candidates: list[Path] = []
    if raw.startswith("docs/"):
        candidates.append((_repo_root() / raw).resolve())
    for help_root in HELP_ROOTS:
        candidates.append((help_root / relative).resolve())
        if relative.endswith(".md"):
            candidates.append((help_root / f"{relative[:-3]}.mdx").resolve())
        elif relative.endswith(".mdx"):
            candidates.append((help_root / f"{relative[:-4]}.md").resolve())
        else:
            candidates.append((help_root / f"{relative}.mdx").resolve())
            candidates.append((help_root / f"{relative}.md").resolve())
    for candidate in candidates:
        if candidate.exists() and candidate.suffix in {".md", ".mdx"} and any(
            _is_relative_to(candidate, help_root.resolve()) for help_root in HELP_ROOTS
        ):
            return candidate
    return None


def _is_relative_to(candidate: Path, parent: Path) -> bool:
    try:
        candidate.relative_to(parent)
        return True
    except ValueError:
        return False


def _display_help_article_path(article_path: Path) -> str:
    repo_root = _repo_root()
    if _is_relative_to(article_path, repo_root):
        return str(article_path.relative_to(repo_root))
    docs_site_root = (repo_root / "docs" / "alleato-os-docs" / "help" / "articles").resolve()
    if _is_relative_to(article_path, docs_site_root):
        relative = article_path.relative_to(docs_site_root)
        return str(Path("docs/alleato-os-docs/help/articles") / relative)
    return article_path.name


@tool
def get_app_sitemap(limit: int = 20) -> str:
    """Return a bounded sample of the generated Alleato PM app sitemap."""
    data = _sitemap()
    if data.get("error"):
        return _json_result({"ok": False, "error": data["error"], "source": "app-sitemap.generated.json"})
    routes = data.get("routes") if isinstance(data.get("routes"), list) else []
    return _json_result(
        {
            "ok": True,
            "source": "app-sitemap.generated.json",
            "generatedAt": data.get("generatedAt"),
            "routeCount": data.get("routeCount", len(routes)),
            "routes": routes[: _bounded_limit(limit, maximum=50)],
        }
    )


@tool
def search_app_sitemap(query: str, limit: int = 8) -> str:
    """Search generated route metadata by route, title, category, scope, or source file."""
    data = _sitemap()
    if data.get("error"):
        return _json_result({"ok": False, "error": data["error"], "source": "app-sitemap.generated.json"})
    if not _normalize(query):
        return _json_result({"ok": False, "error": "SEARCH_APP_SITEMAP_FAILED: query must not be blank."})
    matches = []
    for route in data.get("routes", []):
        score = _search_score(query, json.dumps(route, sort_keys=True))
        if score > 0:
            matches.append((score, route))
    matches.sort(key=lambda item: item[0], reverse=True)
    return _json_result(
        {
            "ok": True,
            "source": "app-sitemap.generated.json",
            "query": query,
            "count": len(matches),
            "routes": [route for _, route in matches[: _bounded_limit(limit)]],
        }
    )


@tool
def lookup_app_route(route: str) -> str:
    """Look up one generated app route and return ownership, scope, and source file metadata."""
    data = _sitemap()
    if data.get("error"):
        return _json_result({"ok": False, "error": data["error"], "source": "app-sitemap.generated.json"})
    target = _route_normalize(route)
    routes = data.get("routes") if isinstance(data.get("routes"), list) else []
    exact = next((item for item in routes if item.get("route") == target), None)
    if exact:
        return _json_result({"ok": True, "source": "app-sitemap.generated.json", "route": exact})
    suggestions = [
        item for item in routes if target in str(item.get("route", "")) or str(item.get("route", "")) in target
    ][:5]
    return _json_result(
        {
            "ok": False,
            "error": f"LOOKUP_APP_ROUTE_NOT_FOUND: No exact generated route matched {target}.",
            "source": "app-sitemap.generated.json",
            "suggestions": suggestions,
        }
    )


@tool
def search_feature_registry(query: str, limit: int = 8) -> str:
    """Search generated feature registry by title, module, category, route, tag, action, or help article."""
    data = _feature_registry()
    if data.get("error"):
        return _json_result({"ok": False, "error": data["error"], "source": "feature-registry.generated.json"})
    if not _normalize(query):
        return _json_result({"ok": False, "error": "SEARCH_FEATURE_REGISTRY_FAILED: query must not be blank."})
    matches = []
    for feature in data.get("features", []):
        score = _search_score(query, json.dumps(feature, sort_keys=True))
        if score > 0:
            matches.append((score, feature))
    matches.sort(key=lambda item: item[0], reverse=True)
    return _json_result(
        {
            "ok": True,
            "source": "feature-registry.generated.json",
            "query": query,
            "count": len(matches),
            "features": [feature for _, feature in matches[: _bounded_limit(limit)]],
        }
    )


@tool
def get_feature_details(feature_id_or_title: str) -> str:
    """Return one feature-registry entry by id, title, route, or help article slug."""
    data = _feature_registry()
    if data.get("error"):
        return _json_result({"ok": False, "error": data["error"], "source": "feature-registry.generated.json"})
    target = _normalize(feature_id_or_title)
    if not target:
        return _json_result({"ok": False, "error": "GET_FEATURE_DETAILS_FAILED: feature identifier must not be blank."})
    features = data.get("features") if isinstance(data.get("features"), list) else []
    for feature in features:
        candidates = [
            str(feature.get("id", "")),
            str(feature.get("title", "")),
            str(feature.get("helpArticle", "")),
            *[str(route) for route in feature.get("routes", []) if isinstance(route, str)],
        ]
        if any(_normalize(candidate) == target for candidate in candidates):
            return _json_result({"ok": True, "source": "feature-registry.generated.json", "feature": feature})
    suggestions = [
        feature
        for feature in features
        if target in _normalize(json.dumps(feature, sort_keys=True))
    ][:5]
    return _json_result(
        {
            "ok": False,
            "error": f"GET_FEATURE_DETAILS_NOT_FOUND: No feature matched {feature_id_or_title}.",
            "source": "feature-registry.generated.json",
            "suggestions": suggestions,
        }
    )


@tool
def get_help_article(file_path_or_slug: str, max_chars: int = 6000) -> str:
    """Read one curated help article by docs-site help path or article slug."""
    article_path = _safe_help_article_path(file_path_or_slug)
    if article_path is None:
        slug = file_path_or_slug.strip().removesuffix(".md").removesuffix(".mdx")
        article_path = _safe_help_article_path(f"{slug}.md")
    if article_path is None:
        return _json_result(
            {
                "ok": False,
                "error": (
                    "GET_HELP_ARTICLE_NOT_FOUND: expected a path under "
                    "docs/alleato-os-docs/help/articles or an article slug."
                ),
            }
        )

    max_chars = _bounded_limit(max_chars, default=6000, maximum=12000)
    raw = article_path.read_text(encoding="utf-8")
    truncated = len(raw) > max_chars
    return _json_result(
        {
            "ok": True,
            "source": "help_article",
            "filePath": _display_help_article_path(article_path),
            "content": raw[:max_chars],
            "truncated": truncated,
        }
    )


@tool
def get_app_expert_artifact_status() -> str:
    """Return generated artifact availability and freshness for App Expert answers."""
    sitemap_path = _first_existing_path(SITEMAP_PATHS)
    registry_path = _first_existing_path(FEATURE_REGISTRY_PATHS)
    sitemap = _sitemap()
    registry = _feature_registry()
    return _json_result(
        {
            "ok": not sitemap.get("error") and not registry.get("error"),
            "artifacts": [
                {
                    "name": "app-sitemap.generated.json",
                    "path": str(sitemap_path),
                    "ok": not sitemap.get("error"),
                    "error": sitemap.get("error"),
                    "generatedAt": sitemap.get("generatedAt"),
                    "count": sitemap.get("routeCount"),
                },
                {
                    "name": "feature-registry.generated.json",
                    "path": str(registry_path),
                    "ok": not registry.get("error"),
                    "error": registry.get("error"),
                    "generatedAt": registry.get("generatedAt"),
                    "count": registry.get("featureCount"),
                },
            ],
        }
    )


def app_expert_tools() -> list[Any]:
    """Return read-only App Expert tools."""
    return [
        get_app_sitemap,
        search_app_sitemap,
        lookup_app_route,
        search_feature_registry,
        get_feature_details,
        get_help_article,
        get_app_expert_artifact_status,
    ]
