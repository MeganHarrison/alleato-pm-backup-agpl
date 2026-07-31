import zipfile

from src.services.integrations.microsoft_graph import ocr_worker


class _Query:
    def __init__(self):
        self.payload = None

    def update(self, payload):
        self.payload = payload
        return self

    def eq(self, *_args):
        return self

    def execute(self):
        return type("Result", (), {"data": [self.payload]})()


class _Supabase:
    def __init__(self):
        self.query = _Query()

    def from_(self, table):
        assert table == "document_metadata"
        return self.query


def test_complete_ocr_ignores_retired_azure_page_cap(monkeypatch):
    monkeypatch.setenv("AZURE_OCR_PAGE_CAP", "20")
    monkeypatch.delenv("DOCUMENT_OCR_PAGE_CAP", raising=False)
    monkeypatch.delenv("DOCUMENT_OCR_BATCH_SIZE", raising=False)

    assert ocr_worker._get_page_cap() is None
    assert ocr_worker._get_batch_size() == 2


def test_ocr_persists_full_text_to_rag_without_character_cap(monkeypatch):
    supabase = _Supabase()
    captured = {}
    invalidations = []

    class _Store:
        def __init__(self, _client):
            pass

        def invalidate_document_content(self, document_id, **kwargs):
            invalidations.append({"document_id": document_id, **kwargs})
            return True

        def upsert_rag_document_metadata(self, payload):
            captured.update(payload)

    monkeypatch.setattr(ocr_worker, "SupabaseRagStore", _Store)
    text = "Decision-grade OCR text. " * 6000

    ocr_worker._update_record_after_ocr(
        supabase,
        {
            "id": "sharepoint_1",
            "title": "Scanned proposal.pdf",
            "source": "microsoft_graph",
            "source_system": "sharepoint",
            "source_item_id": "1",
            "source_web_url": "https://example.test/file",
            "project_id": 1009,
            "source_metadata": {"source_folder": "/2026 Jobs/26-119"},
        },
        text,
        capped=False,
        pages_processed=32,
    )

    assert len(captured["content"]) == len(text)
    assert captured["raw_text"] == text
    assert captured["embedding_status"] == "pending"
    assert captured["parsing_status"] == "raw_ingested"
    assert captured["source_metadata"]["ocr"]["complete"] is True
    assert supabase.query.payload["status"] == "raw_ingested"
    assert "content" not in supabase.query.payload
    assert "content_hash" not in supabase.query.payload
    assert invalidations[0]["parsing_status"] == "ocr_processing"


def test_partial_ocr_is_marked_incomplete_and_pending(monkeypatch):
    supabase = _Supabase()
    captured = {}
    invalidations = []

    class _Store:
        def __init__(self, _client):
            pass

        def invalidate_document_content(self, document_id, **kwargs):
            invalidations.append({"document_id": document_id, **kwargs})
            return True

        def upsert_rag_document_metadata(self, payload):
            captured.update(payload)

    monkeypatch.setattr(ocr_worker, "SupabaseRagStore", _Store)

    ocr_worker._update_record_after_ocr(
        supabase,
        {
            "id": "sharepoint_2",
            "source_system": "sharepoint",
            "source_item_id": "2",
        },
        "Readable partial text " * 10,
        capped=True,
        pages_processed=100,
    )

    assert captured["parsing_status"] == "ocr_partial"
    assert captured["source_metadata"]["ocr"]["complete"] is False
    assert supabase.query.payload["status"] == "ocr_partial"
    assert invalidations[0]["embedding_status"] == "pending"


def test_ocr_failure_invalidates_stale_chunks_before_marking_terminal(monkeypatch):
    supabase = _Supabase()
    invalidations = []

    class _Store:
        def __init__(self, _client):
            pass

        def invalidate_document_content(self, document_id, **kwargs):
            invalidations.append({"document_id": document_id, **kwargs})
            return True

    monkeypatch.setattr(ocr_worker, "SupabaseRagStore", _Store)

    ocr_worker._mark_ocr_failed(
        supabase,
        "sharepoint_3",
        "Azure request failed",
    )

    assert invalidations[0]["document_id"] == "sharepoint_3"
    assert invalidations[0]["parsing_status"] == "ocr_failed"
    assert invalidations[0]["embedding_status"] == "error"
    assert supabase.query.payload["status"] == "ocr_failed"


