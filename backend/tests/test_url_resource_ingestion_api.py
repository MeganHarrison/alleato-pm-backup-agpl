from unittest.mock import MagicMock

from src.api.main import app, get_url_resource_ingestion_service


def test_url_resource_ingestion_endpoint_returns_multistatus_on_partial_failure(client):
    service = MagicMock()
    service.ingest_urls.return_value = [
        {"url": "https://ok.example", "status": "ingested", "pipeline_status": "done"},
        {"url": "https://bad.example", "status": "failed", "pipeline_status": "not_run", "reason": "Fetch failed"},
    ]
    app.dependency_overrides[get_url_resource_ingestion_service] = lambda: service

    try:
        response = client.post(
            "/api/ingest/url-resources",
            json={"urls": ["https://ok.example", "https://bad.example"], "dry_run": False, "run_pipeline": False},
        )
    finally:
        app.dependency_overrides.pop(get_url_resource_ingestion_service, None)

    assert response.status_code == 207
    body = response.json()
    assert body["ingested_count"] == 1
    assert body["failed_count"] == 1
    service.ingest_urls.assert_called_once()
