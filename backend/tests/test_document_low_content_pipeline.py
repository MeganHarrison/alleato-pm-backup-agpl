from src.services.pipeline import embedder


class _Result:
    def __init__(self, data=None):
        self.data = data


class _Table:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self.rows = list(db.tables.setdefault(table_name, []))
        self.action = "select"
        self.payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def single(self):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def upsert(self, payload, **_kwargs):
        self.action = "upsert"
        self.payload = payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def execute(self):
        table = self.db.tables.setdefault(self.table_name, [])
        if self.action == "update":
            matching_ids = {id(row) for row in self.rows}
            updated = []
            for row in table:
                if id(row) in matching_ids:
                    row.update(self.payload)
                    updated.append(dict(row))
            return _Result(updated)
        if self.action == "upsert":
            payloads = self.payload if isinstance(self.payload, list) else [self.payload]
            upserted = []
            for payload in payloads:
                existing = None
                for key in ("id", "chunk_id"):
                    value = payload.get(key)
                    if value is not None:
                        existing = next((row for row in table if row.get(key) == value), None)
                    if existing is not None:
                        break
                if existing is None:
                    table.append(dict(payload))
                    upserted.append(dict(payload))
                else:
                    existing.update(payload)
                    upserted.append(dict(existing))
            return _Result(upserted)
        if self.action == "delete":
            matching_ids = {id(row) for row in self.rows}
            self.db.tables[self.table_name] = [row for row in table if id(row) not in matching_ids]
            return _Result([])
        if self.rows and len(self.rows) == 1:
            return _Result(dict(self.rows[0]))
        return _Result([dict(row) for row in self.rows])


class _Supabase:
    def __init__(self, tables):
        self.tables = tables

    def table(self, table_name):
        return _Table(self, table_name)


def test_embedder_marks_no_segment_no_vision_document_skipped_low_content(monkeypatch):
    metadata_id = "low-content-doc"
    app = _Supabase(
        {
            "document_metadata": [
                {
                    "id": metadata_id,
                    "title": "Blank W-9.pdf",
                    "source": "upload",
                    "source_system": "manual_upload",
                    "type": "document",
                    "category": "document",
                    "document_type": "pdf",
                    "project_id": 25125,
                    "status": "skipped_low_content",
                }
            ],
            "meeting_segments": [],
            "document_page_intelligence": [],
            "fireflies_ingestion_jobs": [],
        }
    )
    rag = _Supabase(
        {
            "rag_document_metadata": [],
            "document_chunks": [
                {
                    "chunk_id": f"{metadata_id}__ff_meeting_summary_-1_0",
                    "document_id": metadata_id,
                    "text": (
                        "Minimal extract for 'Blank W-9.pdf'. Parsed content was only "
                        "0 characters and may require OCR or a different source format."
                    ),
                }
            ],
        }
    )
    job_updates = []

    monkeypatch.setattr(embedder, "get_supabase_client", lambda: app)
    monkeypatch.setattr(embedder, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(embedder, "get_rag_read_client", lambda: rag)
    monkeypatch.setattr(embedder, "fetch_optional_row", lambda *_args, **_kwargs: {})
    monkeypatch.setattr(
        embedder,
        "update_ingestion_job_state",
        lambda *args, **kwargs: job_updates.append({"args": args, "kwargs": kwargs}),
    )
    monkeypatch.setattr(
        embedder.llm,
        "batch_embed",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(AssertionError("low-content docs should not embed")),
    )

    result = embedder.run_embedder(metadata_id)

    assert result == {
        "metadataId": metadata_id,
        "chunkCount": 0,
        "segmentCount": 0,
        "skipped": True,
        "skipReason": "skipped_low_content",
    }
    assert rag.tables["document_chunks"] == []
    assert app.tables["document_metadata"][0]["status"] == "skipped_low_content"
    assert rag.tables["rag_document_metadata"][0]["embedding_status"] == "skipped_low_content"
    assert "no searchable text" in rag.tables["rag_document_metadata"][0]["embedding_error"]
    assert job_updates[-1]["kwargs"]["stage"] == "done"


def test_embedder_skips_graph_conversation_docs_owned_by_graph_embedder(monkeypatch):
    metadata_id = "outlook_conversation_123"
    app = _Supabase(
        {
            "document_metadata": [
                {
                    "id": metadata_id,
                    "title": "Outlook conversation: Permit",
                    "source": "microsoft_graph",
                    "source_system": "outlook",
                    "type": "email",
                    "category": "email",
                    "document_type": "email_message",
                    "source_metadata": {"document_kind": "outlook_conversation"},
                    "status": "raw_ingested",
                }
            ],
            "fireflies_ingestion_jobs": [],
        }
    )
    rag = _Supabase({"document_chunks": []})
    job_updates = []

    monkeypatch.setattr(embedder, "get_supabase_client", lambda: app)
    monkeypatch.setattr(embedder, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(
        embedder,
        "fetch_optional_row",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("generic embedder must not hydrate Outlook conversation content")
        ),
    )
    monkeypatch.setattr(
        embedder,
        "update_ingestion_job_state",
        lambda *args, **kwargs: job_updates.append({"args": args, "kwargs": kwargs}),
    )
    monkeypatch.setattr(
        embedder.llm,
        "batch_embed",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("generic embedder must not embed Outlook conversation docs")
        ),
    )

    result = embedder.run_embedder(metadata_id)

    assert result == {
        "metadataId": metadata_id,
        "chunkCount": 0,
        "segmentCount": 0,
        "skipped": True,
        "skipReason": "owned_by_graph_embedder",
    }
    assert job_updates[-1]["kwargs"]["stage"] == "done"


