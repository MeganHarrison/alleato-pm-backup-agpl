"""Pure-policy tests for self-improving training discovery."""

from __future__ import annotations

from src.services.agents.research_agent.tools import PublicWebSearchResult
from src.services.training.learning import (
    allocate_search_budget,
    build_query_strategies,
    content_fingerprint,
    extract_external_identity,
    find_near_duplicate,
    fingerprint_result,
    fingerprint_similarity,
    order_query_strategies,
    score_candidate,
)


def result(
    title: str = "Construction Scheduling Deep Dive",
    snippet: str = "Critical path schedules and look-ahead planning for project managers.",
    raw_content: str = "",
) -> PublicWebSearchResult:
    return PublicWebSearchResult(
        title=title,
        url="https://youtube.com/watch?v=video-1",
        snippet=snippet,
        raw_content=raw_content,
        score=0.9,
    )


def test_fingerprints_match_reordered_near_duplicate_content():
    left = content_fingerprint(
        "Construction scheduling course",
        "Critical path look-ahead planning schedule recovery field coordination",
    )
    right = content_fingerprint(
        "Construction scheduling course",
        "Field coordination schedule recovery and critical path look-ahead planning",
    )

    assert fingerprint_similarity(left, right) >= 0.9


def test_external_identity_detects_same_youtube_video():
    provider, external_id = extract_external_identity(
        "https://youtube.com/watch?v=abc123"
    )
    candidate = fingerprint_result(
        result(),
        "https://youtube.com/watch?v=abc123",
    )
    match, score, reason = find_near_duplicate(
        candidate,
        [
            {
                "provider": provider,
                "external_id": external_id,
                "content_fingerprint": "0" * 16,
            }
        ],
    )

    assert match is not None
    assert score == 1.0
    assert reason == "duplicate_external_id"


def test_query_order_exploits_approved_strategy_and_keeps_bounded_budget():
    strategies = build_query_strategies(
        {"name": "Project Manager"},
        {"name": "Scheduling"},
    )
    ordered = order_query_strategies(
        strategies,
        [
            {
                "strategy": "recent_deep_dive",
                "reviewed_count": 10,
                "published_count": 8,
            },
            {
                "strategy": "role_topic_course",
                "reviewed_count": 10,
                "published_count": 2,
            },
        ],
        exploration_rate=0,
        seed="project-manager:project-scheduling",
    )
    budget = allocate_search_budget(ordered, 8)

    assert ordered[0].key == "recent_deep_dive"
    assert sum(budget.values()) == 8
    assert all(value >= 1 for value in budget.values())


def test_scoring_uses_strategy_provider_and_review_history():
    approved = score_candidate(
        result(),
        role={"name": "Project Manager", "slug": "project-manager"},
        topic={"name": "Project Scheduling", "slug": "project-scheduling"},
        strategy="recent_deep_dive",
        provider="youtube.com",
        published_examples=[
            {
                "title": "Construction Scheduling Deep Dive",
                "description": "Critical path and look-ahead planning",
            }
        ],
        archived_examples=[],
        strategy_stats=[
            {
                "strategy": "recent_deep_dive",
                "reviewed_count": 10,
                "published_count": 8,
            }
        ],
        provider_stats=[
            {
                "provider": "youtube.com",
                "reviewed_count": 10,
                "published_count": 8,
            }
        ],
    )
    rejected_pattern = score_candidate(
        result(),
        role={"name": "Project Manager", "slug": "project-manager"},
        topic={"name": "Project Scheduling", "slug": "project-scheduling"},
        strategy="role_topic_course",
        provider="unknown.example",
        published_examples=[],
        archived_examples=[
            {
                "title": "Construction Scheduling Deep Dive",
                "description": "Critical path and look-ahead planning",
            }
        ],
        strategy_stats=[
            {
                "strategy": "role_topic_course",
                "reviewed_count": 10,
                "published_count": 1,
            }
        ],
        provider_stats=[],
    )

    assert approved.total > rejected_pattern.total
    assert any("strategy approval" in line for line in approved.explanation)


def test_structured_archive_reasons_adjust_future_scoring_explanation():
    scored = score_candidate(
        result(),
        role={"name": "Project Manager", "slug": "project-manager"},
        topic={"name": "Project Scheduling", "slug": "project-scheduling"},
        strategy="role_topic_course",
        provider="youtube.com",
        published_examples=[],
        archived_examples=[],
        strategy_stats=[],
        provider_stats=[],
        reason_stats=[
            {"reason_code": "wrong_role_topic", "occurrence_count": 3},
            {"reason_code": "too_short", "occurrence_count": 2},
        ],
    )

    assert "review feedback increased role/topic scrutiny" in scored.explanation
    assert "review feedback increased depth scrutiny" in scored.explanation
