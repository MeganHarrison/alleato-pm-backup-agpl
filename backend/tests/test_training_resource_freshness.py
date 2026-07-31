"""Focused safety, accounting, and schedule tests for training freshness."""

from __future__ import annotations

from pathlib import Path

import pytest
import yaml

from src.services.training.contracts import TrainingFreshnessEvidence
from src.services.training.freshness import (
    TrainingResourceFreshnessError,
    inspect_training_resource,
    run_training_resource_freshness,
)
from src.scripts import run_training_resource_freshness_weekday


class FakeRepository:
    def __init__(
        self,
        resources: list[dict] | None = None,
        *,
        review_status: str = "observing",
        record_error: Exception | None = None,
    ):
        self.resources = resources or [
            {
                "id": "e00df78a-c40e-4d31-ab64-02cdb5472da1",
                "title": "Construction scheduling",
                "url": "https://example.com/scheduling",
            }
        ]
        self.review_status = review_status
        self.record_error = record_error
        self.recorded: list[tuple[str, TrainingFreshnessEvidence]] = []

    def list_rotation_resources(self, limit: int):
        return self.resources[:limit]

    def record_check(self, resource_id: str, evidence: TrainingFreshnessEvidence):
        if self.record_error:
            raise self.record_error
        self.recorded.append((resource_id, evidence))
        return "b1a03cb4-4535-46d5-91c1-78af69401023", self.review_status


def _resource(url: str = "https://example.com/scheduling") -> dict:
    return {
        "id": "e00df78a-c40e-4d31-ab64-02cdb5472da1",
        "title": "Construction scheduling",
        "url": url,
    }


def test_private_and_loopback_targets_are_recordable_blocked_evidence():
    evidence = inspect_training_resource(_resource("http://127.0.0.1/admin"))

    assert evidence.outcome == "blocked"
    assert evidence.recommended_action == "keep"
    assert evidence.evidence["policy"] == "dns-pinned-public-http-v1"
    assert "UNSAFE_URL" in evidence.evidence["reason"]


def test_not_found_requires_human_archive_review(monkeypatch):
    monkeypatch.setattr(
        "src.services.training.freshness._request_once",
        lambda _url: (
            404,
            {"content-type": "text/html"},
            b"<title>Not found</title>",
        ),
    )

    evidence = inspect_training_resource(_resource())

    assert evidence.outcome == "unavailable"
    assert evidence.recommended_action == "archive"
    assert evidence.http_status == 404
    assert len(evidence.fingerprint) == 64


def test_material_title_change_is_staged_without_editing_source(monkeypatch):
    monkeypatch.setattr(
        "src.services.training.freshness._request_once",
        lambda _url: (
            200,
            {"content-type": "text/html; charset=utf-8"},
            b"<title>Cloud accounting software pricing</title>",
        ),
    )

    evidence = inspect_training_resource(_resource())

    assert evidence.outcome == "title_changed"
    assert evidence.recommended_action == "keep"
    assert evidence.observed_title == "Cloud accounting software pricing"


def test_runner_accounts_for_every_selected_resource_and_pending_readback():
    repository = FakeRepository(review_status="pending")

    result = run_training_resource_freshness(
        max_resources=1,
        repository=repository,
        inspector=lambda _resource: TrainingFreshnessEvidence(
            outcome="unavailable",
            fingerprint="a" * 64,
            recommendedAction="archive",
            httpStatus=404,
            finalUrl="https://example.com/scheduling",
        ),
    )

    assert result.status == "completed"
    assert result.checked_count == 1
    assert result.recorded_count == 1
    assert result.pending_count == 1
    assert result.failed_count == 0
    assert len(repository.recorded) == 1


def test_runner_fails_loudly_when_evidence_cannot_be_recorded():
    repository = FakeRepository(
        record_error=TrainingResourceFreshnessError(
            "TRAINING_RESOURCE_FRESHNESS_RECORD_FAILED: unavailable"
        )
    )

    result = run_training_resource_freshness(
        max_resources=1,
        repository=repository,
        inspector=lambda _resource: TrainingFreshnessEvidence(
            outcome="healthy",
            fingerprint="b" * 64,
            finalUrl="https://example.com/scheduling",
        ),
    )

    assert result.status == "failed"
    assert result.checked_count == 1
    assert result.recorded_count == 0
    assert result.failed_count == 1
    assert "TRAINING_RESOURCE_FRESHNESS_RECORD_FAILED" in result.outcomes[0].error


def test_render_cron_is_bounded_weekday_and_uses_only_supabase_credentials():
    render_config = yaml.safe_load(
        Path(__file__).resolve().parents[2].joinpath("render.yaml").read_text()
    )
    cron = next(
        service
        for service in render_config["services"]
        if service["name"] == "alleato-training-resource-freshness-weekday"
    )

    assert cron["type"] == "cron"
    assert cron["runtime"] == "docker"
    assert cron["schedule"] == "45 13 * * 1-5"
    assert "--max-resources 20" in cron["dockerCommand"]
    assert "timeout 20m" in cron["dockerCommand"]
    env_keys = {item["key"] for item in cron["envVars"]}
    assert {
        "PYTHONPATH",
        "PYTHONUNBUFFERED",
        "SUPABASE_URL",
        "SUPABASE_SERVICE_ROLE_KEY",
    }.issubset(env_keys)
    assert "TAVILY_API_KEY" not in env_keys


def test_cli_reports_missing_runtime_configuration_without_a_traceback(
    monkeypatch,
    capsys,
):
    monkeypatch.setattr(
        run_training_resource_freshness_weekday,
        "run_training_resource_freshness",
        lambda **_kwargs: (_ for _ in ()).throw(
            RuntimeError("Environment variable 'SUPABASE_URL' is required")
        ),
    )

    assert run_training_resource_freshness_weekday.main(
        ["--max-resources", "1"]
    ) == 1
    output = capsys.readouterr().out
    assert "TRAINING_RESOURCE_FRESHNESS_RUN_FAILED" in output
    assert "Traceback" not in output
