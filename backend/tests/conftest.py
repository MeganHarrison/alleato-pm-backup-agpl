"""Shared fixtures for backend tests."""
import os
import sys
import types
from pathlib import Path
from unittest.mock import MagicMock, patch

import pytest

# Ensure backend is importable. Two import styles coexist across the test suite:
#   - `from src.services.X import Y` (e.g. test_fireflies_action_items.py) needs
#     `backend` on sys.path.
#   - `from services.X import Y` (e.g. test_acumatica_*.py, test_email_classification.py)
#     needs `backend/src` on sys.path.
# Insert both roots rather than replacing one with the other.
_BACKEND_DIR = Path(__file__).parent.parent
sys.path.insert(0, str(_BACKEND_DIR))
sys.path.insert(0, str(_BACKEND_DIR / "src"))


# ---------------------------------------------------------------------------
# Stub heavy third-party modules BEFORE importing our app
# ---------------------------------------------------------------------------

def _stub_modules():
    """Pre-register stubs for modules that require credentials or native deps."""
    stubs = {}

    # supabase
    supabase_mod = MagicMock()
    supabase_mod.create_client = MagicMock(return_value=MagicMock())
    stubs["supabase"] = supabase_mod

    # langchain / crawl4ai / psycopg2 etc.
    for mod_name in [
        "langchain", "langchain.text_splitter", "langchain_community",
        "langchain_community.embeddings", "crawl4ai", "psycopg2",
        "pandas", "numpy",
    ]:
        stubs[mod_name] = MagicMock()

    langchain_core_mod = types.ModuleType("langchain_core")
    langchain_core_tools_mod = types.ModuleType("langchain_core.tools")

    class _ToolWrapper:
        def __init__(self, func):
            self.func = func
            self.name = getattr(func, "__name__", "tool")
            self.__name__ = self.name

        def __call__(self, *args, **kwargs):
            return self.func(*args, **kwargs)

        def invoke(self, payload):
            if isinstance(payload, dict):
                return self.func(**payload)
            return self.func(payload)

    def _tool(func=None, *_args, **_kwargs):
        if func is None:
            return lambda wrapped: _ToolWrapper(wrapped)
        return _ToolWrapper(func)

    langchain_core_tools_mod.tool = _tool
    stubs["langchain_core"] = langchain_core_mod
    stubs["langchain_core.tools"] = langchain_core_tools_mod

    mcp_mod = types.ModuleType("mcp")
    mcp_server_mod = types.ModuleType("mcp.server")
    mcp_fastmcp_mod = types.ModuleType("mcp.server.fastmcp")

    class _FakeFastMCP:
        def __init__(self, *args, **kwargs):
            self.args = args
            self.kwargs = kwargs
            self.session_manager = MagicMock()
            self.session_manager.run.return_value = MagicMock()

        def tool(self, *args, **kwargs):
            def _decorator(func):
                return func

            return _decorator

        def streamable_http_app(self):
            async def _app(scope, receive, send):
                return None

            return _app

    mcp_fastmcp_mod.FastMCP = _FakeFastMCP
    stubs["mcp"] = mcp_mod
    stubs["mcp.server"] = mcp_server_mod
    stubs["mcp.server.fastmcp"] = mcp_fastmcp_mod

    sqlalchemy_mod = types.ModuleType("sqlalchemy")
    sqlalchemy_engine_mod = types.ModuleType("sqlalchemy.engine")
    sqlalchemy_exc_mod = types.ModuleType("sqlalchemy.exc")
    sqlalchemy_pool_mod = types.ModuleType("sqlalchemy.pool")
    sqlalchemy_mod.create_engine = MagicMock()
    sqlalchemy_mod.text = MagicMock(side_effect=lambda value: value)
    sqlalchemy_engine_mod.Engine = object
    sqlalchemy_exc_mod.OperationalError = RuntimeError
    sqlalchemy_pool_mod.NullPool = object
    stubs["sqlalchemy"] = sqlalchemy_mod
    stubs["sqlalchemy.engine"] = sqlalchemy_engine_mod
    stubs["sqlalchemy.exc"] = sqlalchemy_exc_mod
    stubs["sqlalchemy.pool"] = sqlalchemy_pool_mod

    for name, mod in stubs.items():
        sys.modules.setdefault(name, mod)


