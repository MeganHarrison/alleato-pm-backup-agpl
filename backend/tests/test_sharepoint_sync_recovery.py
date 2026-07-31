from src.services.integrations.microsoft_graph import sync
from src.services.integrations.microsoft_graph import onedrive
from src.services.integrations.microsoft_graph.client import (
    DeltaFetchBatch,
    GraphClient,
)
from src.services.integrations.microsoft_graph.onedrive import SharePointSyncResult
from src.services.ingestion.project_assignment import AssignmentTarget
from src.services.supabase_helpers import SupabaseRagStore
import io
import subprocess
import zipfile


class _FakeGraph:
    def is_configured(self):
        return True


class _FakeSupabase:
    pass


def test_graph_download_headers_never_send_bearer_to_external_hosts(monkeypatch):
    client = GraphClient()
    token_calls = []

    def _token():
        token_calls.append(True)
        return "test-token"

    monkeypatch.setattr(client, "_get_token", _token)

    assert (
        client._download_headers(
        "https://example.supabase.co/storage/v1/object/public/drawings/file.pdf"
        )
        == {}
    )
    assert (
        client._download_headers(
        "https://alleato.sharepoint.com/:b:/r/sites/Alleato/file.pdf?download=1"
        )
        == {}
    )
    assert token_calls == []

    assert client._download_headers(
        "https://graph.microsoft.com/v1.0/drives/drive/items/item/content"
    ) == {"Authorization": "Bearer test-token"}
    assert token_calls == [True]


class _EmptyMetadataQuery:
    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Result", (), {"data": []})()


class _EmptyMetadataSupabase:
    def from_(self, table_name):
        assert table_name == "document_metadata"
        return _EmptyMetadataQuery()


class _FailingDownloadGraph:
    def is_configured(self):
        return True

    def get(self, _path):
        return {"id": "site-id"}

    def get_delta(self, _path, _delta_token, **kwargs):
        self.delta_kwargs = kwargs
        return (
            [
            {
                "id": "file-1",
                "name": "handoff.txt",
                "size": 100,
                "@microsoft.graph.downloadUrl": "https://download.example/file-1",
            }
            ],
            "new-delta",
        )

    def download_bytes(self, _url):
        raise RuntimeError("temporary download failure")


class _LowContentGraph(_FailingDownloadGraph):
    def download_bytes(self, _url):
        return b"tiny"


class _UnsupportedFileGraph(_FailingDownloadGraph):
    def get_delta(self, _path, _delta_token, **_kwargs):
        return ([{"id": "file-2", "name": "estimate.pages", "size": 100}], "new-delta")


class _NonTextFileGraph(_FailingDownloadGraph):
    def get_delta(self, _path, _delta_token, **_kwargs):
        return ([{"id": "file-3", "name": "site-photo.heic", "size": 100}], "new-delta")


class _RevisionGraph(_FailingDownloadGraph):
    def __init__(self, etag):
        self.etag = etag
        self.downloaded = 0

    def get_delta(self, _path, _delta_token, **_kwargs):
        return (
            [
                {
                    "id": "file-4",
                    "name": "proposal.txt",
                    "size": 100,
                    "eTag": self.etag,
                    "lastModifiedDateTime": "2026-07-24T09:00:00Z",
                    "@microsoft.graph.downloadUrl": "https://download.example/file-4",
                    "webUrl": "https://sharepoint.example/file-4",
                    "parentReference": {
                        "path": "/drive/root:/Alleato Group/Alleato Group-Shared/"
                        "2026 Jobs/26-119 - Union Collective/05 - Proposal"
                    },
                }
            ],
            "new-delta",
        )

    def download_bytes(self, _url):
        self.downloaded += 1
        return (
            b"This is the full revised proposal content with enough material to index."
        )


class _ScannedPdfGraph(_RevisionGraph):
    def get_delta(self, _path, _delta_token, **kwargs):
        items, cursor = super().get_delta(_path, _delta_token, **kwargs)
        items[0]["name"] = "scanned-proposal.pdf"
        return items, cursor

    def download_bytes(self, _url):
        self.downloaded += 1
        return b"%PDF image-only"


