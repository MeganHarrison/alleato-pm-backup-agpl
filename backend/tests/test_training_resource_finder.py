"""Focused contract tests for the free-only training resource finder."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import pytest
from src.services.agents.research_agent.tools import (
    PublicWebSearchError,
    PublicWebSearchResult,
)
from src.services.training import (
    TrainingFinderRequest,
    TrainingResourceFinderError,
    run_training_resource_finder,
)
from src.services.training.finder import canonicalize_resource_url


@dataclass
class FakeRepository:
    existing_urls: list[str] = field(default_factory=list)
    review_examples: list[dict[str, Any]] = field(default_factory=list)
    created_payloads: list[dict[str, Any]] = field(default_factory=list)
    discovery_runs: list[dict[str, Any]] = field(default_factory=list)
    discovery_candidates: list[dict[str, Any]] = field(default_factory=list)
    fingerprints: list[dict[str, Any]] = field(default_factory=list)
    learning_context: dict[str, Any] = field(
        default_factory=lambda: {
            "policy": {
                "id": "policy-1",
                "version": "feedback-ranking-v2",
                "weights": {},
                "explorationRate": 0,
            },
            "strategyStats": [],
            "providerStats": [],
            "trustedProviders": [],
            "fingerprints": [],
        }
    )
    insert_error: Exception | None = None

    def resolve_role(self, slug: str) -> dict[str, Any]:
        if slug == "missing-role":
            raise TrainingResourceFinderError(
                "TRAINING_TAXONOMY_NOT_FOUND: active training_role slug "
                "'missing-role' was not found."
            )
        return {"id": "role-1", "slug": slug, "name": "Project Manager"}

    def resolve_topic(self, slug: str) -> dict[str, Any]:
        return {"id": "topic-1", "slug": slug, "name": "Construction Scheduling"}

    def list_resource_urls(self) -> list[str]:
        return list(self.existing_urls)

    def list_review_examples(self, topic_id: str) -> list[dict[str, Any]]:
        assert topic_id == "topic-1"
        return list(self.review_examples)

    def get_learning_context(
        self,
        role_id: str,
        topic_id: str,
    ) -> dict[str, Any]:
        assert role_id == "role-1"
        assert topic_id == "topic-1"
        return dict(self.learning_context)

    def start_discovery_run(self, payload: dict[str, Any]) -> str:
        self.discovery_runs.append(dict(payload))
        return f"run-{len(self.discovery_runs)}"

    def record_discovery_candidate(self, payload: dict[str, Any]) -> str:
        self.discovery_candidates.append(dict(payload))
        return f"candidate-{len(self.discovery_candidates)}"

    def complete_discovery_run(
        self,
        run_id: str,
        payload: dict[str, Any],
    ) -> None:
        assert run_id == "run-1"
        self.discovery_runs[0].update(payload)

    def create_review_candidate_with_evidence(
        self,
        resource_payload: dict[str, Any],
        candidate_payload: dict[str, Any],
        fingerprint_payload: dict[str, Any],
    ) -> tuple[str, str]:
        if self.insert_error:
            raise self.insert_error
        resource_id = f"resource-{len(self.created_payloads) + 1}"
        candidate_id = f"candidate-{len(self.discovery_candidates) + 1}"
        self.created_payloads.append(resource_payload)
        self.fingerprints.append({"resource_id": resource_id, **fingerprint_payload})
        self.discovery_candidates.append(
            {
                **candidate_payload,
                "resource_id": resource_id,
                "id": candidate_id,
            }
        )
        return resource_id, candidate_id


def result(
    *,
    title: str = "Complete Construction Scheduling Course",
    url: str = "https://www.youtube.com/watch?v=abc123&utm_source=test",
    snippet: str = (
        "This comprehensive training course walks construction project managers "
        "through schedules, dependencies, look-aheads, updates, recovery plans, "
        "critical paths, communication, and practical field coordination examples."
    ),
    raw_content: str = "",
    score: float = 0.9,
) -> PublicWebSearchResult:
    return PublicWebSearchResult(
        title=title,
        url=url,
        snippet=snippet,
        raw_content=raw_content,
        score=score,
    )


def finder_request(*, dry_run: bool = False, max_inserts: int = 3):
    return TrainingFinderRequest(
        roleSlug="project-manager",
        topicSlug="project-scheduling",
        maxSearchResults=8,
        maxInserts=max_inserts,
        dryRun=dry_run,
    )


def static_searcher(results):
    remaining = list(results)

    def searcher(query, max_results, *, search_depth, include_raw_content):
        assert "site:youtube.com construction" in query
        assert 1 <= max_results <= 8
        assert search_depth == "advanced"
        assert include_raw_content is True
        batch = remaining[:max_results]
        del remaining[:max_results]
        return batch

    return searcher


def test_inserts_only_through_review_candidate_rpc_contract():
    repository = FakeRepository()

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher([result()]),
    )

    assert response.status == "completed"
    assert response.inserted_count == 1
    assert response.outcomes[0].decision == "inserted"
    payload = repository.created_payloads[0]
    assert payload["p_url"] == "https://youtube.com/watch?v=abc123"
    assert payload["p_resource_type"] == "video"
    assert payload["p_level"] == "deep-dive"
    assert payload["p_track"] == "pm"
    assert payload["p_role_ids"] == ["role-1"]
    assert payload["p_topic_id"] == "topic-1"
    assert payload["p_metadata"]["finder"]["freeOnlyPolicy"] == "deterministic-v1"
    assert payload["p_metadata"]["finder"]["reviewFeedback"] == {
        "policy": "structured-review-v2",
        "publishedExamples": 0,
        "archivedExamples": 0,
        "positiveMatchScore": 0.0,
    }
    assert payload["p_metadata"]["finder"]["learning"]["policyVersion"] == (
        "feedback-ranking-v2"
    )
    assert repository.discovery_runs[0]["status"] == "completed"
    assert repository.discovery_candidates[0]["decision"] == "inserted"
    assert repository.fingerprints[0]["external_id"] == "abc123"
    assert "status" not in payload
    assert "cost" not in payload
    assert "resource_id" not in payload


def test_skips_existing_and_same_run_canonical_url_duplicates():
    repository = FakeRepository(existing_urls=["https://youtube.com/watch?v=existing"])
    results = [
        result(url="https://youtu.be/existing?utm_campaign=duplicate"),
        result(url="https://youtube.com/watch?v=new&fbclid=tracking"),
        result(url="https://www.youtube.com/watch?utm_source=x&v=new"),
    ]

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher(results),
    )

    assert response.duplicate_count == 2
    assert response.inserted_count == 1
    assert len(repository.created_payloads) == 1
    assert repository.created_payloads[0]["p_url"] == "https://youtube.com/watch?v=new"


def test_skips_existing_resource_when_search_result_only_changes_scheme():
    repository = FakeRepository(
        existing_urls=["https://youtube.com/watch?v=scheme-duplicate"]
    )

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher(
            [result(url="http://youtube.com/watch?v=scheme-duplicate")]
        ),
    )

    assert response.duplicate_count == 1
    assert response.inserted_count == 0
    assert repository.created_payloads == []


def test_rejects_paid_procore_unknown_cost_and_shallow_results():
    long_raw_content = " ".join(["detailed"] * 240)
    results = [
        result(
            title="Paid Construction Course — $99",
            url="https://youtube.com/watch?v=paid",
        ),
        result(
            title="Complete Procore Scheduling Tutorial",
            url="https://youtube.com/watch?v=procore",
        ),
        result(
            title="Complete scheduling guide",
            url="https://example.com/guide",
            raw_content=long_raw_content,
        ),
        result(
            title="Quick scheduling tip",
            url="https://youtube.com/watch?v=short",
            snippet="A short tip.",
        ),
    ]

    response = run_training_resource_finder(
        finder_request(),
        repository=FakeRepository(),
        searcher=static_searcher(results),
    )

    assert response.inserted_count == 0
    assert response.rejected_count == 4
    assert {outcome.reason_code for outcome in response.outcomes} == {
        "paid_resource",
        "procore_excluded",
        "free_access_unproven",
        "insufficient_depth",
    }


def test_dry_run_is_read_only_but_reports_eligible_candidates():
    repository = FakeRepository()

    response = run_training_resource_finder(
        finder_request(dry_run=True),
        repository=repository,
        searcher=static_searcher([result()]),
    )

    assert response.status == "completed"
    assert response.accepted_count == 1
    assert response.inserted_count == 0
    assert response.outcomes[0].decision == "would_insert"
    assert repository.created_payloads == []
    assert repository.discovery_runs == []
    assert repository.discovery_candidates == []


def test_dry_run_flags_same_run_near_duplicate_content():
    repository = FakeRepository()
    shared_content = " ".join(
        [
            "complete construction scheduling training course critical path",
            "look ahead planning recovery coordination field workflow",
        ]
        * 25
    )

    response = run_training_resource_finder(
        finder_request(dry_run=True),
        repository=repository,
        searcher=static_searcher(
            [
                result(
                    title="Complete Construction Scheduling Field Course",
                    url="https://example.org/training/schedule-one",
                    snippet="Free training for construction project managers.",
                    raw_content=shared_content,
                ),
                result(
                    title="Complete Construction Scheduling Field Course",
                    url="https://example.net/training/schedule-two",
                    snippet="Free training for construction project managers.",
                    raw_content=shared_content,
                ),
            ]
        ),
    )

    assert response.accepted_count == 1
    assert response.duplicate_count == 1
    assert [outcome.decision for outcome in response.outcomes] == [
        "would_insert",
        "duplicate",
    ]


def test_committed_run_is_terminalized_when_post_search_validation_fails():
    repository = FakeRepository(existing_urls=["not-an-http-url"])

    with pytest.raises(
        TrainingResourceFinderError,
        match="TRAINING_RESOURCE_READ_FAILED",
    ):
        run_training_resource_finder(
            finder_request(),
            repository=repository,
            searcher=static_searcher([result()]),
        )

    assert repository.discovery_runs[0]["status"] == "failed"
    assert repository.discovery_runs[0]["completed_at"]
    assert "TRAINING_RESOURCE_READ_FAILED" in repository.discovery_runs[0]["error"]


def test_archived_review_feedback_blocks_a_similar_candidate_at_a_new_url():
    repository = FakeRepository(
        review_examples=[
            {
                "title": "Communication: The Secret Weapon In Construction Management",
                "description": "General construction leadership communication.",
                "status": "archived",
                "reviewer_notes": (
                    "Topic mismatch: this is not Safety Management training."
                ),
            }
        ]
    )

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher(
            [
                result(
                    title=(
                        "Communication: The Secret Weapon In Construction Management"
                    ),
                    url="https://youtube.com/watch?v=mirrored-copy",
                )
            ]
        ),
    )

    assert response.inserted_count == 0
    assert response.rejected_count == 1
    assert response.outcomes[0].reason_code == "review_feedback_negative_match"
    assert "not Safety Management training" in response.outcomes[0].detail
    assert repository.created_payloads == []


def test_published_examples_prioritize_similar_eligible_results():
    repository = FakeRepository(
        review_examples=[
            {
                "title": "Construction Scheduling Complete Course",
                "description": "Critical path and schedule recovery training.",
                "status": "published",
                "reviewer_notes": None,
            }
        ]
    )
    generic_result = result(
        title="Project Manager Construction Scheduling Tutorial",
        url="https://youtube.com/watch?v=generic",
    )
    similar_result = result(
        title="Construction Scheduling Complete Course Updated",
        url="https://youtube.com/watch?v=approved-pattern",
    )

    response = run_training_resource_finder(
        finder_request(max_inserts=1),
        repository=repository,
        searcher=static_searcher([generic_result, similar_result]),
    )

    assert response.inserted_count == 1
    payload = repository.created_payloads[0]
    assert payload["p_url"] == "https://youtube.com/watch?v=approved-pattern"
    assert payload["p_metadata"]["finder"]["reviewFeedback"]["publishedExamples"] == 1
    assert payload["p_metadata"]["finder"]["reviewFeedback"]["positiveMatchScore"] > 0.8


def test_insert_failure_is_explicit_and_does_not_claim_success():
    repository = FakeRepository(
        insert_error=TrainingResourceFinderError(
            "TRAINING_RESOURCE_INSERT_FAILED: candidate RPC failed"
        )
    )

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher([result()]),
    )

    assert response.status == "failed"
    assert response.inserted_count == 0
    assert response.failed_count == 1
    assert response.outcomes[0].decision == "failed"
    assert "TRAINING_RESOURCE_INSERT_FAILED" in response.outcomes[0].detail


def test_concurrent_database_duplicate_is_reported_as_duplicate():
    repository = FakeRepository(
        insert_error=TrainingResourceFinderError(
            "TRAINING_RESOURCE_INSERT_FAILED: "
            "TRAINING_RESOURCE_DUPLICATE: near-duplicate fingerprint exists"
        )
    )

    response = run_training_resource_finder(
        finder_request(),
        repository=repository,
        searcher=static_searcher([result()]),
    )

    assert response.status == "completed"
    assert response.accepted_count == 0
    assert response.duplicate_count == 1
    assert response.failed_count == 0
    assert response.outcomes[0].reason_code == "duplicate_concurrent"
    assert repository.discovery_candidates[0]["decision"] == "duplicate"


def test_search_failure_names_the_failed_capability():
    def failed_search(*_args, **_kwargs):
        raise PublicWebSearchError(
            "WEB_SEARCH_UNAVAILABLE: TAVILY_API_KEY is not configured"
        )

    with pytest.raises(
        TrainingResourceFinderError,
        match="TRAINING_RESOURCE_SEARCH_FAILED.*TAVILY_API_KEY",
    ):
        run_training_resource_finder(
            finder_request(),
            repository=FakeRepository(),
            searcher=failed_search,
        )


def test_unknown_role_fails_before_public_search():
    searched = False

    def should_not_search(*_args, **_kwargs):
        nonlocal searched
        searched = True
        return []

    with pytest.raises(
        TrainingResourceFinderError,
        match="TRAINING_TAXONOMY_NOT_FOUND",
    ):
        run_training_resource_finder(
            TrainingFinderRequest(
                roleSlug="missing-role",
                topicSlug="project-scheduling",
            ),
            repository=FakeRepository(),
            searcher=should_not_search,
        )
    assert searched is False


@pytest.mark.parametrize(
    ("raw_url", "canonical"),
    [
        (
            "https://www.youtube.com/watch?utm_source=x&v=abc&list=ignored",
            "https://youtube.com/watch?v=abc",
        ),
        ("http://youtube.com/watch?v=abc", "https://youtube.com/watch?v=abc"),
        ("https://youtu.be/abc?t=15", "https://youtube.com/watch?v=abc"),
        (
            "https://Example.com/guide/?b=2&utm_campaign=x&a=1#section",
            "https://example.com/guide?a=1&b=2",
        ),
    ],
)
def test_canonicalizes_tracking_and_video_url_variants(raw_url, canonical):
    assert canonicalize_resource_url(raw_url) == canonical