_stub_modules()

# Set required env vars before importing app
os.environ.setdefault("OPENAI_API_KEY", "sk-test-key")
os.environ.setdefault("SUPABASE_URL", "https://fake.supabase.co")
os.environ.setdefault("SUPABASE_SERVICE_ROLE_KEY", "fake-key")
os.environ.setdefault("ADMIN_API_KEY", "test-admin-key")


# ---------------------------------------------------------------------------
# Now safe to import the app
# ---------------------------------------------------------------------------

# Patch env_loader so it doesn't try to read a real .env
with patch.dict(sys.modules, {"src.services.env_loader": MagicMock()}):
    # Patch heavy service modules
    mock_supabase_helpers_mod = MagicMock()
    mock_fireflies_mod = MagicMock()
    class _FakeFirefliesIngestionPipeline:
        def __init__(self, *args, **kwargs):
            pass
    mock_fireflies_mod.FirefliesIngestionPipeline = _FakeFirefliesIngestionPipeline

    with patch.dict(sys.modules, {
        "src.services.env_loader": MagicMock(),
        "src.services.supabase_helpers": mock_supabase_helpers_mod,
        "src.services.ingestion": MagicMock(),
        "src.services.ingestion.fireflies_pipeline": mock_fireflies_mod,
        "src.workers": MagicMock(),
        "src.workers.scripts": MagicMock(),
        "src.api.admin_endpoints": MagicMock(),
        "src.yokeflow": MagicMock(),
        "src.yokeflow.api": MagicMock(),
        "src.yokeflow.api.router": MagicMock(),
    }):
        try:
            from src.api.main import (  # noqa: E402
                app,
                get_ingestion_pipeline as _get_ingestion_pipeline,
                get_rag_store as _get_rag_store,
                require_admin_api_key as _require_admin_api_key,
            )
        except ModuleNotFoundError:
            # Workaround for import path issues in test worktree
            app = None
            _get_ingestion_pipeline = None
            _get_rag_store = None
            _require_admin_api_key = None


from fastapi.testclient import TestClient


# ---------------------------------------------------------------------------
# Fixtures
# ---------------------------------------------------------------------------

@pytest.fixture
def client():
    """FastAPI test client."""
    app.dependency_overrides[_require_admin_api_key] = lambda: None
    return TestClient(app)


@pytest.fixture
def mock_supabase_store():
    """Mock SupabaseRagStore injected via dependency override."""
    store = MagicMock()
    store.list_projects.return_value = []
    store.get_project.return_value = None
    store.list_tasks.return_value = []
    store.list_insights.return_value = []
    store.search_financial_rows.return_value = []
    store.search_chunks_by_keyword.return_value = []
    store.fetch_recent_chunks.return_value = []

    app.dependency_overrides[_get_rag_store] = lambda: store
    yield store
    app.dependency_overrides.pop(_get_rag_store, None)


@pytest.fixture
def mock_fireflies_pipeline():
    """Mock FirefliesIngestionPipeline injected via dependency override."""
    pipeline = MagicMock()

    pipeline.sync_recent_transcripts.return_value = {"status": "success", "processed": 1, "dry_run": True}

    app.dependency_overrides[_get_ingestion_pipeline] = lambda: pipeline
    yield pipeline
    app.dependency_overrides.pop(_get_ingestion_pipeline, None)


@pytest.fixture
def sample_project_data():
    return {
        "id": 1,
        "name": "Test Project",
        "meeting_count": 10,
        "open_tasks": 5,
    }


@pytest.fixture
def sample_chat_request():
    return {"message": "What are the risks?", "project_id": 1, "limit": 5}


@pytest.fixture
def admin_headers():
    return {"X-Admin-Api-Key": "test-admin-key"}


@pytest.fixture
def sample_ingest_request():
    return {
        "limit": 5,
        "project_id": 1,
        "dry_run": True,
    }