class _ExistingDocumentQuery:
    def __init__(self, row):
        self.row = row

    def select(self, *_args, **_kwargs):
        return self

    def update(self, payload):
        self.row.update(payload)
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def execute(self):
        return type("Result", (), {"data": [self.row]})()


class _ExistingDocumentSupabase:
    def __init__(self, row):
        self.row = row
        self.storage = type(
            "Storage",
            (),
            {"from_": lambda _self, _bucket: object()},
        )()

    def from_(self, table_name):
        assert table_name == "document_metadata"
        return _ExistingDocumentQuery(self.row)


class _InvalidationQuery:
    def __init__(self, client, table_name):
        self.client = client
        self.table_name = table_name
        self.operation = "select"
        self.payload = None

    def delete(self):
        self.operation = "delete"
        return self

    def select(self, *_args):
        self.operation = "select"
        return self

    def update(self, payload):
        self.operation = "update"
        self.payload = payload
        return self

    def eq(self, *_args):
        return self

    def limit(self, *_args):
        return self

    def execute(self):
        self.client.events.append((self.table_name, self.operation, self.payload))
        if self.table_name == "rag_document_metadata" and self.operation == "select":
            return type(
                "Result",
                (),
                {"data": [{"id": "sharepoint_file-4", "processing_metadata": {}}]},
            )()
        if self.table_name == "rag_document_metadata" and self.operation == "update":
            return type("Result", (), {"data": [{"id": "sharepoint_file-4"}]})()
        return type("Result", (), {"data": []})()


class _InvalidationClient:
    def __init__(self):
        self.events = []

    def table(self, table_name):
        return _InvalidationQuery(self, table_name)


def test_rag_content_invalidation_deletes_chunks_before_clearing_metadata():
    rag_client = _InvalidationClient()
    store = SupabaseRagStore(client=object(), rag_client=rag_client)

    existed = store.invalidate_document_content(
        "sharepoint_file-4",
        parsing_status="no_text",
        embedding_status="pending_ocr",
        reason="current source revision needs OCR",
    )

    assert existed is True
    assert rag_client.events[0][:2] == ("document_chunks", "delete")
    assert rag_client.events[1][:2] == ("rag_document_metadata", "select")
    assert rag_client.events[2][:2] == ("rag_document_metadata", "update")
    update_payload = rag_client.events[2][2]
    assert update_payload["content"] is None
    assert update_payload["raw_text"] is None
    assert update_payload["content_hash"] is None
    assert update_payload["content_length"] == 0
    assert update_payload["embedding_status"] == "pending_ocr"


def test_graph_catalog_uses_item_revision_not_globally_unique_content_hash():
    store = object.__new__(SupabaseRagStore)

    app_payload = store._app_document_catalog_payload(
        {
            "id": "sharepoint_file-4",
            "source_system": "sharepoint",
            "source_item_id": "file-4",
            "source_etag": '"revision-two"',
            "content_hash": "duplicate-content-is-valid-across-project-folders",
        }
    )
    rag_payload = store._rag_document_metadata_payload(
        {
            "id": "sharepoint_file-4",
            "source_system": "sharepoint",
            "source_item_id": "file-4",
            "source_etag": '"revision-two"',
            "content": "same source content",
            "content_hash": "duplicate-content-is-valid-across-project-folders",
        }
    )

    assert "content_hash" not in app_payload
    assert (
        rag_payload["content_hash"]
        == "duplicate-content-is-valid-across-project-folders"
    )


def test_sharepoint_download_failure_preserves_prior_delta(monkeypatch):
    graph = _FailingDownloadGraph()
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"
    assert graph.delta_kwargs == {"max_pages": 100, "max_items": 10000}


