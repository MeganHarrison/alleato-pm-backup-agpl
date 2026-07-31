"""Deterministic free-only training resource discovery and review insertion."""

from __future__ import annotations

import re
from collections.abc import Callable
from dataclasses import dataclass
from datetime import datetime, timezone
from difflib import SequenceMatcher
from typing import Any, Protocol
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit

from src.services.agents.research_agent.tools import (
    PublicWebSearchError,
    PublicWebSearchResult,
    search_public_web,
)
from src.services.supabase_helpers import get_supabase_client
from src.services.training.contracts import (
    TrainingFinderCandidateOutcome,
    TrainingFinderRequest,
    TrainingFinderResponse,
)
from src.services.training.learning import (
    ARCHIVED_MATCH_THRESHOLD,
    DEFAULT_EXPLORATION_RATE,
    DEFAULT_POLICY_VERSION,
    allocate_search_budget,
    build_query_strategies,
    find_near_duplicate,
    fingerprint_result,
    order_query_strategies,
    score_candidate,
)


class TrainingResourceFinderError(RuntimeError):
    """Named fatal finder error with operation context."""


class TrainingRepository(Protocol):
    def resolve_role(self, slug: str) -> dict[str, Any]: ...

    def resolve_topic(self, slug: str) -> dict[str, Any]: ...

    def list_resource_urls(self) -> list[str]: ...

    def list_review_examples(self, topic_id: str) -> list[dict[str, Any]]: ...

    def get_learning_context(
        self,
        role_id: str,
        topic_id: str,
    ) -> dict[str, Any]: ...

    def start_discovery_run(self, payload: dict[str, Any]) -> str: ...

    def record_discovery_candidate(self, payload: dict[str, Any]) -> str: ...

    def complete_discovery_run(
        self,
        run_id: str,
        payload: dict[str, Any],
    ) -> None: ...

    def create_review_candidate_with_evidence(
        self,
        resource_payload: dict[str, Any],
        candidate_payload: dict[str, Any],
        fingerprint_payload: dict[str, Any],
    ) -> tuple[str, str]: ...


@dataclass(frozen=True)
class _DiscoveredResult:
    result: PublicWebSearchResult
    strategy: str
    original_rank: int
    score: float
    features: dict[str, float]
    explanation: tuple[str, ...]


TRACKING_QUERY_KEYS = {
    "fbclid",
    "gclid",
    "mc_cid",
    "mc_eid",
    "ref",
    "ref_src",
    "source",
}
FREE_HOSTS = {
    "youtube.com",
    "youtu.be",
    "vimeo.com",
}
DEPTH_CUES = (
    "complete",
    "comprehensive",
    "course",
    "deep dive",
    "full",
    "guide",
    "masterclass",
    "training",
    "tutorial",
    "walkthrough",
    "webinar",
)
FREE_CUES = (
    "free course",
    "free guide",
    "free training",
    "free tutorial",
    "no cost",
    "open access",
)
CONSTRUCTION_CUES = (
    "builder",
    "building",
    "construction",
    "contractor",
    "crew",
    "field",
    "jobsite",
    "job site",
    "subcontractor",
    "superintendent",
    "trade partner",
)
RELEVANCE_STOP_WORDS = {
    "and",
    "assistant",
    "for",
    "management",
    "project",
    "requests",
    "the",
    "with",
}
SCHEDULED_TOPIC_RELEVANCE_PHRASES = {
    "buyout-writing-scopes-of-work": (
        "buyout",
        "scope of work",
        "scopes of work",
    ),
    "look-aheads-pull-planning": (
        "look ahead",
        "lookahead",
        "pull planning",
    ),
    "procurement-the-procurement-log": ("procurement",),
    "project-scheduling": (
        "construction schedule",
        "critical path",
        "cpm schedule",
        "project schedule",
        "scheduling",
    ),
    "safety-management": (
        "construction safety",
        "job site safety",
        "jobsite safety",
        "osha",
        "safety",
    ),
    "submittal-review-management": ("submittal",),
}
PAID_PATTERN = re.compile(
    r"(?:[$£€]\s*\d|\b(?:buy now|paid course|purchase required|"
    r"subscription required|pricing plan|members only)\b)",
    re.IGNORECASE,
)
FIELD_ROLE_SLUGS = {
    "assistant-superintendent",
    "foreman",
    "general-foreman",
    "superintendent",
}


