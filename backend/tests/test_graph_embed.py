from src.services.integrations.microsoft_graph import embed


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

    def update(self, payload):
        self.action = "update"
        self.payload = payload
        return self

    def upsert(self, payload):
        self.action = "upsert"
        self.payload = payload
        return self

    def delete(self):
        self.action = "delete"
        return self

    def execute(self):
        if self.db.raise_on_app_metadata and self.table_name == "document_metadata":
            raise RuntimeError("document_metadata table is not available")

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
                payload_id = payload.get("id")
                if payload_id is not None:
                    existing = next((row for row in table if row.get("id") == payload_id), None)
                if existing is None:
                    existing = next((row for row in table if row.get("chunk_id") == payload.get("chunk_id")), None)
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
    def __init__(self, tables, *, raise_on_app_metadata=False):
        self.tables = tables
        self.raise_on_app_metadata = raise_on_app_metadata

    def from_(self, table_name):
        return _Table(self, table_name)


def test_embed_graph_document_skips_app_status_update_when_using_rag_metadata(monkeypatch):
    doc_id = "outlook-low-content"
    rag = _Supabase(
        {
            "rag_document_metadata": [
                {
                    "id": doc_id,
                    "title": "Short email",
                    "category": "email",
                    "source": "microsoft_graph",
                    "project_id": None,
                    "type": "email",
                    "source_system": "outlook",
                    "source_item_id": "message-1",
                    "source_web_url": "https://outlook.office.com/mail/message-1",
                    "content": "Thanks",
                    "raw_text": "Thanks",
                }
            ],
            "document_chunks": [{"document_id": doc_id, "chunk_index": 0}],
            "fireflies_ingestion_jobs": [],
        }
    )
    app = _Supabase({}, raise_on_app_metadata=True)

    monkeypatch.setattr(embed, "get_rag_read_client", lambda: rag)
    monkeypatch.setattr(embed, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(embed, "record_source_processing_status", lambda *_args, **_kwargs: None)

    chunks = embed.embed_graph_document(app, doc_id)

    assert chunks == 0
    assert rag.tables["document_chunks"] == []
    assert rag.tables["rag_document_metadata"][0]["embedding_status"] == "skipped"


def test_embed_graph_document_marks_empty_graph_item_skipped_low_content(monkeypatch):
    doc_id = "teams-empty"
    app = _Supabase(
        {
            "document_metadata": [
                {
                    "id": doc_id,
                    "title": "Teams DM Conversation: Empty",
                    "category": "teams_message",
                    "source": "microsoft_graph",
                    "project_id": None,
                    "type": "teams_dm_conversation",
                    "source_system": "teams_dm",
                    "source_item_id": "chat-1",
                    "status": "raw_ingested",
                }
            ],
            "fireflies_ingestion_jobs": [],
        }
    )
    rag = _Supabase(
        {
            "rag_document_metadata": [
                {
                    "id": doc_id,
                    "title": "Teams DM Conversation: Empty",
                    "category": "teams_message",
                    "source": "microsoft_graph",
                    "project_id": None,
                    "type": "teams_dm_conversation",
                    "source_system": "teams_dm",
                    "source_item_id": "chat-1",
                    "content": "",
                    "raw_text": "",
                }
            ],
            "document_chunks": [{"document_id": doc_id, "chunk_index": 0}],
            "fireflies_ingestion_jobs": [],
        }
    )
    recorded = []

    monkeypatch.setattr(embed, "get_rag_read_client", lambda: rag)
    monkeypatch.setattr(embed, "get_rag_write_client", lambda: rag)
    monkeypatch.setattr(embed, "_rehydrate_graph_document_content", lambda *_args, **_kwargs: "")
    monkeypatch.setattr(embed, "_ensure_vision_page_intelligence", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(embed, "_vision_page_chunks", lambda *_args, **_kwargs: [])
    monkeypatch.setattr(
        embed,
        "record_source_processing_status",
        lambda *_args, **kwargs: recorded.append(kwargs),
    )

    chunks = embed.embed_graph_document(app, doc_id)

    assert chunks == 0
    assert app.tables["document_metadata"][0]["status"] == "skipped_low_content"
    assert rag.tables["document_chunks"] == []
    assert rag.tables["rag_document_metadata"][0]["embedding_status"] == "skipped"
    assert recorded[-1]["error_code"] == "skipped_low_content"


def test_graph_embed_success_upserts_missing_rag_metadata():
    rag = _Supabase({"rag_document_metadata": []})
    doc = {
        "id": "onedrive-vision-only",
        "title": "Riser Clamps.pdf",
        "project_id": 1009,
        "source": "microsoft_graph",
        "source_system": "onedrive",
        "source_item_id": "drive-item-1",
        "type": "drawing",
        "category": "document",
        "source_path": "Drawings/Riser Clamps.pdf",
        "source_web_url": "https://example.test/Riser%20Clamps.pdf",
        "status": "ocr_failed",
    }

    embed._upsert_rag_embedding_success(
        rag,
        doc,
        content="",
        chunk_count=1,
        source_type="vision_page_summary",
    )

    assert rag.tables["rag_document_metadata"] == [
        {
            "id": "onedrive-vision-only",
            "app_document_id": "onedrive-vision-only",
            "project_id": 1009,
            "source": "microsoft_graph",
            "source_system": "onedrive",
            "source_item_id": "drive-item-1",
            "title": "Riser Clamps.pdf",
            "type": "drawing",
            "category": "document",
            "storage_bucket": None,
            "storage_path": "Drawings/Riser Clamps.pdf",
            "source_web_url": "https://example.test/Riser%20Clamps.pdf",
            "content_length": 0,
            "embedding_status": "embedded",
            "embedding_attempts": 0,
            "embedding_error": None,
            "parsing_status": "ocr_failed",
            "processing_metadata": {
                "app_status": "ocr_failed",
                "chunk_count": 1,
                "source_type": "vision_page_summary",
                "embedding_path": "microsoft_graph.embed_graph_document",
            },
            "last_content_loaded_at": rag.tables["rag_document_metadata"][0]["last_content_loaded_at"],
        }
    ]


def test_graph_embed_has_no_legacy_intelligence_callback():
    assert not hasattr(embed, "_run_source_intelligence_compiler")
    assert not hasattr(embed, "GRAPH_EMBED_INLINE_SOURCE_INTELLIGENCE")