def test_sharepoint_bootstrap_fails_if_inventory_cap_hides_delta_link(
    monkeypatch,
):
    class _CappedBootstrapGraph(_FailingDownloadGraph):
        def get_delta(self, _path, _delta_token, **kwargs):
            self.delta_kwargs = kwargs
            return ([{"id": "partial-item", "name": "partial.txt"}], "")

    graph = _CappedBootstrapGraph()
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)

    try:
        onedrive.sync_sharepoint_folder(
            _EmptyMetadataSupabase(),
            "alleato.sharepoint.com",
            "AlleatoGroup",
            "/2026 Jobs/26-103",
            None,
        )
    except RuntimeError as exc:
        assert "without either an @odata.deltaLink or an @odata.nextLink" in str(exc)
    else:
        raise AssertionError("capped bootstrap must not masquerade as complete")

    assert graph.delta_kwargs == {"max_pages": 100, "max_items": 10000}


def test_sharepoint_capped_incremental_inventory_saves_next_page_cursor(monkeypatch):
    class _CappedIncrementalGraph(_NonTextFileGraph):
        def get_delta_batch(self, _path, _delta_token, **kwargs):
            self.delta_kwargs = kwargs
            return DeltaFetchBatch(
                items=[
                    {
                        "id": "file-10000",
                        "name": "site-photo.heic",
                        "size": 100,
                    }
                ],
                next_cursor="https://graph.microsoft.com/next-page-10001",
                complete=False,
                pages_fetched=100,
            )

    graph = _CappedIncrementalGraph()
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "AlleatoGroup",
        "/2026 Jobs/26-103",
        "previous-delta",
    )

    assert result.items_excluded == 1
    assert result.inventory_complete is False
    assert result.retry_required is True
    assert result.delta_token == "https://graph.microsoft.com/next-page-10001"
    assert "continuation cursor was saved" in result.retry_reason
    assert graph.delta_kwargs == {"max_pages": 100, "max_items": 10000}


def test_graph_delta_batch_exposes_next_link_without_changing_legacy_contract():
    class _PagedGraphClient(GraphClient):
        def __init__(self):
            pass

        def get(self, _url):
            return {
                "value": [{"id": "item-1"}, {"id": "item-2"}],
                "@odata.nextLink": "https://graph.microsoft.com/next-page",
            }

    graph = _PagedGraphClient()
    batch = graph.get_delta_batch(
        "/sites/site-id/drive/root/delta",
        "previous-delta",
        max_pages=1,
        max_items=1,
    )
    legacy_items, legacy_cursor = graph.get_delta(
        "/sites/site-id/drive/root/delta",
        "previous-delta",
        max_pages=1,
        max_items=1,
    )

    assert batch.items == [{"id": "item-1"}]
    assert batch.next_cursor == "https://graph.microsoft.com/next-page"
    assert batch.complete is False
    assert legacy_items == [{"id": "item-1"}]
    assert legacy_cursor == "previous-delta"


def test_pptx_extractor_reads_slide_and_notes_text():
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr(
            "ppt/slides/slide1.xml",
            '<p:sld xmlns:p="p" xmlns:a="a"><a:t>Decision needed</a:t></p:sld>',
        )
        archive.writestr(
            "ppt/notesSlides/notesSlide1.xml",
            '<p:notes xmlns:p="p" xmlns:a="a"><a:t>Approve alternates</a:t></p:notes>',
        )

    text = onedrive._extract_text(payload.getvalue(), ".pptx")

    assert "Decision needed" in text
    assert "Approve alternates" in text


def test_eml_extractor_reads_headers_plain_text_and_html():
    content = (
        b"Subject: Budget decision\\r\\n"
        b"From: pm@example.com\\r\\n"
        b"To: owner@example.com\\r\\n"
        b"MIME-Version: 1.0\\r\\n"
        b"Content-Type: multipart/alternative; boundary=abc\\r\\n\\r\\n"
        b"--abc\\r\\nContent-Type: text/plain; charset=utf-8\\r\\n\\r\\n"
        b"Approve the change request.\\r\\n"
        b"--abc\\r\\nContent-Type: text/html; charset=utf-8\\r\\n\\r\\n"
        b"<p>Risk is schedule loss.</p>\\r\\n--abc--\\r\\n"
    )

    text = onedrive._extract_text(content, ".eml")

    assert "Subject: Budget decision" in text
    assert "Approve the change request." in text
    assert "Risk is schedule loss." in text