def canonicalize_resource_url(raw_url: str) -> str:
    """Canonicalize a public resource URL for same-run and database dedupe."""

    candidate = raw_url.strip()
    parsed = urlsplit(candidate)
    if parsed.scheme.lower() not in {"http", "https"} or not parsed.hostname:
        raise ValueError("resource URL must be absolute http/https")

    # Public training resources use one HTTPS identity so scheme-only variants
    # cannot bypass canonical URL deduplication.
    scheme = "https"
    host = parsed.hostname.lower().rstrip(".")
    host = host.removeprefix("www.")
    if host in {"m.youtube.com", "music.youtube.com"}:
        host = "youtube.com"

    port = parsed.port
    netloc = host
    if port and port not in {80, 443}:
        netloc = f"{host}:{port}"

    path = re.sub(r"/{2,}", "/", parsed.path or "/")
    query_items = [
        (key, value)
        for key, value in parse_qsl(parsed.query, keep_blank_values=True)
        if not key.lower().startswith("utm_") and key.lower() not in TRACKING_QUERY_KEYS
    ]

    if host == "youtu.be":
        video_id = path.strip("/").split("/", 1)[0]
        if video_id:
            host = "youtube.com"
            netloc = host
            path = "/watch"
            query_items = [("v", video_id)]
    elif host == "youtube.com":
        short_match = re.match(r"^/(?:shorts|embed)/([^/?]+)", path)
        if short_match:
            path = "/watch"
            query_items = [("v", short_match.group(1))]
        elif path == "/watch":
            video_ids = [value for key, value in query_items if key == "v" and value]
            query_items = [("v", video_ids[0])] if video_ids else []

    if path != "/":
        path = path.rstrip("/")
    normalized_query = urlencode(sorted(query_items))
    return urlunsplit((scheme, netloc, path, normalized_query, ""))


def _host_for_url(url: str) -> str:
    return (urlsplit(url).hostname or "").lower().removeprefix("www.")


def _word_count(value: str) -> int:
    return len(re.findall(r"\b[\w'-]+\b", value))


def _relevance_terms(value: str) -> set[str]:
    return {
        token.rstrip("s")
        for token in re.findall(r"[a-z0-9]+", value.lower())
        if len(token) >= 4 and token not in RELEVANCE_STOP_WORDS
    }


def _normalize_relevance_text(value: str) -> str:
    return " ".join(re.findall(r"[a-z0-9]+", value.lower()))


def _review_example_similarity(
    result: PublicWebSearchResult,
    example: dict[str, Any],
) -> float:
    candidate_title = _normalize_relevance_text(result.title)
    example_title = _normalize_relevance_text(str(example.get("title") or ""))
    if not candidate_title or not example_title:
        return 0.0

    title_similarity = SequenceMatcher(
        None,
        candidate_title,
        example_title,
    ).ratio()
    candidate_terms = _relevance_terms(f"{result.title} {result.snippet}")
    example_terms = _relevance_terms(
        f"{example.get('title') or ''} {example.get('description') or ''}"
    )
    union = candidate_terms | example_terms
    term_similarity = (
        len(candidate_terms & example_terms) / len(union) if union else 0.0
    )
    return max(title_similarity, term_similarity)


def _best_review_example_match(
    result: PublicWebSearchResult,
    examples: list[dict[str, Any]],
) -> tuple[float, dict[str, Any] | None]:
    best_score = 0.0
    best_example: dict[str, Any] | None = None
    for example in examples:
        score = _review_example_similarity(result, example)
        if score > best_score:
            best_score = score
            best_example = example
    return best_score, best_example


def _resource_type(result: PublicWebSearchResult, canonical_url: str) -> str:
    host = _host_for_url(canonical_url)
    path = urlsplit(canonical_url).path.lower()
    text = f"{result.title} {result.snippet}".lower()
    if host in FREE_HOSTS or "video" in text or "webinar" in text:
        return "video"
    if path.endswith(".pdf") or "document" in text or "guide" in text:
        return "doc"
    if "course" in text or "academy" in host or "training" in path:
        return "course"
    return "doc"


def _track_for_role(role_slug: str) -> str:
    if role_slug in FIELD_ROLE_SLUGS or "superintendent" in role_slug:
        return "field"
    if role_slug in {
        "assistant-project-manager",
        "estimator",
        "project-engineer",
        "project-manager",
    }:
        return "pm"
    return "both"


