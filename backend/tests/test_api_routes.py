"""Tests for all main.py API routes."""


class TestHealthEndpoint:
    """Health endpoint tests."""

    def test_health_returns_200(self, client):
        r = client.get("/health")
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "healthy"
        assert "timestamp" in data
        assert isinstance(data["openai_configured"], bool)

    def test_health_openai_configured(self, client, monkeypatch):
        monkeypatch.setenv("OPENAI_API_KEY", "sk-real")
        r = client.get("/health")
        assert r.json()["openai_configured"] is True

    def test_health_openai_not_configured(self, client, monkeypatch):
        monkeypatch.delenv("OPENAI_API_KEY", raising=False)
        r = client.get("/health")
        assert r.json()["openai_configured"] is False


class TestProjectsEndpoints:
    """Project CRUD endpoints."""

    def test_list_projects_empty(self, client, mock_supabase_store):
        mock_supabase_store.list_projects.return_value = []
        r = client.get("/api/projects")
        assert r.status_code == 200
        assert r.json()["projects"] == []

    def test_list_projects_with_data(self, client, mock_supabase_store, sample_project_data):
        mock_supabase_store.list_projects.return_value = [sample_project_data]
        r = client.get("/api/projects")
        assert r.status_code == 200
        projects = r.json()["projects"]
        assert len(projects) == 1
        assert projects[0]["name"] == "Test Project"

    def test_get_project_success(self, client, mock_supabase_store, sample_project_data):
        mock_supabase_store.get_project.return_value = sample_project_data
        mock_supabase_store.list_tasks.return_value = []
        r = client.get("/api/projects/1")
        assert r.status_code == 200
        assert r.json()["project"]["name"] == "Test Project"
        assert "insights" not in r.json()

    def test_get_project_not_found(self, client, mock_supabase_store):
        mock_supabase_store.get_project.return_value = None
        r = client.get("/api/projects/999")
        assert r.status_code == 404
        assert r.json()["detail"] == "Project not found"


class TestChatEndpoint:
    """POST /api/chat tests."""

    def test_chat_empty_message(self, client):
        r = client.post("/api/chat", json={"message": ""})
        assert r.status_code == 422

    def test_chat_missing_message(self, client):
        r = client.post("/api/chat", json={})
        assert r.status_code == 422

    def test_chat_success(self, client, mock_supabase_store):
        mock_supabase_store.search_chunks_by_keyword.return_value = []
        mock_supabase_store.fetch_recent_chunks.return_value = []
        mock_supabase_store.list_tasks.return_value = []
        mock_supabase_store.get_project.return_value = None
        r = client.post("/api/chat", json={"message": "hello"})
        assert r.status_code == 200
        data = r.json()
        assert "reply" in data
        assert "insights" not in data


class TestIngestionEndpoint:
    """Fireflies ingestion route tests."""

    def test_legacy_file_ingest_route_removed(self, client, mock_fireflies_pipeline):
        r = client.post("/api/ingest/fireflies", json={"path": "/path/to/fireflies/transcript.json"})
        assert r.status_code == 404
        mock_fireflies_pipeline.sync_recent_transcripts.assert_not_called()

    def test_recent_fireflies_sync_success(self, client, mock_fireflies_pipeline, sample_ingest_request, admin_headers):
        r = client.post("/api/ingest/fireflies/recent", json=sample_ingest_request, headers=admin_headers)
        assert r.status_code == 200
        data = r.json()
        assert data["status"] == "success"
        mock_fireflies_pipeline.sync_recent_transcripts.assert_called_once_with(
            limit=5, project_id=1, dry_run=True, write_markdown_dir=None
        )

    def test_recent_fireflies_sync_defaults(self, client, mock_fireflies_pipeline, admin_headers):
        r = client.post("/api/ingest/fireflies", json={"path": "/path/to/fireflies/transcript.json"})
        assert r.status_code == 404

        r = client.post("/api/ingest/fireflies/recent", json={}, headers=admin_headers)
        assert r.status_code == 200
        mock_fireflies_pipeline.sync_recent_transcripts.assert_called_once_with(
            limit=5, project_id=None, dry_run=False, write_markdown_dir=None
        )


class TestOpenAPIDocs:
    """Verify docs endpoints are accessible."""

    def test_openapi_json(self, client):
        r = client.get("/openapi.json")
        assert r.status_code == 200
        assert "paths" in r.json()

    def test_docs_page(self, client):
        r = client.get("/docs")
        assert r.status_code == 200
