import pytest

from src.services.ingestion import fireflies_pipeline
from src.services.ingestion.fireflies_pipeline import (
    FirefliesIngestionPipeline,
    IngestionResult,
)
from src.services.ingestion.project_assignment import AssignmentTarget


class _Result:
    def __init__(self, data):
        self.data = data


class _AreaQuery:
    def select(self, *_columns):
        return self

    def eq(self, _column, _value):
        return self

    def limit(self, _value):
        return self

    def execute(self):
        return _Result([{"id": 3, "is_restricted": True}])


class _AppClient:
    def table(self, table_name):
        assert table_name == "business_areas"
        return _AreaQuery()


class _TypedAssigner:
    def __init__(self, target=None, error=None):
        self.target = target
        self.error = error
        self.calls = []

    def assign_scope(self, **kwargs):
        self.calls.append(kwargs)
        if self.error is not None:
            raise self.error
        return self.target


class _Embedder:
    def __init__(self):
        self.calls = []

    def embed(self, texts):
        self.calls.append(list(texts))
        return [[0.1, 0.2, 0.3] for _ in texts]


class _Store:
    def __init__(self, existing=None):
        self._client = _AppClient()
        self.existing = existing
        self.metadata_payloads = []
        self.scope_calls = []
        self.chunks = []

    def find_document_by_hash(self, _content_hash):
        return self.existing

    def fetch_document_metadata(self, _document_id):
        return self.existing

    def has_embedded_chunks_for_document(self, _document_id):
        return True

    def find_document_by_fireflies_id(self, _fireflies_id):
        return self.existing

    def upsert_document_metadata(self, metadata):
        self.metadata_payloads.append(dict(metadata))
        return metadata

    def set_document_scope(self, document_id, *, project_id, business_area_id):
        self.scope_calls.append(
            {
                "document_id": document_id,
                "project_id": project_id,
                "business_area_id": business_area_id,
            }
        )

    def start_ingestion_job(self, _fireflies_id, _content_hash):
        return None

    def delete_chunks_for_document(self, _document_id):
        return None

    def upsert_chunks(self, chunks):
        self.chunks.extend(chunks)

    def complete_ingestion_job(self, _job_id, status, error=None):
        return None


def _pipeline(store, target):
    pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
    pipeline.store = store
    pipeline.embedder = _Embedder()
    pipeline._fireflies_api_key = None
    pipeline._project_assigner = _TypedAssigner(target=target)
    pipeline._link_transcript_to_meeting = lambda **_kwargs: None
    pipeline._upsert_structured_meeting = lambda *_args, **_kwargs: None
    pipeline._extract_meeting_memories = lambda **_kwargs: None
    pipeline._update_ingestion_job_state = lambda *_args, **_kwargs: None
    return pipeline


def _finance_target():
    return AssignmentTarget(
        project_id=None,
        business_area_id=3,
        legacy_project_id=60,
        method="existing_business_area_mapping",
        confidence=1.0,
    )


def _markdown():
    return """# Finance Monthly Close

**Fireflies ID:** ff-finance-123
**Date:** 2026-07-23

## Summary
Reviewed the monthly close.

## Transcript
[00:01] **Megan**: The finance close is ready for review.
"""


def test_fireflies_requests_migration_of_existing_mapped_scope():
    pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
    pipeline.store = _Store()
    assigner = _TypedAssigner(target=_finance_target())
    pipeline._project_assigner = assigner

    target = pipeline._infer_project_id_from_context(
        title="Finance monthly close",
        participants=[],
        content="Review the ledger",
        existing_project_id=60,
    )

    assert target.business_area_id == 3
    assert target.project_id is None
    assert assigner.calls[0]["migrate_mapped_existing"] is True