def _eligibility(
    result: PublicWebSearchResult,
    canonical_url: str,
    *,
    role: dict[str, Any],
    topic: dict[str, Any],
) -> tuple[bool, str, str]:
    host = _host_for_url(canonical_url)
    evidence = f"{result.title} {result.snippet} {result.raw_content}".lower()
    if host == "procore.com" or host.endswith(".procore.com") or "procore" in evidence:
        return False, "procore_excluded", "Procore resources are excluded by policy."
    if PAID_PATTERN.search(evidence):
        return (
            False,
            "paid_resource",
            "Paid or access-restricted language was detected.",
        )

    free_evidence = host in FREE_HOSTS or any(cue in evidence for cue in FREE_CUES)
    if not free_evidence:
        return (
            False,
            "free_access_unproven",
            "The search result does not prove that the resource is free to access.",
        )

    raw_words = _word_count(result.raw_content)
    snippet_words = _word_count(result.snippet)
    has_depth_cue = any(cue in evidence for cue in DEPTH_CUES)
    is_video_host = host in FREE_HOSTS
    sufficiently_deep = (
        raw_words >= 180
        or (has_depth_cue and snippet_words >= 35)
        or (is_video_host and has_depth_cue and snippet_words >= 12)
    )
    if not sufficiently_deep:
        return (
            False,
            "insufficient_depth",
            "The result lacks enough readable content or depth evidence.",
        )

    role_terms = _relevance_terms(f"{role['name']} {role['slug']}")
    has_domain_context = any(cue in evidence for cue in CONSTRUCTION_CUES) or any(
        term in evidence for term in role_terms
    )
    normalized_evidence = _normalize_relevance_text(evidence)
    configured_topic_phrases = SCHEDULED_TOPIC_RELEVANCE_PHRASES.get(str(topic["slug"]))
    if configured_topic_phrases:
        has_topic_context = any(
            phrase in normalized_evidence for phrase in configured_topic_phrases
        )
    else:
        topic_terms = _relevance_terms(f"{topic['name']} {topic['slug']}")
        has_topic_context = any(term in evidence for term in topic_terms)
    if not has_domain_context or not has_topic_context:
        return (
            False,
            "irrelevant_result",
            "The result does not demonstrate both construction-role and topic relevance.",
        )
    return (
        True,
        "eligible",
        "Free-access and depth evidence passed deterministic checks.",
    )


def _candidate_payload(
    *,
    result: PublicWebSearchResult,
    canonical_url: str,
    role: dict[str, Any],
    topic: dict[str, Any],
    query: str,
    review_feedback: dict[str, Any],
    learning: dict[str, Any],
) -> dict[str, Any]:
    description_source = result.snippet or result.raw_content
    description = description_source[:700].strip() or None
    return {
        "p_topic_id": topic["id"],
        "p_title": result.title[:300].strip(),
        "p_url": canonical_url,
        "p_resource_type": _resource_type(result, canonical_url),
        "p_level": "deep-dive",
        "p_track": _track_for_role(str(role["slug"])),
        "p_role_ids": [role["id"]],
        "p_description": description,
        "p_embed_url": None,
        "p_thumbnail_url": None,
        "p_provider": _host_for_url(canonical_url),
        "p_duration_minutes": None,
        "p_source_attribution": "Training Resource Finder via Tavily",
        "p_metadata": {
            "finder": {
                "provider": "tavily",
                "query": query,
                "score": result.score,
                "originalUrl": result.url,
                "roleSlug": role["slug"],
                "topicSlug": topic["slug"],
                "vettedAt": datetime.now(timezone.utc).isoformat(),
                "freeOnlyPolicy": "deterministic-v1",
                "depthPolicy": "deterministic-v1",
                "reviewFeedback": review_feedback,
                "learning": learning,
            }
        },
    }