def test_rtf_extractor_reads_controlled_text():
    text = onedrive._extract_text(
        rb"{\rtf1\ansi Project risk\par Owner decision}",
        ".rtf",
    )

    assert "Project risk" in text
    assert "Owner decision" in text


def test_legacy_doc_extractor_uses_antiword_for_complete_text(monkeypatch):
    calls = []

    def _run(command, **kwargs):
        calls.append((command, kwargs))
        return subprocess.CompletedProcess(
            command,
            0,
            stdout=b"Joint proposal scope\\nOwner decision required\\n",
            stderr=b"",
        )

    monkeypatch.setattr(onedrive.subprocess, "run", _run)

    text = onedrive._extract_text(b"legacy-ole-word-bytes", ".doc")

    assert "Joint proposal scope" in text
    assert "Owner decision required" in text
    assert calls[0][0][0] == "antiword"
    assert calls[0][1]["timeout"] == 60


def test_mpp_extractor_fails_loudly_after_governed_timeout(monkeypatch):
    monkeypatch.setenv("MPP_EXTRACTION_TIMEOUT_SECONDS", "15")

    def _timeout(command, **_kwargs):
        raise subprocess.TimeoutExpired(command, timeout=15)

    monkeypatch.setattr(onedrive.subprocess, "run", _timeout)

    try:
        onedrive._extract_text_from_mpp(b"mpp-bytes")
    except RuntimeError as exc:
        assert "15-second timeout" in str(exc)
    else:
        raise AssertionError("MPP timeout must fail loudly")


def test_docx_openxml_fallback_reads_body_and_headers(monkeypatch):
    import docx

    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="w"><w:body><w:p>'
            "<w:r><w:t>Rack and pipe tracker decision</w:t></w:r>"
            "</w:p></w:body></w:document>",
        )
        archive.writestr(
            "word/header1.xml",
            '<w:hdr xmlns:w="w"><w:p><w:r>'
            "<w:t>Project 26-104</w:t>"
            "</w:r></w:p></w:hdr>",
        )

    def _malformed_package(_stream):
        raise ValueError("officeDocument relationship points to a themeManager part")

    monkeypatch.setattr(docx, "Document", _malformed_package)

    text = onedrive._extract_text(payload.getvalue(), ".docx")

    assert "Rack and pipe tracker decision" in text
    assert "Project 26-104" in text


def test_image_only_docx_exposes_governed_embedded_images_for_ocr():
    payload = io.BytesIO()
    with zipfile.ZipFile(payload, "w") as archive:
        archive.writestr(
            "word/document.xml",
            '<w:document xmlns:w="w"><w:body/></w:document>',
        )
        archive.writestr("word/media/image2.png", b"png-bytes")
        archive.writestr("word/media/image1.jpeg", b"jpeg-bytes")
        archive.writestr("word/media/unsupported.svg", b"svg-bytes")

    names = onedrive._docx_embedded_image_names(payload.getvalue())

    assert names == [
        "word/media/image1.jpeg",
        "word/media/image2.png",
    ]


def test_sharepoint_supported_file_with_insufficient_text_preserves_prior_delta(
    monkeypatch,
):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _LowContentGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"
    assert result.retry_reason == (
        "1 SharePoint file(s) failed; the prior delta cursor was preserved for automatic retry."
    )


def test_sharepoint_extractor_exception_preserves_prior_delta(monkeypatch):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _LowContentGraph())
    monkeypatch.setattr(
        onedrive,
        "_extract_text",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("parser timed out")
        ),
    )

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"