def test_embedder_skips_teams_dm_conversation_docs_owned_by_graph_embedder(monkeypatch):
    metadata_id = "teamsdm_chat_2026-07-06"
    app = _Supabase(
        {
            "document_metadata": [
                {
                    "id": metadata_id,
                    "title": "Teams DM Conversation: Operations",
                    "source": "microsoft_graph",
                    "source_system": None,
                    "type": "teams_dm_conversation",
                    "category": "teams_message",
                    "source_metadata": {
                        "teams_chat_id": "chat-1",
                        "source_day": "2026-07-06",
                    },
                    "status": "raw_ingested",
                }
            ],
            "fireflies_ingestion_jobs": [],
        }
    )
    rag = _Supabase({"document_chunks": []})
    job_updates = []

    monkeypatch.setattr(embedder, "get_supabase_client", lambda: app)
    monkeypatch.setattr(embedder, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(
        embedder,
        "fetch_optional_row",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("generic embedder must not hydrate Teams conversation content")
        ),
    )
    monkeypatch.setattr(
        embedder,
        "update_ingestion_job_state",
        lambda *args, **kwargs: job_updates.append({"args": args, "kwargs": kwargs}),
    )
    monkeypatch.setattr(
        embedder.llm,
        "batch_embed",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            AssertionError("generic embedder must not embed Teams conversation docs")
        ),
    )

    result = embedder.run_embedder(metadata_id)

    assert result == {
        "metadataId": metadata_id,
        "chunkCount": 0,
        "segmentCount": 0,
        "skipped": True,
        "skipReason": "owned_by_graph_embedder",
    }
    assert job_updates[-1]["kwargs"]["stage"] == "done"


def test_embedder_preserves_rag_text_when_app_document_text_is_empty(monkeypatch):
    metadata_id = "submittal-doc-1"
    app = _Supabase(
        {
            "document_metadata": [
                {
                    "id": metadata_id,
                    "title": "Equipment Submittal.pdf",
                    "source": "upload",
                    "source_system": "jobplanner",
                    "type": "document",
                    "category": "document",
                    "document_type": "pdf",
                    "project_id": 876,
                    "status": "segmented",
                    "content": None,
                    "raw_text": None,
                    "summary": None,
                    "overview": None,
                    "source_metadata": {},
                }
            ],
            "meeting_segments": [
                {
                    "id": "segment-1",
                    "metadata_id": metadata_id,
                    "segment_index": 0,
                    "title": "Equipment Schedule",
                    "start_index": 0,
                    "end_index": 1,
                    "summary": "Equipment schedule excerpt",
                    "decisions": [],
                    "risks": [],
                    "tasks": [],
                }
                ,
                {
                    "id": "segment-2",
                    "metadata_id": metadata_id,
                    "segment_index": 1,
                    "title": "Approvals",
                    "start_index": 2,
                    "end_index": 2,
                    "summary": "Approval requirements excerpt",
                    "decisions": [],
                    "risks": [],
                    "tasks": [],
                },
            ],
            "document_page_intelligence": [],
            "fireflies_ingestion_jobs": [],
        }
    )
    rag = _Supabase(
        {
            "rag_document_metadata": [],
            "document_chunks": [],
        }
    )
    job_updates = []
    rag_row = {
        "content": "Line 1\nLine 2",
        "raw_text": "Line 1\nLine 2",
        "summary": "RAG summary",
        "overview": "RAG overview",
    }

    monkeypatch.setattr(embedder, "get_supabase_client", lambda: app)
    monkeypatch.setattr(embedder, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(embedder, "get_rag_read_client", lambda: rag)
    monkeypatch.setattr(embedder, "fetch_optional_row", lambda *_args, **_kwargs: rag_row)
    monkeypatch.setattr(
        embedder,
        "update_ingestion_job_state",
        lambda *args, **kwargs: job_updates.append({"args": args, "kwargs": kwargs}),
    )
    monkeypatch.setattr(embedder.llm, "batch_embed", lambda texts: [[0.1, 0.2]] * len(texts))

    result = embedder.run_embedder(metadata_id)

    assert result["metadataId"] == metadata_id
    assert result["chunkCount"] >= 1
    assert app.tables["document_metadata"][0]["status"] == "embedded"
    rag_metadata = rag.tables["rag_document_metadata"][0]
    assert rag_metadata["content"] == "Line 1\nLine 2"
    assert rag_metadata["raw_text"] == "Line 1\nLine 2"
    assert rag_metadata["summary"] == "RAG summary"
    assert rag_metadata["overview"] == "RAG overview"
    assert rag_metadata["embedding_status"] == "embedded"
    assert any(chunk["document_id"] == metadata_id for chunk in rag.tables["document_chunks"])
    assert job_updates[-1]["kwargs"]["stage"] == "embedded"
