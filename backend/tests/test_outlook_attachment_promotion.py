from services.integrations.microsoft_graph import attachment_promotion as promotion


class _FakeBucket:
    def __init__(self):
        self.uploads = []

    def upload(self, path, data, options):
        self.uploads.append(
            {
                "path": path,
                "data": data,
                "options": options,
            }
        )

    def get_public_url(self, path):
        return f"https://storage.example/{path}"


class _FakeStorage:
    def __init__(self):
        self.bucket = _FakeBucket()

    def from_(self, _name):
        return self.bucket


class _FakeSupabase:
    def __init__(self):
        self.storage = _FakeStorage()


class _ConfiguredGraph:
    def is_configured(self):
        return True


class _UnconfiguredGraph:
    def is_configured(self):
        return False


def test_promote_attachment_fetches_bytes_and_uploads_storage(monkeypatch):
    supabase = _FakeSupabase()
    documents = []
    project_documents = []
    status_updates = []

    class _Store:
        def __init__(self, _client):
            self.client = _client

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(promotion, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        promotion,
        "upsert_project_document_by_source",
        lambda _client, payload: project_documents.append(payload),
    )
    monkeypatch.setattr(
        promotion,
        "_update_attachment_status",
        lambda _client, attachment_id, **kwargs: status_updates.append(
            {"attachment_id": attachment_id, **kwargs}
        ),
    )
    monkeypatch.setattr(promotion, "_project_document_id", lambda *_args, **_kwargs: 77)
    monkeypatch.setattr(
        promotion,
        "_fetch_attachment_payload",
        lambda *_args, **_kwargs: {
            "content": None,
            "checksum_sha256": None,
            "extracted_text": "",
        },
    )
    monkeypatch.setattr(promotion, "get_graph_client", lambda: _ConfiguredGraph())
    monkeypatch.setattr(
        promotion,
        "_attachment_bytes_for_intake",
        lambda *_args, **_kwargs: b"%PDF-1.7 fake permit bytes",
    )
    monkeypatch.setattr(
        promotion,
        "_extract_text",
        lambda *_args, **_kwargs: "Extracted permit text",
    )
    monkeypatch.setattr(
        promotion,
        "_existing_document_for_content_hash",
        lambda *_args, **_kwargs: None,
    )

    row = {
        "id": 12,
        "graph_attachment_id": "attachment-1",
        "file_name": "permit.pdf",
        "file_size": 25,
        "content_type": "application/pdf",
        "file_url": "graph://messages/message-1/attachments/attachment-1",
        "is_inline": False,
        "source_metadata": {},
        "intake_email_id": 44,
        "outlook_email_intake": {
            "id": 44,
            "project_id": 876,
            "subject": "Permit package",
            "from_name": "Megan Harrison",
            "from_email": "megan@example.com",
            "body_text": "Latest permit package attached.",
            "graph_message_id": "message-1",
            "mailbox_user_id": "megan@example.com",
            "received_at": "2026-07-01T12:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-1",
            "assignment_method": "project_name",
            "assignment_confidence": 0.91,
            "document_metadata_id": "outlook_message-1",
        },
    }

    result = promotion._promote_attachment(supabase, row)

    assert result["status"] == "promoted"
    assert len(supabase.storage.bucket.uploads) == 1
    assert documents[0]["storage_bucket"] == promotion.DOCUMENT_BUCKET
    assert documents[0]["file_path"].startswith("outlook-attachments/")
    assert documents[0]["url"].startswith("https://storage.example/")
    assert documents[0]["raw_text"] == "Extracted permit text"
    assert documents[0]["status"] == "raw_ingested"
    assert documents[0]["source_metadata"]["storage_copy_status"] == "copied"
    assert project_documents[0]["storage_bucket"] == promotion.DOCUMENT_BUCKET
    assert project_documents[0]["storage_path"] == documents[0]["file_path"]
    assert status_updates[0]["status"] == "promoted"
    assert status_updates[0]["extra"]["project_document_id"] == 77