def test_sharepoint_unsupported_file_type_fails_closed_instead_of_advancing_delta(
    monkeypatch,
):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _UnsupportedFileGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_synced == 0
    assert result.items_failed == 1
    assert result.retry_required is True
    assert result.delta_token == "previous-delta"


def test_sharepoint_governed_non_text_file_is_counted_and_cursor_advances(monkeypatch):
    monkeypatch.setattr(onedrive, "get_graph_client", lambda: _NonTextFileGraph())

    result = onedrive.sync_sharepoint_folder(
        _EmptyMetadataSupabase(),
        "alleato.sharepoint.com",
        "Operations",
        "/SOP",
        "previous-delta",
    )

    assert result.items_excluded == 1
    assert result.excluded_by_extension == {".heic": 1}
    assert result.items_failed == 0
    assert result.retry_required is False
    assert result.delta_token == "new-delta"


def test_sharepoint_same_etag_is_idempotent_and_does_not_download(monkeypatch):
    graph = _RevisionGraph('"same"')

    class _Store:
        def __init__(self, _client):
            pass

        def fetch_rag_document_metadata(self, _document_id):
            return {"id": "sharepoint_file-4"}

        def set_document_scope(self, *_args, **_kwargs):
            return None

    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)
    monkeypatch.setattr(onedrive, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        onedrive,
        "_target_for_matched_project",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=1009,
            business_area_id=None,
            method="existing_project",
            confidence=1.0,
        ),
    )
    monkeypatch.setattr(
        onedrive, "_promote_to_project_documents", lambda **_kwargs: None
    )

    result = onedrive.sync_sharepoint_folder(
        _ExistingDocumentSupabase(
            {
                "id": "sharepoint_file-4",
                "project_id": 1009,
                "source_etag": '"same"',
                "source_last_modified_at": "2026-07-24T08:00:00Z",
                "status": "embedded",
            }
        ),
        "alleato.sharepoint.com",
        "AlleatoGroup",
        "/Alleato Group/Alleato Group-Shared/2026 Jobs/26-119 - Union Collective",
        "previous-delta",
        expected_project_number="26-119",
    )

    assert result.items_unchanged == 1
    assert result.items_synced == 0
    assert graph.downloaded == 0
    assert result.delta_token == "new-delta"


def test_sharepoint_changed_etag_refreshes_content_and_resets_embedding(monkeypatch):
    graph = _RevisionGraph('"new"')
    captured = {}
    invalidations = []

    class _Store:
        def __init__(self, _client):
            pass

        def invalidate_document_content(self, document_id, **kwargs):
            invalidations.append({"document_id": document_id, **kwargs})
            return True

        def fetch_rag_document_metadata(self, _document_id):
            return {"id": "sharepoint_file-4"}

        def upsert_document_metadata(self, payload):
            captured.update(payload)

    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)
    monkeypatch.setattr(onedrive, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        onedrive,
        "_target_for_matched_project",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=1009,
            business_area_id=None,
            method="existing_project",
            confidence=1.0,
        ),
    )
    monkeypatch.setattr(
        onedrive,
        "storage_upload_with_retry",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        onedrive, "_promote_to_project_documents", lambda **_kwargs: None
    )

    result = onedrive.sync_sharepoint_folder(
        _ExistingDocumentSupabase(
            {
                "id": "sharepoint_file-4",
                "project_id": 1009,
                "source_etag": '"old"',
                "source_last_modified_at": "2026-07-23T08:00:00Z",
                "status": "embedded",
            }
        ),
        "alleato.sharepoint.com",
        "AlleatoGroup",
        "/Alleato Group/Alleato Group-Shared/2026 Jobs/26-119 - Union Collective",
        "previous-delta",
        expected_project_number="26-119",
    )

    assert result.items_synced == 1
    assert graph.downloaded == 1
    assert captured["embedding_status"] == "pending"
    assert captured["parsing_status"] == "raw_ingested"
    assert captured["source_etag"] == '"new"'
    assert captured["project_id"] == 1009
    assert len(captured["content_hash"]) == 64
    assert invalidations == [
        {
            "document_id": "sharepoint_file-4",
            "parsing_status": "source_revision_changed",
            "embedding_status": "pending",
            "reason": (
                "SharePoint eTag or last-modified revision changed; "
                "previous chunks cannot remain searchable"
            ),
        }
    ]


