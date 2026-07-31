import asyncio
from pathlib import Path
from types import SimpleNamespace

import pytest

from src.services.training.rag_index import (
    TRAINING_GUIDE_TYPE,
    TRAINING_RESOURCE_TYPE,
    TrainingDocument,
    keep_training_rag_index_current,
    load_guide_documents,
    load_published_resource_documents,
    reconcile_training_rag_index,
    training_rag_index_health,
    training_rag_reconciliation_state,
)


class Query:
    def __init__(self, rows):
        self.rows = list(rows)

    def select(self, *_args):
        return self

    def eq(self, column, value):
        self.rows = [row for row in self.rows if row.get(column) == value]
        return self

    def in_(self, column, values):
        self.rows = [row for row in self.rows if row.get(column) in values]
        return self

    def execute(self):
        return SimpleNamespace(data=self.rows)


class Client:
    def __init__(self, tables):
        self.tables = tables

    def table(self, name):
        return Query(self.tables[name])


class Store:
    def __init__(self, existing=None, chunks=None):
        self.app_client = object()
        self.existing = existing or {}
        self.chunks = chunks or set()
        self.upserts = []
        self.invalidated = []
        self.removed = 0
        self.catalog_ids = []

    def fetch_rag_document_metadata(self, document_id):
        return self.existing.get(document_id)

    def has_embedded_chunks_for_document(self, document_id):
        return document_id in self.chunks

    def invalidate_document_content(self, document_id, **kwargs):
        self.invalidated.append((document_id, kwargs))
        return True

    def list_document_ids_by_source_system(self, _source_system):
        return self.catalog_ids

    def delete_document_and_chunks(self, _document_id):
        self.removed += 1

    def upsert_document_metadata(self, metadata):
        self.upserts.append(metadata)
        return metadata


def doc(
    identifier="training_guide_test",
    content="Useful construction training",
    source_type=TRAINING_GUIDE_TYPE,
):
    return TrainingDocument(
        id=identifier,
        title="Test guide",
        content=content,
        source_type=source_type,
        source_url="/training/guides/test",
        source_item_id="test",
        description="Description",
        source_metadata={"corpus": "owned_guide"},
    )


def test_training_source_type_does_not_write_the_document_taxonomy_fk():
    for source_type in (TRAINING_GUIDE_TYPE, TRAINING_RESOURCE_TYPE):
        metadata = doc(source_type=source_type).as_metadata()

        assert metadata["type"] == source_type
        assert metadata["category"] == source_type
        assert "document_type" not in metadata


def test_checked_in_guide_corpus_contains_the_three_owned_guides():
    guides = load_guide_documents()

    assert {guide.id for guide in guides} == {
        "training_guide_alleato-pm-software-guide",
        "training_guide_pm-handbook",
        "training_guide_superintendent-handbook",
    }



def test_generated_guide_corpus_contains_all_owned_guides(tmp_path: Path):
    path = tmp_path / "corpus.json"
    path.write_text(
        '{"schemaVersion":1,"guides":[{"slug":"one","title":"One",'
        '"description":"Guide","roleIds":["pm"],"content":"Content"}]}'
    )

    guides = load_guide_documents(path)

    assert [guide.id for guide in guides] == ["training_guide_one"]
    assert guides[0].source_type == TRAINING_GUIDE_TYPE
    assert guides[0].source_url == "/training/guides/one"


def test_resource_loader_only_projects_published_records():
    client = Client(
        {
            "training_resource": [
                {
                    "id": "published-id",
                    "topic_id": "topic-id",
                    "title": "Published",
                    "description": "Use this resource",
                    "url": "https://example.com/resource",
                    "provider": "Example",
                    "resource_type": "video",
                    "level": "foundational",
                    "track": "PM",
                    "status": "published",
                    "duration_minutes": 10,
                    "updated_at": "2026-07-26",
                },
                {
                    "id": "review-id",
                    "topic_id": "topic-id",
                    "title": "Review",
                    "url": "https://example.com/review",
                    "status": "review",
                },
            ],
            "training_topic": [
                {"id": "topic-id", "slug": "planning", "name": "Planning"}
            ],
        }
    )

    resources = load_published_resource_documents(client)

    assert [resource.id for resource in resources] == [
        "training_resource_published-id"
    ]
    assert resources[0].source_type == TRAINING_RESOURCE_TYPE
    assert "Review" not in resources[0].content


def test_reconciliation_skips_unchanged_embedded_document(monkeypatch):
    document = doc()
    store = Store(
        existing={document.id: {"content_hash": document.content_hash}},
        chunks={document.id},
    )
    monkeypatch.setattr(
        "src.services.training.rag_index._remove_stale_documents",
        lambda _store, _ids: 0,
    )
    embedded = []

    result = reconcile_training_rag_index(
        store=store, documents=[document], embedder=lambda *_args: embedded.append(1)
    )

    assert result == {"desired": 1, "indexed": 0, "unchanged": 1, "removed": 0}
    assert store.upserts == []
    assert embedded == []


