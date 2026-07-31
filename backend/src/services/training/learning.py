"""Pure learning policy for explainable training-resource discovery."""

from __future__ import annotations

import hashlib
import math
import re
from collections.abc import Iterable, Mapping, Sequence
from dataclasses import dataclass
from difflib import SequenceMatcher
from typing import Any
from urllib.parse import parse_qs, urlsplit

from src.services.agents.research_agent.tools import PublicWebSearchResult

DEFAULT_POLICY_VERSION = "feedback-ranking-v2"
DEFAULT_EXPLORATION_RATE = 0.15
NEAR_DUPLICATE_THRESHOLD = 0.9
ARCHIVED_MATCH_THRESHOLD = 0.82

DEFAULT_WEIGHTS: dict[str, float] = {
    "search": 0.2,
    "topicRelevance": 0.25,
    "approvedSimilarity": 0.2,
    "providerApproval": 0.15,
    "strategyApproval": 0.15,
    "contentDepth": 0.05,
    "archivedSimilarityPenalty": 0.35,
}

_TOKEN_PATTERN = re.compile(r"[a-z0-9]+")
_STOP_WORDS = {
    "about",
    "after",
    "and",
    "course",
    "from",
    "full",
    "into",
    "more",
    "that",
    "their",
    "this",
    "through",
    "training",
    "tutorial",
    "video",
    "with",
}


@dataclass(frozen=True)
class QueryStrategy:
    key: str
    query: str


@dataclass(frozen=True)
class CandidateFingerprint:
    canonical_url: str
    provider: str
    external_id: str | None
    content_fingerprint: str
    source: str
    title: str


@dataclass(frozen=True)
class CandidateScore:
    total: float
    features: dict[str, float]
    explanation: tuple[str, ...]


def _tokens(value: str) -> list[str]:
    return [
        token
        for token in _TOKEN_PATTERN.findall(value.lower())
        if len(token) >= 3 and token not in _STOP_WORDS
    ]


def _terms(value: str) -> set[str]:
    return {token.rstrip("s") for token in _tokens(value)}


def _bounded_rate(value: Any, default: float = 0.5) -> float:
    try:
        number = float(value)
    except (TypeError, ValueError):
        return default
    return min(1.0, max(0.0, number))


def extract_external_identity(canonical_url: str) -> tuple[str, str | None]:
    """Return a stable provider and external identifier when the URL exposes one."""

    parsed = urlsplit(canonical_url)
    provider = (parsed.hostname or "").lower().removeprefix("www.")
    if provider == "youtube.com" and parsed.path == "/watch":
        video_ids = parse_qs(parsed.query).get("v", [])
        return provider, video_ids[0] if video_ids and video_ids[0] else None
    return provider, None


def content_fingerprint(*parts: str) -> str:
    """Build a deterministic 64-bit SimHash from available title/content text."""

    tokens = _tokens(" ".join(part for part in parts if part))
    if not tokens:
        return "0" * 16

    features = tokens
    vector = [0] * 64
    for feature in features:
        digest = hashlib.blake2b(feature.encode("utf-8"), digest_size=8).digest()
        value = int.from_bytes(digest, "big")
        for bit in range(64):
            vector[bit] += 1 if value & (1 << bit) else -1

    fingerprint = 0
    for bit, weight in enumerate(vector):
        if weight >= 0:
            fingerprint |= 1 << bit
    return f"{fingerprint:016x}"


def fingerprint_similarity(left: str | None, right: str | None) -> float:
    if not left or not right or len(left) != 16 or len(right) != 16:
        return 0.0
    try:
        distance = (int(left, 16) ^ int(right, 16)).bit_count()
    except ValueError:
        return 0.0
    return 1.0 - (distance / 64.0)


def fingerprint_result(
    result: PublicWebSearchResult,
    canonical_url: str,
) -> CandidateFingerprint:
    provider, external_id = extract_external_identity(canonical_url)
    content_source = "raw_content" if result.raw_content.strip() else "search_evidence"
    return CandidateFingerprint(
        canonical_url=canonical_url,
        provider=provider,
        external_id=external_id,
        content_fingerprint=content_fingerprint(
            result.title,
            result.snippet,
            result.raw_content,
        ),
        source=content_source,
        title=result.title,
    )