def test_scanned_sharepoint_pdf_is_cataloged_for_ocr_without_advancing_as_complete(
    monkeypatch,
):
    graph = _ScannedPdfGraph('"new"')
    captured = {}
    invalidations = []

    class _Store:
        def __init__(self, _client):
            pass

        def invalidate_document_content(self, document_id, **kwargs):
            invalidations.append({"document_id": document_id, **kwargs})
            return True

        def fetch_rag_document_metadata(self, _document_id):
            return {"id": "sharepoint_file-4"}

        def upsert_document_metadata(self, payload):
            captured.update(payload)

    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)
    monkeypatch.setattr(onedrive, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        onedrive,
        "_target_for_matched_project",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=1009,
            business_area_id=None,
            method="existing_project",
            confidence=1.0,
        ),
    )
    monkeypatch.setattr(
        onedrive, "_promote_to_project_documents", lambda **_kwargs: None
    )

    result = onedrive.sync_sharepoint_folder(
        _ExistingDocumentSupabase(
            {
                "id": "sharepoint_file-4",
                "project_id": 1009,
                "source_etag": '"old"',
                "source_last_modified_at": "2026-07-23T08:00:00Z",
                "status": "embedded",
            }
        ),
        "alleato.sharepoint.com",
        "AlleatoGroup",
        "/Alleato Group/Alleato Group-Shared/2026 Jobs/26-119 - Union Collective",
        "previous-delta",
        expected_project_number="26-119",
    )

    assert result.items_synced == 1
    assert result.retry_required is False
    assert graph.downloaded == 0
    assert captured["status"] == "no_text"
    assert captured["source_metadata"]["ocr_required"] is True
    assert captured["source_metadata"]["ocr_transport"] == "streamed_pdf"
    assert captured["content_hash"] is None
    assert captured["content"] is None
    assert [call["parsing_status"] for call in invalidations] == [
        "source_revision_changed",
        "no_text",
    ]
    assert captured["source_web_url"] is not None


def test_sharepoint_same_revision_without_rag_replica_rehydrates(monkeypatch):
    graph = _RevisionGraph('"same"')
    captured = {}

    class _Store:
        def __init__(self, _client):
            pass

        def fetch_rag_document_metadata(self, _document_id):
            return None

        def upsert_document_metadata(self, payload):
            captured.update(payload)

    monkeypatch.setattr(onedrive, "get_graph_client", lambda: graph)
    monkeypatch.setattr(onedrive, "SupabaseRagStore", _Store)
    monkeypatch.setattr(
        onedrive,
        "_target_for_matched_project",
        lambda *_args, **_kwargs: AssignmentTarget(
            project_id=1009,
            business_area_id=None,
            method="existing_project",
            confidence=1.0,
        ),
    )
    monkeypatch.setattr(
        onedrive,
        "storage_upload_with_retry",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        onedrive,
        "_promote_to_project_documents",
        lambda **_kwargs: None,
    )

    result = onedrive.sync_sharepoint_folder(
        _ExistingDocumentSupabase(
            {
                "id": "sharepoint_file-4",
                "project_id": 1009,
                "source_etag": '"same"',
                "source_last_modified_at": "2026-07-24T08:00:00Z",
                "status": "raw_ingested",
            }
        ),
        "alleato.sharepoint.com",
        "AlleatoGroup",
        "/Alleato Group/Alleato Group-Shared/2026 Jobs/26-119 - Union Collective",
        "previous-delta",
        expected_project_number="26-119",
    )

    assert result.items_synced == 1
    assert result.items_unchanged == 0
    assert graph.downloaded == 1
    assert captured["id"] == "sharepoint_file-4"
    assert captured["embedding_status"] == "pending"
    assert "full revised proposal content" in captured["content"]