def test_reconciliation_invalidates_changed_document_before_embedding(monkeypatch):
    document = doc(content="Revised training")
    store = Store(existing={document.id: {"content_hash": "old"}}, chunks={document.id})
    calls = []
    monkeypatch.setattr(
        "src.services.training.rag_index._remove_stale_documents",
        lambda _store, _ids: 0,
    )

    result = reconcile_training_rag_index(
        store=store,
        documents=[document],
        embedder=lambda _client, identifier: calls.append(identifier) or 2,
    )

    assert result["indexed"] == 1
    assert store.invalidated[0][0] == document.id
    assert store.upserts[0]["content_hash"] == document.content_hash
    assert calls == [document.id]


def test_reconciliation_removes_stale_documents_before_embedding():
    document = doc()
    store = Store(
        existing={document.id: {"content_hash": document.content_hash}},
        chunks={document.id},
    )
    store.catalog_ids = [document.id, "training_resource_archived"]

    result = reconcile_training_rag_index(
        store=store, documents=[document], embedder=lambda *_args: 1
    )

    assert result["removed"] == 1
    assert store.removed == 1



def test_reconciliation_fails_loudly_when_embedding_writes_no_chunks(monkeypatch):

    document = doc()
    store = Store()
    monkeypatch.setattr(
        "src.services.training.rag_index._remove_stale_documents",
        lambda _store, _ids: 0,
    )

    try:
        reconcile_training_rag_index(
            store=store, documents=[document], embedder=lambda *_args: 0
        )
    except RuntimeError as exc:
        assert document.id in str(exc)
        assert "no searchable chunks" in str(exc)
        state = training_rag_reconciliation_state()
        assert state["lastStage"] == "embed-training_guide"
        assert state["lastErrorType"] == "RuntimeError"
        assert state["lastErrorCode"] is None
        assert state["lastErrorStatus"] is None
        assert len(state["lastErrorFingerprint"]) == 12
    else:
        raise AssertionError("zero-chunk reconciliation must fail")

def test_coded_provider_failure_exposes_only_the_safe_error_code(monkeypatch):
    document = doc()
    store = Store()
    monkeypatch.setattr(
        "src.services.training.rag_index._remove_stale_documents",
        lambda _store, _ids: 0,
    )

    class CodedFailure(RuntimeError):
        code = "23505"
        status_code = 402

    with pytest.raises(CodedFailure):
        reconcile_training_rag_index(
            store=store,
            documents=[document],
            embedder=lambda *_args: (_ for _ in ()).throw(CodedFailure("private")),
        )

    state = training_rag_reconciliation_state()
    assert state["lastErrorType"] == "CodedFailure"
    assert state["lastErrorCode"] == "23505"
    assert state["lastErrorStatus"] == 402
    assert "private" not in state.values()


def test_periodic_refresh_reconciles_again_after_resource_status_changes():
    observed_statuses = []
    current_status = {"value": "published"}

    def reconcile():
        observed_statuses.append(current_status["value"])
        return {"desired": 1, "indexed": 0, "unchanged": 1, "removed": 0}

    class RefreshObserved(Exception):
        pass

    async def advance_status_then_stop(_seconds):
        if len(observed_statuses) == 1:
            current_status["value"] = "review"
            return
        raise RefreshObserved

    with pytest.raises(RefreshObserved):
        asyncio.run(
            keep_training_rag_index_current(
                reconcile=reconcile,
                sleep=advance_status_then_stop,
                interval_seconds=60,
            )
        )

    assert observed_statuses == ["published", "review"]


def test_periodic_refresh_is_not_suppressed_by_write_flag_drift(monkeypatch):
    monkeypatch.delenv("RAG_DATABASE_WRITES_ENABLED", raising=False)
    monkeypatch.setenv("RAG_SUPABASE_URL", "https://rag.example.test")
    monkeypatch.setenv("RAG_SUPABASE_SERVICE_ROLE_KEY", "test-only")
    calls = []

    def reconcile():
        calls.append("ran")
        return {"desired": 0, "indexed": 0, "unchanged": 0, "removed": 0}

    class FirstRefreshCompleted(Exception):
        pass

    async def stop_after_first_refresh(_seconds):
        raise FirstRefreshCompleted

    with pytest.raises(FirstRefreshCompleted):
        asyncio.run(
            keep_training_rag_index_current(
                reconcile=reconcile,
                sleep=stop_after_first_refresh,
                interval_seconds=60,
            )
        )

    assert calls == ["ran"]

def test_health_readback_reports_missing_stale_and_searchable_counts():
    desired = [doc("training_guide_one"), doc("training_guide_two")]
    store = Store(chunks={"training_guide_one"})
    store.catalog_ids = ["training_guide_one", "training_resource_stale"]

    result = training_rag_index_health(store=store, documents=desired)

    assert {key: result[key] for key in (
        "status",
        "desired",
        "catalogued",
        "indexed",
        "searchable",
        "missing",
        "stale",
        "unsearchable",
    )} == {
        "status": "degraded",
        "desired": 2,
        "catalogued": 2,
        "indexed": 1,
        "searchable": 1,
        "missing": 1,
        "stale": 1,
        "unsearchable": 0,
    }
    assert result["reconciliation"] == training_rag_reconciliation_state()
    assert result["reconciliation"]["lastErrorType"] == "CodedFailure"
    assert result["reconciliation"]["lastErrorCode"] == "23505"
    assert result["reconciliation"]["lastErrorStatus"] == 402