class SupabaseTrainingRepository:
    """Service-role adapter constrained to reads plus the candidate RPC."""

    def __init__(self, client: Any | None = None):
        self._client = client or get_supabase_client()

    def _resolve_taxonomy_row(self, table: str, slug: str) -> dict[str, Any]:
        try:
            rows = (
                self._client.table(table)
                .select("id,slug,name")
                .eq("slug", slug)
                .eq("active", True)
                .limit(2)
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_TAXONOMY_LOOKUP_FAILED: {table} slug '{slug}': {exc}"
            ) from exc
        if len(rows) != 1:
            raise TrainingResourceFinderError(
                f"TRAINING_TAXONOMY_NOT_FOUND: active {table} slug '{slug}' was not found."
            )
        return dict(rows[0])

    def resolve_role(self, slug: str) -> dict[str, Any]:
        return self._resolve_taxonomy_row("training_role", slug)

    def resolve_topic(self, slug: str) -> dict[str, Any]:
        return self._resolve_taxonomy_row("training_topic", slug)

    def list_resource_urls(self) -> list[str]:
        urls: list[str] = []
        page_size = 1000
        try:
            for offset in range(0, 100_000, page_size):
                rows = (
                    self._client.table("training_resource")
                    .select("url")
                    .range(offset, offset + page_size - 1)
                    .execute()
                    .data
                    or []
                )
                urls.extend(
                    str(row["url"])
                    for row in rows
                    if isinstance(row, dict) and row.get("url")
                )
                if len(rows) < page_size:
                    break
            else:
                raise TrainingResourceFinderError(
                    "TRAINING_RESOURCE_READ_FAILED: URL pagination exceeded 100000 rows."
                )
        except TrainingResourceFinderError:
            raise
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_RESOURCE_READ_FAILED: existing URL query failed: {exc}"
            ) from exc
        return urls

    def list_review_examples(self, topic_id: str) -> list[dict[str, Any]]:
        try:
            rows = (
                self._client.table("training_resource")
                .select(
                    "id,title,description,provider,status,reviewer_notes,url,updated_at"
                )
                .eq("topic_id", topic_id)
                .in_("status", ["published", "archived"])
                .order("updated_at", desc=True)
                .limit(100)
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                "TRAINING_REVIEW_FEEDBACK_READ_FAILED: reviewer example query "
                f"failed for topic '{topic_id}': {exc}"
            ) from exc
        return [dict(row) for row in rows if isinstance(row, dict)]

    def get_learning_context(
        self,
        role_id: str,
        topic_id: str,
    ) -> dict[str, Any]:
        try:
            result = (
                self._client.rpc(
                    "get_training_discovery_context",
                    {
                        "p_role_id": role_id,
                        "p_topic_id": topic_id,
                    },
                )
                .execute()
                .data
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_DISCOVERY_CONTEXT_FAILED: learning context RPC failed: {exc}"
            ) from exc
        if not isinstance(result, dict) or not isinstance(result.get("policy"), dict):
            raise TrainingResourceFinderError(
                "TRAINING_DISCOVERY_CONTEXT_FAILED: learning context did not "
                "return an active policy."
            )
        return dict(result)

    def start_discovery_run(self, payload: dict[str, Any]) -> str:
        try:
            rows = (
                self._client.table("training_discovery_run")
                .insert(payload)
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_DISCOVERY_RUN_START_FAILED: {exc}"
            ) from exc
        if len(rows) != 1 or not rows[0].get("id"):
            raise TrainingResourceFinderError(
                "TRAINING_DISCOVERY_RUN_START_FAILED: insert returned no run id."
            )
        return str(rows[0]["id"])

    def record_discovery_candidate(self, payload: dict[str, Any]) -> str:
        try:
            rows = (
                self._client.table("training_discovery_candidate")
                .insert(payload)
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_DISCOVERY_CANDIDATE_AUDIT_FAILED: {exc}"
            ) from exc
        if len(rows) != 1 or not rows[0].get("id"):
            raise TrainingResourceFinderError(
                "TRAINING_DISCOVERY_CANDIDATE_AUDIT_FAILED: insert returned no candidate id."
            )
        return str(rows[0]["id"])

    def complete_discovery_run(
        self,
        run_id: str,
        payload: dict[str, Any],
    ) -> None:
        try:
            rows = (
                self._client.table("training_discovery_run")
                .update(payload)
                .eq("id", run_id)
                .eq("status", "running")
                .execute()
                .data
                or []
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_DISCOVERY_RUN_COMPLETE_FAILED: {exc}"
            ) from exc
        if len(rows) != 1:
            raise TrainingResourceFinderError(
                "TRAINING_DISCOVERY_RUN_COMPLETE_FAILED: running audit row was not updated."
            )

    def create_review_candidate_with_evidence(
        self,
        resource_payload: dict[str, Any],
        candidate_payload: dict[str, Any],
        fingerprint_payload: dict[str, Any],
    ) -> tuple[str, str]:
        try:
            result = (
                self._client.rpc(
                    "create_training_discovery_review_candidate_locked",
                    {
                        "p_resource": resource_payload,
                        "p_candidate": candidate_payload,
                        "p_fingerprint": fingerprint_payload,
                    },
                )
                .execute()
                .data
            )
        except Exception as exc:
            raise TrainingResourceFinderError(
                "TRAINING_RESOURCE_INSERT_FAILED: atomic candidate evidence "
                f"RPC failed: {exc}"
            ) from exc
        if (
            not isinstance(result, dict)
            or not result.get("resourceId")
            or not result.get("candidateId")
        ):
            raise TrainingResourceFinderError(
                "TRAINING_RESOURCE_INSERT_FAILED: atomic candidate evidence "
                "RPC returned an invalid receipt."
            )
        return str(result["resourceId"]), str(result["candidateId"])