def test_sharepoint_file_failures_preserve_delta_and_schedule_recovery(monkeypatch):
    saved_states = []
    runs = []

    monkeypatch.setattr(sync, "get_graph_client", lambda: _FakeGraph())
    monkeypatch.setenv("GRAPH_SYNC_OUTLOOK", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS_DM", "false")
    monkeypatch.setenv("GRAPH_SYNC_ONEDRIVE", "false")
    monkeypatch.setenv(
        "SHAREPOINT_SYNC_FOLDERS", "alleato.sharepoint.com/Operations:/SOP"
    )
    monkeypatch.setattr(
        sync,
        "_get_sharepoint_sync_states",
        lambda resource_ids: {resource_ids[0]: {"delta_token": "previous-delta"}},
    )
    monkeypatch.setattr(
        sync,
        "sync_sharepoint_folder",
        lambda *_args, **_kwargs: SharePointSyncResult(
            items_synced=3,
            delta_token="previous-delta",
            items_failed=2,
            retry_required=True,
            retry_reason="Two named workbook extractions failed; replay required.",
        ),
    )
    monkeypatch.setattr(
        sync, "_save_sync_state", lambda *args, **_kwargs: saved_states.append(args)
    )
    monkeypatch.setattr(
        sync, "_record_sync_run_safe", lambda *_args, **kwargs: runs.append(kwargs)
    )

    result = sync._run_graph_source_reconciliation(
        _FakeSupabase(),
        run_sharepoint=True,
        run_outlook=False,
        run_teams=False,
        run_onedrive=False,
        outlook_users=None,
        verify_outlook_persisted_count=False,
    )

    assert result["sharepoint"] == 3
    assert result["sharepoint_failed"] == 2
    assert result["status"] == "complete_with_errors"
    assert saved_states[0][4] == "previous-delta"
    assert saved_states[0][6] == "warning"
    assert (
        saved_states[0][7] == "Two named workbook extractions failed; replay required."
    )
    assert runs[0]["status"] == "warning"
    assert runs[0]["items_failed"] == 2
    assert (
        runs[0]["error_message"]
        == "Two named workbook extractions failed; replay required."
    )
    assert runs[0]["metadata"]["retry_scheduled"] is True
    assert runs[0]["metadata"]["scope_source"] == "explicit"


def test_sharepoint_folder_exception_keeps_existing_delta(monkeypatch):
    saved_states = []

    monkeypatch.setattr(sync, "get_graph_client", lambda: _FakeGraph())
    monkeypatch.setenv("GRAPH_SYNC_OUTLOOK", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS", "false")
    monkeypatch.setenv("GRAPH_SYNC_TEAMS_DM", "false")
    monkeypatch.setenv("GRAPH_SYNC_ONEDRIVE", "false")
    monkeypatch.setenv(
        "SHAREPOINT_SYNC_FOLDERS", "alleato.sharepoint.com/Operations:/SOP"
    )
    monkeypatch.setattr(
        sync,
        "_get_sharepoint_sync_states",
        lambda resource_ids: {resource_ids[0]: {"delta_token": "previous-delta"}},
    )
    monkeypatch.setattr(
        sync,
        "sync_sharepoint_folder",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(
            RuntimeError("temporary Graph outage")
        ),
    )
    monkeypatch.setattr(
        sync, "_save_sync_state", lambda *args, **_kwargs: saved_states.append(args)
    )
    monkeypatch.setattr(sync, "_record_sync_run_safe", lambda *_args, **_kwargs: None)

    result = sync._run_graph_source_reconciliation(
        _FakeSupabase(),
        run_sharepoint=True,
        run_outlook=False,
        run_teams=False,
        run_onedrive=False,
        outlook_users=None,
        verify_outlook_persisted_count=False,
    )

    assert result["status"] == "complete_with_errors"
    assert saved_states[0][4] == "previous-delta"
    assert saved_states[0][6] == "error"
