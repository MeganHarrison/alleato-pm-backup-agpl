import pytest

from src.services.pipeline import embedder
from src.services.pipeline.models import DocumentChunk
from src.services.supabase_helpers import SupabaseRagStore


class _CapturingTable:
    def __init__(self, sink):
        self._sink = sink
        self._payload = None

    def upsert(self, payload, on_conflict=None):
        self._sink.append(payload)
        self._payload = payload
        return self

    def execute(self):
        return _ScopeResult([self._payload] if self._payload else [])


class _CapturingClient:
    def __init__(self):
        self.upserts = []

    def table(self, _name):
        return _CapturingTable(self.upserts)


class _ScopeResult:
    def __init__(self, data):
        self.data = data


class _ScopeTable:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.operation = None
        self.payload = None

    def select(self, *_columns):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, _column, _value):
        return self

    def limit(self, _value):
        return self

    def execute(self):
        if self.operation == "select":
            if self.table_name in self.client.missing_tables:
                return _ScopeResult([])
            return _ScopeResult(
                [
                    {
                        "id": "doc-finance",
                        "source_metadata": dict(self.client.rag_source_metadata),
                    }
                ]
            )
        self.client.updates.append((self.table_name, self.payload))
        return _ScopeResult([{"id": "doc-finance", **(self.payload or {})}])


class _ScopeClient:
    def __init__(self, rag_source_metadata=None, missing_tables=None):
        self.rag_source_metadata = rag_source_metadata or {}
        self.missing_tables = set(missing_tables or [])
        self.updates = []

    def table(self, table_name):
        return _ScopeTable(self, table_name)


def test_chunk_metadata_keeps_business_area_without_fabricating_project_id():
    client = _CapturingClient()
    chunk = DocumentChunk(
        content="Finance policy and accounting workflow",
        chunk_index=0,
        segment_index=-1,
        doc_type="document_chunk",
        content_hash="hash",
        embedding=[0.1],
    )

    embedder._upsert_chunk(
        client,
        chunk=chunk,
        metadata_id="doc-finance",
        segment_id=None,
        started_at=None,
        participants=[],
        project_id=None,
        title="Finance workflow",
        existing_chunk_id=None,
        business_area_id=3,
    )

    metadata = client.upserts[0]["metadata"]
    assert metadata["project_id"] is None
    assert metadata["business_area_id"] == 3


def test_rag_store_preserves_business_area_in_each_database_contract():
    client = _CapturingClient()
    store = SupabaseRagStore(client=client, rag_client=client)
    metadata = {
        "id": "doc-finance",
        "title": "Finance workflow",
        "project_id": None,
        "business_area_id": 3,
        "content": "Finance policy and accounting workflow",
        "source_metadata": {"source": "outlook"},
    }

    app_payload = store._app_document_catalog_payload(metadata)
    rag_payload = store._rag_document_metadata_payload(metadata)

    assert app_payload["business_area_id"] == 3
    assert app_payload.get("project_id") is None
    assert "business_area_id" not in rag_payload
    assert rag_payload["source_metadata"]["business_area_id"] == 3
    assert rag_payload.get("project_id") is None


def test_rag_store_materializes_replica_before_ocr_text_exists():
    app_client = _CapturingClient()
    rag_client = _CapturingClient()
    store = SupabaseRagStore(client=app_client, rag_client=rag_client)

    store.upsert_document_metadata(
        {
            "id": "sharepoint-scanned-drawing",
            "title": "Scanned drawing",
            "source_system": "sharepoint",
            "document_type": "drawing",
            "status": "no_text",
            "parsing_status": "no_text",
            "embedding_status": "pending",
            "content": None,
            "raw_text": None,
        }
    )

    assert app_client.upserts == [
        {
            "id": "sharepoint-scanned-drawing",
            "title": "Scanned drawing",
            "source_system": "sharepoint",
            "document_type": "drawing",
            "status": "no_text",
        }
    ]
    assert rag_client.upserts[0]["id"] == "sharepoint-scanned-drawing"
    assert rag_client.upserts[0]["app_document_id"] == "sharepoint-scanned-drawing"
    assert rag_client.upserts[0]["parsing_status"] == "no_text"
    assert rag_client.upserts[0]["embedding_status"] == "pending"
    assert "content" not in rag_client.upserts[0]


def test_set_document_scope_clears_project_and_sets_business_area_in_both_databases():
    app_client = _ScopeClient()
    rag_client = _ScopeClient({"source": "fireflies", "business_area_id": 99})
    store = SupabaseRagStore(client=app_client, rag_client=rag_client)

    result = store.set_document_scope(
        "doc-finance",
        project_id=None,
        business_area_id=3,
    )

    assert app_client.updates == [
        (
            "document_metadata",
            {"project_id": None, "business_area_id": 3},
        )
    ]
    assert rag_client.updates == [
        (
            "rag_document_metadata",
            {
                "project_id": None,
                "source_metadata": {
                    "source": "fireflies",
                    "business_area_id": 3,
                },
            },
        )
    ]
    assert result["project_id"] is None
    assert result["business_area_id"] == 3


def test_set_document_scope_clears_business_area_when_project_is_authoritative():
    app_client = _ScopeClient()
    rag_client = _ScopeClient({"source": "fireflies", "business_area_id": 3})
    store = SupabaseRagStore(client=app_client, rag_client=rag_client)

    result = store.set_document_scope(
        "doc-project",
        project_id=31,
        business_area_id=None,
    )

    assert app_client.updates[0][1] == {
        "project_id": 31,
        "business_area_id": None,
    }
    assert rag_client.updates[0][1] == {
        "project_id": 31,
        "source_metadata": {"source": "fireflies"},
    }
    assert result["project_id"] == 31
    assert result["business_area_id"] is None


def test_set_document_scope_rejects_dual_scope():
    client = _ScopeClient()
    store = SupabaseRagStore(client=client, rag_client=client)

    try:
        store.set_document_scope(
            "doc-invalid",
            project_id=31,
            business_area_id=3,
        )
    except ValueError as exc:
        assert "cannot contain both" in str(exc)
    else:
        raise AssertionError("dual scope must fail loudly")


def test_set_document_scope_preflights_missing_rag_row_before_any_write():
    app_client = _ScopeClient()
    rag_client = _ScopeClient(missing_tables={"rag_document_metadata"})
    store = SupabaseRagStore(client=app_client, rag_client=rag_client)

    with pytest.raises(
        RuntimeError,
        match="no RAG metadata row",
    ):
        store.set_document_scope(
            "doc-missing-rag",
            project_id=None,
            business_area_id=3,
        )

    assert app_client.updates == []
    assert rag_client.updates == []