def test_promote_attachment_uses_metadata_fallback_without_bytes(monkeypatch):
    supabase = _FakeSupabase()
    documents = []

    class _Store:
        def __init__(self, _client):
            self.client = _client

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(promotion, "SupabaseRagStore", _Store)
    monkeypatch.setattr(promotion, "upsert_project_document_by_source", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(promotion, "_update_attachment_status", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(promotion, "_project_document_id", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(
        promotion,
        "_fetch_attachment_payload",
        lambda *_args, **_kwargs: {
            "content": None,
            "checksum_sha256": None,
            "extracted_text": "",
        },
    )
    monkeypatch.setattr(promotion, "get_graph_client", lambda: _UnconfiguredGraph())
    monkeypatch.setattr(
        promotion,
        "_existing_document_for_content_hash",
        lambda *_args, **_kwargs: None,
    )

    row = {
        "id": 14,
        "graph_attachment_id": "attachment-2",
        "file_name": "permit.pdf",
        "file_size": 25,
        "content_type": "application/pdf",
        "file_url": "graph://messages/message-2/attachments/attachment-2",
        "is_inline": False,
        "source_metadata": {},
        "intake_email_id": 45,
        "outlook_email_intake": {
            "id": 45,
            "project_id": 876,
            "subject": "Permit package",
            "from_name": "Megan Harrison",
            "from_email": "megan@example.com",
            "body_text": "Latest permit package attached.",
            "graph_message_id": "message-2",
            "mailbox_user_id": "megan@example.com",
            "received_at": "2026-07-01T12:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-2",
            "assignment_method": "project_name",
            "assignment_confidence": 0.91,
            "document_metadata_id": "outlook_message-2",
        },
    }

    result = promotion._promote_attachment(supabase, row)

    assert result["status"] == "promoted"
    assert supabase.storage.bucket.uploads == []
    assert documents[0]["storage_bucket"] is None
    assert documents[0]["file_path"] is None
    assert documents[0]["url"] == "https://outlook.office.com/mail/message-2"
    assert documents[0]["status"] == "metadata_only"
    assert "Email attachment: permit.pdf" in documents[0]["content"]


def test_should_retry_attachment_promotion_when_project_assignment_arrives():
    assert (
        promotion._should_retry_attachment_promotion(
            {
                "promotion_status": "review_needed",
                "promotion_reason": "missing_project_assignment",
                "outlook_email_intake": {"project_id": 876},
            }
        )
        is True
    )


def test_should_not_retry_review_needed_attachment_without_new_project():
    assert (
        promotion._should_retry_attachment_promotion(
            {
                "promotion_status": "review_needed",
                "promotion_reason": "missing_project_assignment",
                "outlook_email_intake": {"project_id": None},
            }
        )
        is False
    )


def test_should_retry_legacy_review_needed_extension_row_when_project_exists():
    assert (
        promotion._should_retry_attachment_promotion(
            {
                "promotion_status": "review_needed",
                "promotion_reason": "promotable_extension_no_context:pdf",
                "outlook_email_intake": {"project_id": 876},
            }
        )
        is True
    )


def test_classify_attachment_promotes_generic_project_pdf_without_keyword():
    decision = promotion.classify_attachment_for_promotion(
        file_name="meeting-notes.pdf",
        content_type="application/pdf",
        is_inline=False,
        subject="July coordination",
        body_text="Please review the attached file.",
    )

    assert decision.status == "promoted"
    assert decision.category == "Email Attachment"
    assert decision.reason == "extension:pdf"


def test_promote_attachment_reuses_existing_content_hash_document(monkeypatch):
    supabase = _FakeSupabase()
    documents = []
    project_documents = []

    class _Store:
        def __init__(self, _client):
            self.client = _client

        def upsert_document_metadata(self, payload):
            documents.append(payload)

    monkeypatch.setattr(promotion, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        promotion,
        "upsert_project_document_by_source",
        lambda _client, payload: project_documents.append(payload),
    )
    monkeypatch.setattr(promotion, "_update_attachment_status", lambda *_args, **_kwargs: None)
    monkeypatch.setattr(promotion, "_project_document_id", lambda *_args, **_kwargs: 88)
    monkeypatch.setattr(
        promotion,
        "_fetch_attachment_payload",
        lambda *_args, **_kwargs: {
            "content": None,
            "checksum_sha256": "abc123",
            "extracted_text": "",
        },
    )
    monkeypatch.setattr(promotion, "get_graph_client", lambda: _ConfiguredGraph())
    monkeypatch.setattr(
        promotion,
        "_attachment_bytes_for_intake",
        lambda *_args, **_kwargs: b"duplicate bytes",
    )
    monkeypatch.setattr(
        promotion,
        "_existing_document_for_content_hash",
        lambda *_args, **_kwargs: {
            "id": "existing-doc-1",
            "url": "https://storage.example/existing.pdf",
            "storage_bucket": promotion.DOCUMENT_BUCKET,
            "file_path": "outlook-attachments/existing.pdf",
            "source_metadata": {},
        },
    )
    monkeypatch.setattr(
        promotion,
        "_extract_text",
        lambda *_args, **_kwargs: "duplicate text",
    )

    row = {
        "id": 15,
        "graph_attachment_id": "attachment-3",
        "file_name": "permit.pdf",
        "file_size": 25,
        "content_type": "application/pdf",
        "file_url": "graph://messages/message-3/attachments/attachment-3",
        "is_inline": False,
        "source_metadata": {},
        "intake_email_id": 46,
        "outlook_email_intake": {
            "id": 46,
            "project_id": 876,
            "subject": "Permit package",
            "from_name": "Megan Harrison",
            "from_email": "megan@example.com",
            "body_text": "Latest permit package attached.",
            "graph_message_id": "message-3",
            "mailbox_user_id": "megan@example.com",
            "received_at": "2026-07-01T12:00:00Z",
            "web_link": "https://outlook.office.com/mail/message-3",
            "assignment_method": "project_name",
            "assignment_confidence": 0.91,
            "document_metadata_id": "outlook_message-3",
        },
    }

    result = promotion._promote_attachment(supabase, row)

    assert result["status"] == "promoted"
    assert supabase.storage.bucket.uploads == []
    assert documents[0]["url"] == "https://storage.example/existing.pdf"
    assert documents[0]["storage_bucket"] == promotion.DOCUMENT_BUCKET
    assert documents[0]["file_path"] == "outlook-attachments/existing.pdf"
    assert documents[0]["content_hash"] is None
    assert documents[0]["source_metadata"]["storage_copy_status"] == "reused_existing"
    assert documents[0]["source_metadata"]["duplicate_content_hash_of"] == "existing-doc-1"
    assert project_documents[0]["content_hash"] == "abc123"