def find_near_duplicate(
    candidate: CandidateFingerprint,
    existing: Sequence[Mapping[str, Any]],
    *,
    threshold: float = NEAR_DUPLICATE_THRESHOLD,
) -> tuple[Mapping[str, Any] | None, float, str | None]:
    """Find exact external identities or high-similarity content fingerprints."""

    best: Mapping[str, Any] | None = None
    best_score = 0.0
    best_reason: str | None = None
    for resource in existing:
        if (
            candidate.external_id
            and resource.get("provider") == candidate.provider
            and resource.get("external_id") == candidate.external_id
        ):
            return resource, 1.0, "duplicate_external_id"
        similarity = fingerprint_similarity(
            candidate.content_fingerprint,
            str(resource.get("content_fingerprint") or ""),
        )
        title_similarity = SequenceMatcher(
            None,
            " ".join(_tokens(candidate.title)),
            " ".join(_tokens(str(resource.get("title") or ""))),
        ).ratio()
        if title_similarity < 0.75:
            similarity = 0.0
        if similarity > best_score:
            best = resource
            best_score = similarity
            best_reason = "near_duplicate_content"
    if best_score >= threshold:
        return best, best_score, best_reason
    return None, best_score, None


def build_query_strategies(
    role: Mapping[str, Any],
    topic: Mapping[str, Any],
    trusted_providers: Iterable[str] = (),
) -> tuple[QueryStrategy, ...]:
    role_name = str(role["name"])
    topic_name = str(topic["name"])
    strategies = [
        QueryStrategy(
            key="role_topic_course",
            query=(
                f'site:youtube.com construction "{topic_name}" '
                f'"{role_name}" full course tutorial'
            ),
        ),
        QueryStrategy(
            key="field_problem_workflow",
            query=(
                f'site:youtube.com construction "{topic_name}" '
                f'workflow mistakes best practices "{role_name}"'
            ),
        ),
        QueryStrategy(
            key="recent_deep_dive",
            query=(
                f'site:youtube.com construction "{topic_name}" '
                f'advanced deep dive "{role_name}"'
            ),
        ),
    ]
    providers = [provider for provider in trusted_providers if provider][:2]
    if providers:
        provider_clause = " OR ".join(f"site:{provider}" for provider in providers)
        strategies.append(
            QueryStrategy(
                key="trusted_provider",
                query=(
                    f'({provider_clause}) construction "{topic_name}" "{role_name}"'
                ),
            )
        )
    return tuple(strategies)


def strategy_quality(stat: Mapping[str, Any] | None) -> float:
    """Bayesian approval estimate that remains stable with small samples."""

    if not stat:
        return 0.5
    reviewed = max(0, int(stat.get("reviewed_count") or 0))
    published = max(0, int(stat.get("published_count") or 0))
    return (published + 2.0) / (reviewed + 4.0)


def order_query_strategies(
    strategies: Sequence[QueryStrategy],
    stats: Sequence[Mapping[str, Any]],
    *,
    exploration_rate: float = DEFAULT_EXPLORATION_RATE,
    seed: str,
) -> tuple[QueryStrategy, ...]:
    by_key = {str(stat.get("strategy")): stat for stat in stats}
    ordered = sorted(
        strategies,
        key=lambda strategy: (
            -strategy_quality(by_key.get(strategy.key)),
            strategy.key,
        ),
    )
    if len(ordered) < 2 or exploration_rate <= 0:
        return tuple(ordered)

    fraction = int(hashlib.sha256(seed.encode("utf-8")).hexdigest()[:8], 16) / (
        16**8 - 1
    )
    if fraction < min(1.0, exploration_rate):
        least_observed = min(
            ordered,
            key=lambda strategy: (
                int((by_key.get(strategy.key) or {}).get("reviewed_count") or 0),
                strategy.key,
            ),
        )
        ordered.remove(least_observed)
        ordered.insert(0, least_observed)
    return tuple(ordered)


def allocate_search_budget(
    strategies: Sequence[QueryStrategy],
    max_results: int,
) -> dict[str, int]:
    """Allocate at least one result per selected strategy within the hard cap."""

    selected = list(strategies[: min(len(strategies), max_results)])
    if not selected:
        return {}
    base, remainder = divmod(max_results, len(selected))
    return {
        strategy.key: base + (1 if index < remainder else 0)
        for index, strategy in enumerate(selected)
    }


def _text_similarity(
    result: PublicWebSearchResult, example: Mapping[str, Any]
) -> float:
    candidate_terms = _terms(f"{result.title} {result.snippet}")
    example_terms = _terms(
        f"{example.get('title') or ''} {example.get('description') or ''}"
    )
    union = candidate_terms | example_terms
    return len(candidate_terms & example_terms) / len(union) if union else 0.0


def _best_similarity(
    result: PublicWebSearchResult,
    examples: Sequence[Mapping[str, Any]],
) -> float:
    return max((_text_similarity(result, example) for example in examples), default=0.0)


def _history_rate(
    stats: Sequence[Mapping[str, Any]],
    key_name: str,
    key: str,
) -> float:
    match = next((stat for stat in stats if str(stat.get(key_name)) == key), None)
    return strategy_quality(match)


