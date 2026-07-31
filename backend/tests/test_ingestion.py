"""Tests for document ingestion endpoints."""

import pytest


class TestIngestion:
    """Test cases for ingestion endpoints."""

    @pytest.mark.unit
    def test_recent_fireflies_sync_success(
        self, client, mock_fireflies_pipeline, sample_ingest_request, admin_headers
    ):
        """Test successful canonical Fireflies transcript sync."""
        response = client.post(
            "/api/ingest/fireflies/recent",
            json=sample_ingest_request,
            headers=admin_headers,
        )

        assert response.status_code == 200
        data = response.json()

        assert data["status"] == "success"
        assert data["processed"] == 1
        assert data["dry_run"] is True
        mock_fireflies_pipeline.sync_recent_transcripts.assert_called_once_with(
            limit=5,
            project_id=1,
            dry_run=True,
            write_markdown_dir=None,
        )

    @pytest.mark.unit
    def test_recent_fireflies_sync_no_project_id(self, client, mock_fireflies_pipeline, admin_headers):
        """Test canonical sync without project ID."""
        response = client.post(
            "/api/ingest/fireflies/recent",
            json={"limit": 3, "dry_run": False},
            headers=admin_headers,
        )

        assert response.status_code == 200
        mock_fireflies_pipeline.sync_recent_transcripts.assert_called_once_with(
            limit=3,
            project_id=None,
            dry_run=False,
            write_markdown_dir=None,
        )

    @pytest.mark.unit
    def test_recent_fireflies_sync_error_handling(self, client, mock_fireflies_pipeline, admin_headers):
        """Test canonical sync error handling."""
        mock_fireflies_pipeline.sync_recent_transcripts.side_effect = Exception("Fireflies API unavailable")

        with pytest.raises(Exception, match="Fireflies API unavailable"):
            client.post(
                "/api/ingest/fireflies/recent",
                json={"limit": 1, "dry_run": True},
                headers=admin_headers,
            )

    @pytest.mark.unit
    def test_legacy_fireflies_file_route_removed(self, client, mock_fireflies_pipeline):
        """Test the deleted legacy file route cannot be revived by request shape."""
        response = client.post("/api/ingest/fireflies", json={"path": "/path/to/transcript.json"})

        assert response.status_code == 404
        mock_fireflies_pipeline.sync_recent_transcripts.assert_not_called()