def _run_training_resource_finder_impl(
    request: TrainingFinderRequest,
    *,
    repository: TrainingRepository | None = None,
    searcher: Callable[..., list[PublicWebSearchResult]] = search_public_web,
    _run_tracker: dict[str, Any],
) -> TrainingFinderResponse:
    """Find, learn-rank, deduplicate, and optionally insert review candidates."""

    if repository is not None:
        repo = repository
    else:
        try:
            repo = SupabaseTrainingRepository()
        except TrainingResourceFinderError:
            raise
        except Exception as exc:
            raise TrainingResourceFinderError(
                "TRAINING_RESOURCE_CONFIGURATION_FAILED: Supabase client "
                f"initialization failed: {exc}"
            ) from exc
    _run_tracker["repository"] = repo

    role = repo.resolve_role(request.role_slug)
    topic = repo.resolve_topic(request.topic_slug)
    review_examples = repo.list_review_examples(str(topic["id"]))
    published_examples = [
        example for example in review_examples if example.get("status") == "published"
    ]
    archived_examples = [
        example for example in review_examples if example.get("status") == "archived"
    ]
    learning_context = repo.get_learning_context(
        str(role["id"]),
        str(topic["id"]),
    )
    policy = learning_context["policy"]
    policy_id = str(policy.get("id") or "")
    policy_version = str(policy.get("version") or DEFAULT_POLICY_VERSION)
    if not policy_id:
        raise TrainingResourceFinderError(
            "TRAINING_DISCOVERY_CONTEXT_FAILED: active policy has no id."
        )

    strategies = order_query_strategies(
        build_query_strategies(
            role,
            topic,
            learning_context.get("trustedProviders") or (),
        ),
        learning_context.get("strategyStats") or (),
        exploration_rate=float(
            policy.get("explorationRate") or DEFAULT_EXPLORATION_RATE
        ),
        seed=(
            f"{request.role_slug}:{request.topic_slug}:"
            f"{datetime.now(timezone.utc).date().isocalendar()[:2]}"
        ),
    )
    search_budget = allocate_search_budget(strategies, request.max_search_results)
    query_plan = [
        {
            "strategy": strategy.key,
            "query": strategy.query,
            "maxResults": search_budget.get(strategy.key, 0),
        }
        for strategy in strategies
        if search_budget.get(strategy.key, 0) > 0
    ]
    if not query_plan:
        raise TrainingResourceFinderError(
            "TRAINING_DISCOVERY_QUERY_PLAN_FAILED: no query received search budget."
        )
    primary_query = str(query_plan[0]["query"])
    run_id: str | None = None
    if not request.dry_run:
        run_id = repo.start_discovery_run(
            {
                "role_id": role["id"],
                "topic_id": topic["id"],
                "policy_id": policy_id,
                "trigger_source": request.trigger_source,
                "query_plan": query_plan,
                "limits": {
                    "maxSearchResults": request.max_search_results,
                    "maxInserts": request.max_inserts,
                },
            }
        )
        _run_tracker["run_id"] = run_id

    discovered: list[tuple[PublicWebSearchResult, str, int]] = []
    for strategy in strategies:
        budget = search_budget.get(strategy.key, 0)
        if budget <= 0:
            continue
        try:
            results = searcher(
                strategy.query,
                budget,
                search_depth="advanced",
                include_raw_content=True,
            )
        except PublicWebSearchError as exc:
            raise TrainingResourceFinderError(
                f"TRAINING_RESOURCE_SEARCH_FAILED [{strategy.key}]: {exc}"
            ) from exc
        except Exception as exc:
            raise TrainingResourceFinderError(
                "TRAINING_RESOURCE_SEARCH_FAILED "
                f"[{strategy.key}]: unexpected search error: {exc}"
            ) from exc
        discovered.extend(
            (result, strategy.key, rank)
            for rank, result in enumerate(results[:budget], start=1)
        )
        _run_tracker["searched"] = len(discovered)

    scored_results: list[_DiscoveredResult] = []
    for result, strategy, original_rank in discovered:
        try:
            canonical_url = canonicalize_resource_url(result.url)
            provider = _host_for_url(canonical_url)
        except (TypeError, ValueError):
            provider = ""
        learned_score = score_candidate(
            result,
            role=role,
            topic=topic,
            strategy=strategy,
            provider=provider,
            published_examples=published_examples,
            archived_examples=archived_examples,
            strategy_stats=learning_context.get("strategyStats") or (),
            provider_stats=learning_context.get("providerStats") or (),
            reason_stats=learning_context.get("reasonStats") or (),
            weights=policy.get("weights") or {},
        )
        scored_results.append(
            _DiscoveredResult(
                result=result,
                strategy=strategy,
                original_rank=original_rank,
                score=learned_score.total,
                features=learned_score.features,
                explanation=learned_score.explanation,
            )
        )
    scored_results.sort(
        key=lambda candidate: (
            -candidate.score,
            candidate.strategy,
            candidate.original_rank,
        )
    )

    existing_urls: set[str] = set()
    for existing_url in repo.list_resource_urls():
        try:
            existing_urls.add(canonicalize_resource_url(existing_url))
        except ValueError as exc:
            raise TrainingResourceFinderError(
                "TRAINING_RESOURCE_READ_FAILED: existing resource contains an "
                f"invalid URL '{existing_url}': {exc}"
            ) from exc

    existing_fingerprints: list[dict[str, Any]] = [
        dict(item)
        for item in learning_context.get("fingerprints") or ()
        if isinstance(item, dict)
    ]
    seen_urls: set[str] = set()
    outcomes: list[TrainingFinderCandidateOutcome] = []
    accepted_count = 0
    inserted_count = 0
    duplicate_count = 0
    rejected_count = 0
    failed_count = 0

    def audit_payload(
        *,
        candidate: _DiscoveredResult,
        learned_rank: int,
        decision: str,
        reason_code: str,
        detail: str,
        canonical_url: str | None = None,
        fingerprint: Any | None = None,
        resource_id: str | None = None,
        duplicate_resource_id: str | None = None,
    ) -> dict[str, Any]:
        return {
            "run_id": run_id,
            "resource_id": resource_id,
            "title": candidate.result.title[:300],
            "canonical_url": canonical_url,
            "provider": fingerprint.provider if fingerprint else None,
            "external_id": fingerprint.external_id if fingerprint else None,
            "strategy": candidate.strategy,
            "original_rank": candidate.original_rank,
            "learned_rank": learned_rank,
            "score": candidate.score,
            "decision": decision,
            "reason_code": reason_code,
            "detail": detail[:2000],
            "features": candidate.features,
            "explanation": list(candidate.explanation),
            "content_fingerprint": (
                fingerprint.content_fingerprint if fingerprint else None
            ),
            "fingerprint_source": fingerprint.source if fingerprint else None,
            "duplicate_resource_id": duplicate_resource_id,
        }

    def audit(
        *,
        candidate: _DiscoveredResult,
        learned_rank: int,
        decision: str,
        reason_code: str,
        detail: str,
        canonical_url: str | None = None,
        fingerprint: Any | None = None,
        resource_id: str | None = None,
        duplicate_resource_id: str | None = None,
    ) -> str | None:
        if not run_id:
            return None
        payload = audit_payload(
            candidate=candidate,
            learned_rank=learned_rank,
            decision=decision,
            reason_code=reason_code,
            detail=detail,
            canonical_url=canonical_url,
            fingerprint=fingerprint,
            resource_id=resource_id,
            duplicate_resource_id=duplicate_resource_id,
        )
        return repo.record_discovery_candidate(payload)

    for learned_rank, candidate in enumerate(scored_results, start=1):
        result = candidate.result
        try:
            canonical_url = canonicalize_resource_url(result.url)
        except (TypeError, ValueError) as exc:
            rejected_count += 1
            detail = f"Invalid search result URL: {exc}"
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="rejected",
                reason_code="invalid_url",
                detail=detail,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=result.url or None,
                    decision="rejected",
                    reasonCode="invalid_url",
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue

        fingerprint = fingerprint_result(result, canonical_url)
        if canonical_url in existing_urls or canonical_url in seen_urls:
            duplicate_count += 1
            detail = "Canonical URL already exists in the library or this run."
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="duplicate",
                reason_code="duplicate_url",
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="duplicate",
                    reasonCode="duplicate_url",
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue
        seen_urls.add(canonical_url)

        duplicate, duplicate_score, duplicate_reason = find_near_duplicate(
            fingerprint,
            existing_fingerprints,
        )
        if duplicate and duplicate_reason:
            duplicate_count += 1
            duplicate_resource_id = str(duplicate.get("resource_id") or "") or None
            detail = (
                "Candidate matches an existing resource "
                f"({round(duplicate_score * 100)}% identity/content similarity)."
            )
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="duplicate",
                reason_code=duplicate_reason,
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
                duplicate_resource_id=duplicate_resource_id,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="duplicate",
                    reasonCode=duplicate_reason,
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue

        eligible, reason_code, detail = _eligibility(
            result,
            canonical_url,
            role=role,
            topic=topic,
        )
        if not eligible:
            rejected_count += 1
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="rejected",
                reason_code=reason_code,
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="rejected",
                    reasonCode=reason_code,
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue

        archived_match_score, archived_match = _best_review_example_match(
            result,
            archived_examples,
        )
        if archived_match_score >= ARCHIVED_MATCH_THRESHOLD:
            rejected_count += 1
            reviewer_notes = str(
                (archived_match or {}).get("reviewer_notes") or ""
            ).strip()
            feedback_detail = (
                f" Reviewer feedback: {reviewer_notes}" if reviewer_notes else ""
            )
            detail = (
                "The candidate closely matches a resource an admin "
                f"archived.{feedback_detail}"
            )
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="rejected",
                reason_code="review_feedback_negative_match",
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="rejected",
                    reasonCode="review_feedback_negative_match",
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue
        if accepted_count >= request.max_inserts:
            rejected_count += 1
            detail = "Eligible result exceeded the configured per-run insert limit."
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="rejected",
                reason_code="insert_limit",
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="rejected",
                    reasonCode="insert_limit",
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue

        accepted_count += 1
        if request.dry_run:
            existing_fingerprints.append(
                {
                    "resource_id": None,
                    "title": result.title,
                    "provider": fingerprint.provider,
                    "external_id": fingerprint.external_id,
                    "content_fingerprint": fingerprint.content_fingerprint,
                }
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="would_insert",
                    reasonCode="eligible_dry_run",
                    detail="Eligible candidate; dry-run prevented database writes.",
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
            continue

        payload = _candidate_payload(
            result=result,
            canonical_url=canonical_url,
            role=role,
            topic=topic,
            query=next(
                item["query"]
                for item in query_plan
                if item["strategy"] == candidate.strategy
            ),
            review_feedback={
                "policy": "structured-review-v2",
                "publishedExamples": len(published_examples),
                "archivedExamples": len(archived_examples),
                "positiveMatchScore": round(
                    _best_review_example_match(result, published_examples)[0],
                    3,
                ),
            },
            learning={
                "policyVersion": policy_version,
                "runId": run_id,
                "strategy": candidate.strategy,
                "score": candidate.score,
                "features": candidate.features,
                "explanation": list(candidate.explanation),
                "fingerprint": fingerprint.content_fingerprint,
                "fingerprintSource": fingerprint.source,
                "externalId": fingerprint.external_id,
            },
        )
        try:
            detail = "Review candidate created with learned evidence and fingerprint."
            resource_id, candidate_id = repo.create_review_candidate_with_evidence(
                payload,
                audit_payload(
                    candidate=candidate,
                    learned_rank=learned_rank,
                    decision="inserted",
                    reason_code="review_candidate_created",
                    detail=detail,
                    canonical_url=canonical_url,
                    fingerprint=fingerprint,
                ),
                {
                    "canonical_url": canonical_url,
                    "provider": fingerprint.provider,
                    "external_id": fingerprint.external_id,
                    "content_fingerprint": fingerprint.content_fingerprint,
                    "fingerprint_source": fingerprint.source,
                    "evidence": {
                        "runId": run_id,
                        "strategy": candidate.strategy,
                    },
                },
            )
            inserted_count += 1
            existing_urls.add(canonical_url)
            existing_fingerprints.append(
                {
                    "resource_id": resource_id,
                    "title": result.title,
                    "provider": fingerprint.provider,
                    "external_id": fingerprint.external_id,
                    "content_fingerprint": fingerprint.content_fingerprint,
                }
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="inserted",
                    reasonCode="review_candidate_created",
                    detail=detail,
                    resourceId=resource_id,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )
        except Exception as exc:  # noqa: BLE001 - one bad candidate must not abort its run
            detail = str(exc)
            if "TRAINING_RESOURCE_DUPLICATE" in detail:
                accepted_count -= 1
                duplicate_count += 1
                candidate_id = audit(
                    candidate=candidate,
                    learned_rank=learned_rank,
                    decision="duplicate",
                    reason_code="duplicate_concurrent",
                    detail=detail,
                    canonical_url=canonical_url,
                    fingerprint=fingerprint,
                )
                outcomes.append(
                    TrainingFinderCandidateOutcome(
                        title=result.title,
                        url=canonical_url,
                        decision="duplicate",
                        reasonCode="duplicate_concurrent",
                        detail=detail,
                        candidateId=candidate_id,
                        strategy=candidate.strategy,
                        score=candidate.score,
                        explanation=list(candidate.explanation),
                    )
                )
                continue
            failed_count += 1
            candidate_id = audit(
                candidate=candidate,
                learned_rank=learned_rank,
                decision="failed",
                reason_code="insert_failed",
                detail=detail,
                canonical_url=canonical_url,
                fingerprint=fingerprint,
            )
            outcomes.append(
                TrainingFinderCandidateOutcome(
                    title=result.title,
                    url=canonical_url,
                    decision="failed",
                    reasonCode="insert_failed",
                    detail=detail,
                    candidateId=candidate_id,
                    strategy=candidate.strategy,
                    score=candidate.score,
                    explanation=list(candidate.explanation),
                )
            )

    status = "completed"
    if failed_count:
        status = "partial" if inserted_count else "failed"
    counts = {
        "searched": len(scored_results),
        "accepted": accepted_count,
        "inserted": inserted_count,
        "duplicates": duplicate_count,
        "rejected": rejected_count,
        "failed": failed_count,
    }
    if run_id:
        repo.complete_discovery_run(
            run_id,
            {
                "status": status,
                "completed_at": datetime.now(timezone.utc).isoformat(),
                "counts": counts,
                "error": (
                    "One or more candidate writes failed; inspect candidate outcomes."
                    if failed_count
                    else None
                ),
            },
        )
        _run_tracker["terminalized"] = True
    return TrainingFinderResponse(
        status=status,
        query=primary_query,
        queries=query_plan,
        runId=run_id,
        policyVersion=policy_version,
        roleSlug=request.role_slug,
        topicSlug=request.topic_slug,
        dryRun=request.dry_run,
        searchedCount=len(scored_results),
        acceptedCount=accepted_count,
        insertedCount=inserted_count,
        duplicateCount=duplicate_count,
        rejectedCount=rejected_count,
        failedCount=failed_count,
        outcomes=outcomes,
    )


def run_training_resource_finder(
    request: TrainingFinderRequest,
    *,
    repository: TrainingRepository | None = None,
    searcher: Callable[..., list[PublicWebSearchResult]] = search_public_web,
) -> TrainingFinderResponse:
    """Run discovery and guarantee that every committed run reaches a terminal state."""

    run_tracker: dict[str, Any] = {
        "run_id": None,
        "repository": None,
        "searched": 0,
        "terminalized": False,
    }
    try:
        return _run_training_resource_finder_impl(
            request,
            repository=repository,
            searcher=searcher,
            _run_tracker=run_tracker,
        )
    except Exception as exc:
        run_id = run_tracker.get("run_id")
        repo = run_tracker.get("repository")
        if run_id and repo and not run_tracker.get("terminalized"):
            try:
                repo.complete_discovery_run(
                    str(run_id),
                    {
                        "status": "failed",
                        "completed_at": datetime.now(timezone.utc).isoformat(),
                        "counts": {
                            "searched": int(run_tracker.get("searched") or 0),
                        },
                        "error": str(exc)[:2000],
                    },
                )
                run_tracker["terminalized"] = True
            except Exception as terminal_error:
                raise TrainingResourceFinderError(
                    "TRAINING_DISCOVERY_RUN_TERMINALIZATION_FAILED: "
                    f"original failure: {exc}; terminal audit failure: "
                    f"{terminal_error}"
                ) from terminal_error
        raise
