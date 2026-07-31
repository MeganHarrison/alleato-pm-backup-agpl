"""Pytest configuration and fixtures for backend tests."""
import os
import pytest
from typing import AsyncGenerator, Generator
from unittest.mock import MagicMock, patch

from fastapi.testclient import TestClient
from httpx import AsyncClient

# Set test environment
os.environ["TESTING"] = "true"
os.environ["OPENAI_API_KEY"] = "test-key"
os.environ["SUPABASE_URL"] = "http://test.supabase.co"
os.environ["SUPABASE_KEY"] = "test-service-key"


@pytest.fixture
def app():
    """Create FastAPI app instance for testing."""
    from src.api.main import app
    return app


@pytest.fixture
def client(app) -> Generator:
    """Create test client for FastAPI app."""
    with TestClient(app) as test_client:
        yield test_client


@pytest.fixture
async def async_client(app) -> AsyncGenerator:
    """Create async test client for FastAPI app."""
    async with AsyncClient(app=app, base_url="http://test") as ac:
        yield ac


@pytest.fixture
def mock_supabase_store():
    """Mock SupabaseRagStore for testing."""
    with patch("src.api.main.SupabaseRagStore") as mock:
        store = MagicMock()
        store.search_chunks_by_keyword.return_value = []
        store.fetch_recent_chunks.return_value = []
        store.list_tasks.return_value = []
        store.list_insights.return_value = []
        store.get_project.return_value = None
        store.list_projects.return_value = []
        mock.return_value = store
        yield store


@pytest.fixture
def mock_openai():
    """Mock OpenAI client for testing."""
    with patch("openai.OpenAI") as mock:
        client = MagicMock()
        # Mock chat completion
        completion = MagicMock()
        completion.choices = [MagicMock(message=MagicMock(content="Test response"))]
        client.chat.completions.create.return_value = completion
        mock.return_value = client
        yield client


@pytest.fixture
def mock_runner():
    """Mock agent Runner for testing."""
    with patch("src.api.main.Runner") as mock:
        runner_result = MagicMock()
        runner_result.new_items = []
        runner_result.to_input_list.return_value = []
        runner_result.last_agent = MagicMock(name="test_agent")
        runner_result.input_guardrail_results = []
        
        mock.run_sync.return_value = runner_result
        mock.run_streamed.return_value = runner_result
        yield mock


@pytest.fixture
def sample_project_data():
    """Sample project data for testing."""
    return {
        "id": 1,
        "name": "Test Project",
        "job_number": "JOB-001",
        "client": "Test Client",
        "start_date": "2024-01-01",
        "end_date": "2024-12-31",
        "state": "construction",
        "phase": "Phase 1",
        "estimated_revenue": 1000000,
        "estimated_profit": 200000,
        "category": "Commercial",
        "meeting_count": 5,
        "open_tasks": 10,
    }


@pytest.fixture
def sample_chat_request():
    """Sample chat request payload."""
    return {
        "message": "What are the biggest risks in the project?",
        "project_id": 1,
        "limit": 5
    }


@pytest.fixture
def sample_ingest_request():
    """Sample ingestion request payload."""
    return {
        "path": "/path/to/fireflies/transcript.json",
        "project_id": 1,
        "dry_run": True
    }


@pytest.fixture
def mock_fireflies_pipeline():
    """Mock FirefliesIngestionPipeline for testing."""
    with patch("src.api.main.FirefliesIngestionPipeline") as mock:
        pipeline = MagicMock()
        result = MagicMock()
        result.__dict__ = {
            "status": "success",
            "documents_created": 1,
            "chunks_created": 10,
            "tasks_created": 5,
            "insights_created": 3
        }
        pipeline.ingest_file.return_value = result
        mock.return_value = pipeline
        yield pipeline