def test_fireflies_fails_loudly_when_typed_assignment_fails():
    pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
    pipeline.store = _Store()
    pipeline._project_assigner = _TypedAssigner(
        error=RuntimeError("mapping unavailable")
    )

    with pytest.raises(
        RuntimeError,
        match="typed scope assignment failed",
    ):
        pipeline._infer_project_id_from_context(
            title="Finance monthly close",
            participants=[],
            content="Review the ledger",
            existing_project_id=60,
        )


def test_fireflies_chunk_carries_business_area_without_project_id():
    chunk = FirefliesIngestionPipeline._build_chunk(
        "doc-finance",
        0,
        [
            fireflies_pipeline.TranscriptSegment(
                timestamp="00:01",
                speaker="Megan",
                text="Review the close.",
            )
        ],
        None,
        business_area_id=3,
        title="Finance monthly close",
    )

    assert chunk.metadata["business_area_id"] == 3
    assert "project_id" not in chunk.metadata


def test_fireflies_new_business_area_document_persists_exact_scope(monkeypatch):
    monkeypatch.setattr(
        fireflies_pipeline,
        "record_source_processing_status",
        lambda *_args, **_kwargs: None,
    )
    store = _Store()
    pipeline = _pipeline(store, _finance_target())

    result = pipeline.ingest_markdown_text(_markdown(), dry_run=False)

    assert result.skipped is False
    persisted = store.metadata_payloads[0]
    assert persisted["project_id"] is None
    assert persisted["business_area_id"] == 3
    assert persisted["access_level"] == "restricted"
    assert store.scope_calls == [
        {
            "document_id": "ff-finance-123",
            "project_id": None,
            "business_area_id": 3,
        }
    ]
    assert store.chunks
    assert all(chunk.metadata["business_area_id"] == 3 for chunk in store.chunks)
    assert all("project_id" not in chunk.metadata for chunk in store.chunks)


def test_fireflies_reprocesses_unchanged_legacy_container_to_repair_scope(monkeypatch):
    monkeypatch.setattr(
        fireflies_pipeline,
        "record_source_processing_status",
        lambda *_args, **_kwargs: None,
    )
    store = _Store(
        existing={
            "id": "doc-existing-finance",
            "project_id": 60,
            "business_area_id": None,
            "fireflies_id": "ff-finance-123",
        }
    )
    pipeline = _pipeline(store, _finance_target())

    result = pipeline.ingest_markdown_text(_markdown(), dry_run=False)

    assert result.skipped is False
    assert store.scope_calls == [
        {
            "document_id": "doc-existing-finance",
            "project_id": None,
            "business_area_id": 3,
        }
    ]
    assert pipeline.embedder.calls


def test_sync_wrapper_never_bypasses_typed_ingestion_for_unchanged_content():
    class _SyncStore:
        def upload_public_text(self, *_args, **_kwargs):
            return "https://example.test/transcript.md"

    pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
    pipeline.store = _SyncStore()
    pipeline._fireflies_api_key = "present"
    pipeline._fetch_recent_transcript_summaries = lambda _limit: [{"id": "ff-1"}]
    pipeline._fetch_transcript = lambda _transcript_id: {
        "id": "ff-1",
        "title": "Finance Monthly Close",
        "meeting_info": {"summary_status": "processed"},
        "sentences": [{"text": "Close is ready"}],
    }
    pipeline._fetch_apps_outputs = lambda _transcript_id: []
    pipeline._format_transcript_markdown = lambda *_args: _markdown()
    pipeline._extract_fireflies_rich_metadata = lambda _transcript: {}
    pipeline._record_fireflies_sync_run = lambda **_kwargs: None
    calls = []

    def _ingest(*args, **kwargs):
        calls.append((args, kwargs))
        return IngestionResult(
            document_id="doc-existing-finance",
            chunk_count=0,
            action_item_count=0,
            content_hash="hash",
            skipped=True,
            dry_run=False,
        )

    pipeline.ingest_markdown_text = _ingest

    result = pipeline.sync_recent_transcripts(limit=1)

    assert len(calls) == 1
    assert result["results"][0]["ingestion"]["document_id"] == "doc-existing-finance"
