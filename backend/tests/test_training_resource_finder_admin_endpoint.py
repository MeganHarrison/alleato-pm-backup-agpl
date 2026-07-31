from __future__ import annotations

import pytest
from fastapi import FastAPI, HTTPException
from fastapi.testclient import TestClient

from src.api import admin_endpoints
from src.services.training import (
    TrainingFinderRequest,
    TrainingFinderResponse,
    TrainingResourceFinderError,
)


def finder_response(request: TrainingFinderRequest) -> TrainingFinderResponse:
    return TrainingFinderResponse(
        status="completed",
        query="construction training",
        roleSlug=request.role_slug,
        topicSlug=request.topic_slug,
        dryRun=request.dry_run,
        searchedCount=1,
        acceptedCount=1,
        insertedCount=1,
        duplicateCount=0,
        rejectedCount=0,
        failedCount=0,
        outcomes=[],
    )


def test_admin_router_registers_the_training_finder_under_its_api_key_guard() -> None:
    route = next(
        route
        for route in admin_endpoints.router.routes
        if route.path == "/api/admin/training/resources/find"
    )

    assert "POST" in route.methods
    assert any(
        dependency.call is admin_endpoints.require_admin_api_key
        for dependency in route.dependant.dependencies
    )


def test_admin_api_key_guard_rejects_missing_or_wrong_credentials(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("ADMIN_API_KEY", "expected-key")

    with pytest.raises(HTTPException) as missing:
        admin_endpoints.require_admin_api_key(
            authorization=None, x_admin_api_key=None
        )
    assert missing.value.status_code == 401

    with pytest.raises(HTTPException) as wrong:
        admin_endpoints.require_admin_api_key(
            authorization=None, x_admin_api_key="wrong-key"
        )
    assert wrong.value.status_code == 401

    assert (
        admin_endpoints.require_admin_api_key(
            authorization=None,
            x_admin_api_key="expected-key",
        )
        is None
    )


def test_admin_api_key_guard_fails_loudly_when_backend_is_not_configured(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delenv("ADMIN_API_KEY", raising=False)

    with pytest.raises(HTTPException) as missing_configuration:
        admin_endpoints.require_admin_api_key()

    assert missing_configuration.value.status_code == 503
    assert "ADMIN_API_KEY is not configured" in missing_configuration.value.detail


def test_in_app_endpoint_commits_through_the_canonical_finder(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[TrainingFinderRequest] = []

    def finder(request: TrainingFinderRequest) -> TrainingFinderResponse:
        captured.append(request)
        return finder_response(request)

    monkeypatch.setattr(admin_endpoints, "run_training_resource_finder", finder)
    request = TrainingFinderRequest(
        roleSlug="project-manager",
        topicSlug="change-management",
        maxSearchResults=8,
        maxInserts=3,
        dryRun=False,
    )

    response = admin_endpoints.trigger_training_resource_finder_admin(
        request,
        x_request_id="training-finder-test",
    )

    assert len(captured) == 1
    assert captured[0].role_slug == request.role_slug
    assert captured[0].topic_slug == request.topic_slug
    assert captured[0].max_search_results == 8
    assert captured[0].max_inserts == 3
    assert captured[0].dry_run is False
    assert response.status == "completed"
    assert response.inserted_count == 1
    assert response.dry_run is False


def test_in_app_endpoint_forces_write_mode_and_fixed_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[TrainingFinderRequest] = []

    def finder(request: TrainingFinderRequest) -> TrainingFinderResponse:
        captured.append(request)
        return finder_response(request)

    monkeypatch.setattr(admin_endpoints, "run_training_resource_finder", finder)
    request = TrainingFinderRequest(
        roleSlug="project-manager",
        topicSlug="change-management",
        maxSearchResults=8,
        maxInserts=8,
        dryRun=True,
    )

    response = admin_endpoints.trigger_training_resource_finder_admin(
        request,
        x_request_id="bounded-request-test",
    )

    assert response.status == "completed"
    assert len(captured) == 1
    assert captured[0].max_search_results == 8
    assert captured[0].max_inserts == 3
    assert captured[0].dry_run is False


def test_in_app_endpoint_preserves_named_finder_failures(
    monkeypatch: pytest.MonkeyPatch,
    caplog: pytest.LogCaptureFixture,
) -> None:
    def finder(_request: TrainingFinderRequest) -> TrainingFinderResponse:
        raise TrainingResourceFinderError(
            "TRAINING_RESOURCE_SEARCH_FAILED: provider unavailable"
        )

    monkeypatch.setattr(admin_endpoints, "run_training_resource_finder", finder)
    request = TrainingFinderRequest(
        roleSlug="project-manager",
        topicSlug="change-management",
        dryRun=False,
    )

    with pytest.raises(HTTPException) as failure:
        admin_endpoints.trigger_training_resource_finder_admin(
            request,
            x_request_id="request-visible-in-backend-logs",
        )

    assert failure.value.status_code == 502
    assert (
        failure.value.detail
        == "TRAINING_RESOURCE_SEARCH_FAILED: provider unavailable"
    )
    assert "request-visible-in-backend-logs" in caplog.text


def test_http_endpoint_enforces_auth_serialization_and_server_bounds(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: list[TrainingFinderRequest] = []

    def finder(request: TrainingFinderRequest) -> TrainingFinderResponse:
        captured.append(request)
        return finder_response(request)

    monkeypatch.setenv("ADMIN_API_KEY", "expected-key")
    monkeypatch.setattr(admin_endpoints, "run_training_resource_finder", finder)
    app = FastAPI()
    app.include_router(admin_endpoints.router)
    client = TestClient(app)
    payload = {
        "roleSlug": "project-manager",
        "topicSlug": "change-management",
        "maxSearchResults": 8,
        "maxInserts": 8,
        "dryRun": True,
    }

    unauthorized = client.post(
        "/api/admin/training/resources/find",
        json=payload,
        headers={"X-Admin-Api-Key": "wrong-key"},
    )
    assert unauthorized.status_code == 401

    authorized = client.post(
        "/api/admin/training/resources/find",
        json=payload,
        headers={
            "X-Admin-Api-Key": "expected-key",
            "X-Request-Id": "http-boundary-test",
        },
    )

    assert authorized.status_code == 200
    assert authorized.json()["dryRun"] is False
    assert authorized.json()["insertedCount"] == 1
    assert len(captured) == 1
    assert captured[0].max_search_results == 8
    assert captured[0].max_inserts == 3
    assert captured[0].dry_run is False