def _feedback_adjusted_weights(
    weights: Mapping[str, float],
    reason_stats: Sequence[Mapping[str, Any]],
) -> tuple[dict[str, float], tuple[str, ...]]:
    adjusted = dict(weights)
    counts = {
        str(stat.get("reason_code")): max(
            0,
            int(stat.get("occurrence_count") or 0),
        )
        for stat in reason_stats
    }
    total = sum(counts.values())
    if total == 0:
        return adjusted, ()

    explanations: list[str] = []
    relevance_pressure = counts.get("wrong_role_topic", 0) / total
    depth_pressure = (counts.get("too_basic", 0) + counts.get("too_short", 0)) / total
    provider_pressure = (
        counts.get("poor_quality", 0) + counts.get("promotional", 0)
    ) / total
    if relevance_pressure:
        adjusted["topicRelevance"] += min(0.12, relevance_pressure * 0.2)
        explanations.append("review feedback increased role/topic scrutiny")
    if depth_pressure:
        adjusted["contentDepth"] += min(0.1, depth_pressure * 0.2)
        explanations.append("review feedback increased depth scrutiny")
    if provider_pressure:
        adjusted["providerApproval"] += min(0.08, provider_pressure * 0.15)
        explanations.append("review feedback increased provider scrutiny")
    return adjusted, tuple(explanations)


def score_candidate(
    result: PublicWebSearchResult,
    *,
    role: Mapping[str, Any],
    topic: Mapping[str, Any],
    strategy: str,
    provider: str,
    published_examples: Sequence[Mapping[str, Any]],
    archived_examples: Sequence[Mapping[str, Any]],
    strategy_stats: Sequence[Mapping[str, Any]],
    provider_stats: Sequence[Mapping[str, Any]],
    reason_stats: Sequence[Mapping[str, Any]] = (),
    weights: Mapping[str, Any] | None = None,
) -> CandidateScore:
    effective_weights = {
        **DEFAULT_WEIGHTS,
        **{
            key: float(value)
            for key, value in (weights or {}).items()
            if key in DEFAULT_WEIGHTS and isinstance(value, (int, float))
        },
    }
    effective_weights, feedback_explanations = _feedback_adjusted_weights(
        effective_weights,
        reason_stats,
    )
    topic_terms = _terms(f"{topic['name']} {topic['slug']}")
    role_terms = _terms(f"{role['name']} {role['slug']}")
    evidence_terms = _terms(f"{result.title} {result.snippet} {result.raw_content}")
    expected_terms = topic_terms | role_terms
    topic_relevance = (
        len(expected_terms & evidence_terms) / len(expected_terms)
        if expected_terms
        else 0.0
    )
    approved_similarity = _best_similarity(result, published_examples)
    archived_similarity = _best_similarity(result, archived_examples)
    provider_approval = _history_rate(provider_stats, "provider", provider)
    strategy_approval = _history_rate(strategy_stats, "strategy", strategy)
    depth = min(
        1.0,
        math.log1p(len(_tokens(f"{result.snippet} {result.raw_content}")))
        / math.log(501),
    )
    features = {
        "search": _bounded_rate(result.score),
        "topicRelevance": topic_relevance,
        "approvedSimilarity": approved_similarity,
        "providerApproval": provider_approval,
        "strategyApproval": strategy_approval,
        "contentDepth": depth,
        "archivedSimilarity": archived_similarity,
    }
    total = (
        features["search"] * effective_weights["search"]
        + features["topicRelevance"] * effective_weights["topicRelevance"]
        + features["approvedSimilarity"] * effective_weights["approvedSimilarity"]
        + features["providerApproval"] * effective_weights["providerApproval"]
        + features["strategyApproval"] * effective_weights["strategyApproval"]
        + features["contentDepth"] * effective_weights["contentDepth"]
        - features["archivedSimilarity"]
        * effective_weights["archivedSimilarityPenalty"]
    )
    explanation = [
        f"{round(features['topicRelevance'] * 100)}% role/topic evidence",
        f"{round(features['strategyApproval'] * 100)}% strategy approval estimate",
        f"{round(features['providerApproval'] * 100)}% provider approval estimate",
    ]
    if approved_similarity:
        explanation.append(
            f"{round(approved_similarity * 100)}% similar to approved resources"
        )
    if archived_similarity:
        explanation.append(
            f"{round(archived_similarity * 100)}% similar to archived resources"
        )
    explanation.extend(feedback_explanations)
    return CandidateScore(
        total=round(min(1.0, max(0.0, total)), 4),
        features={key: round(value, 4) for key, value in features.items()},
        explanation=tuple(explanation),
    )