def test_openxml_embedded_image_ocr_reads_every_governed_part(
    monkeypatch,
    tmp_path,
):
    document = tmp_path / "image-only.docx"
    with zipfile.ZipFile(document, "w") as archive:
        archive.writestr("word/media/image1.jpeg", b"first-image")
        archive.writestr("word/media/image2.png", b"second-image")

    calls = []

    def _ocr(image, *, max_pages):
        calls.append((image, max_pages))
        return f"Readable text {len(calls)}"

    monkeypatch.setattr(
        ocr_worker,
        "_tesseract_image_bytes",
        lambda image, *, suffix: _ocr(image, max_pages=None),
    )

    text, capped, pages = ocr_worker._extract_openxml_embedded_image_text(
        str(document),
        ["word/media/image1.jpeg", "word/media/image2.png"],
        max_pages=None,
    )

    assert "Readable text 1" in text
    assert "Readable text 2" in text
    assert capped is False
    assert pages == 2
    assert calls == [(b"first-image", None), (b"second-image", None)]


def test_pdf_extraction_reads_all_pages_and_ocrs_only_empty_pages(
    monkeypatch,
    tmp_path,
):
    document = tmp_path / "mixed.pdf"
    document.write_bytes(b"%PDF")
    commands = []

    def _run(command, *, timeout=300):
        commands.append(command)
        if command[0] == "pdfinfo":
            if "-f" in command:
                return b"Page size:      612 x 792 pts\nPage rot:       0\n"
            return b"Pages:          2\n"
        if command[0] == "pdftotext":
            return (
                b"Page one has complete selectable project text with enough "
                b"content for the materialization threshold.\f\f"
            )
        if command[0] == "pdftoppm":
            return b""
        if command[0] == "tesseract":
            return b"Scanned page two decision and risk text."
        raise AssertionError(command)

    monkeypatch.setattr(ocr_worker, "_run_ocr_command", _run)

    result = ocr_worker._extract_pdf_text_from_path(
        str(document),
        max_pages=None,
    )

    assert result.pages_processed == 2
    assert result.capped is False
    assert "[Page 1]" in result.text
    assert "Scanned page two decision" in result.text
    assert sum(command[0] == "tesseract" for command in commands) >= 1
    render_command = next(
        command for command in commands if command[0] == "pdftoppm"
    )
    assert "-W" in render_command
    assert "-H" in render_command
    assert int(render_command[render_command.index("-W") + 1]) <= 1800
    assert int(render_command[render_command.index("-H") + 1]) <= 1800


def test_pdf_ocr_tiles_large_architectural_sheet_at_full_resolution(
    monkeypatch,
    tmp_path,
):
    document = tmp_path / "large-sheet.pdf"
    document.write_bytes(b"%PDF")
    commands = []

    def _run(command, *, timeout=300):
        commands.append(command)
        if command[0] == "pdfinfo":
            if "-f" in command:
                return (
                    b"Page size:      2113 x 3038 pts\n"
                    b"Page rot:       0\n"
                )
            return b"Pages:          1\n"
        if command[0] == "pdftotext":
            return b"\f"
        if command[0] == "pdftoppm":
            return b""
        if command[0] == "tesseract":
            return b"Decision-grade architectural note."
        raise AssertionError(command)

    monkeypatch.setattr(ocr_worker, "_run_ocr_command", _run)

    result = ocr_worker._extract_pdf_text_from_path(
        str(document),
        max_pages=None,
    )

    render_commands = [
        command for command in commands if command[0] == "pdftoppm"
    ]
    assert len(render_commands) > 1
    assert all(
        int(command[command.index("-W") + 1]) <= 1800
        and int(command[command.index("-H") + 1]) <= 1800
        for command in render_commands
    )
    assert "[Tile 1,1]" in result.text
    assert "Decision-grade architectural note." in result.text


def test_pdf_page_geometry_accounts_for_rotation(monkeypatch):
    monkeypatch.setattr(
        ocr_worker,
        "_run_ocr_command",
        lambda _command: (
            b"Page size:      612 x 792 pts\nPage rot:       90\n"
        ),
    )

    assert ocr_worker._pdf_page_pixel_size(
        "rotated.pdf",
        1,
        dpi=200,
    ) == (2200, 1700)


def test_pdf_extraction_preserves_short_selectable_text_without_ocr(
    monkeypatch,
    tmp_path,
):
    document = tmp_path / "short-text.pdf"
    document.write_bytes(b"%PDF")
    commands = []

    def _run(command, *, timeout=300):
        commands.append(command)
        if command[0] == "pdfinfo":
            return b"Pages:          1\n"
        if command[0] == "pdftotext":
            return b"Approved.\f"
        raise AssertionError(f"Selectable text page must not be OCRed: {command}")

    monkeypatch.setattr(ocr_worker, "_run_ocr_command", _run)

    result = ocr_worker._extract_pdf_text_from_path(
        str(document),
        max_pages=None,
    )

    assert result.text == "[Page 1]\nApproved."
    assert all(command[0] != "tesseract" for command in commands)
