from datetime import datetime, timezone

from src.services.ingestion import communication_project_backfill as backfill
from src.services.ingestion.communication_project_backfill import (
    _iter_unassigned_documents,
)
from src.services.ingestion.project_assignment import AssignmentTarget


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, rows, table_name=None, writes=None):
        self.rows = list(rows)
        self.limit_count = None
        self.table_name = table_name
        self.writes = writes if writes is not None else []
        self.update_payload = None
        self.insert_payload = None
        self.single_result = False

    def select(self, *_args):
        return self

    def is_(self, key, value):
        if value == "null":
            self.rows = [row for row in self.rows if row.get(key) is None]
        return self

    def in_(self, key, values):
        allowed = set(values)
        self.rows = [row for row in self.rows if row.get(key) in allowed]
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, value):
        self.limit_count = value
        return self

    def gte(self, key, value):
        self.rows = [
            row
            for row in self.rows
            if row.get(key) is not None and str(row.get(key)) >= str(value)
        ]
        return self

    def single(self):
        self.single_result = True
        return self

    def update(self, payload):
        self.update_payload = payload
        return self

    def insert(self, payload):
        self.insert_payload = payload
        return self

    def delete(self):
        self.writes.append({"table": self.table_name, "op": "delete"})
        return self

    def execute(self):
        if self.update_payload is not None:
            self.writes.append(
                {
                    "table": self.table_name,
                    "op": "update",
                    "payload": self.update_payload,
                }
            )
            return _Result([self.update_payload])
        if self.insert_payload is not None:
            self.writes.append(
                {
                    "table": self.table_name,
                    "op": "insert",
                    "payload": self.insert_payload,
                }
            )
            return _Result([self.insert_payload])
        rows = self.rows[: self.limit_count] if self.limit_count else self.rows
        if self.single_result:
            return _Result(dict(rows[0]) if rows else None)
        return _Result([dict(row) for row in rows])


class _FakeClient:
    def __init__(self, rows, projects=None, business_areas=None):
        self.rows = rows
        self.projects = projects or []
        self.business_areas = business_areas or []
        self.writes = []

    def table(self, table_name):
        assert table_name in {"business_areas", "document_metadata", "projects"}
        if table_name == "projects":
            rows = self.projects
        elif table_name == "business_areas":
            rows = self.business_areas
        else:
            rows = self.rows
        return _TableQuery(rows, table_name=table_name, writes=self.writes)


class _FakeRagClient:
    def __init__(self, tables=None):
        self.tables = tables or {}
        self.writes = []

    def table(self, table_name):
        assert table_name in {
            "document_attribution_candidates",
            "rag_document_metadata",
            "document_chunks",
        }
        return _TableQuery(
            self.tables.setdefault(table_name, []),
            table_name=table_name,
            writes=self.writes,
        )


class _FakeAssigner:
    def __init__(self, _client, result):
        self.result = result

    def assign_scope(self, **_kwargs):
        return self.result


def test_iter_unassigned_documents_can_scope_to_teams_only():
    client = _FakeClient(
        [
            {
                "id": "teams-1",
                "source": "microsoft_graph",
                "category": "teams_message",
                "project_id": None,
                "created_at": "2026-07-07T00:00:00+00:00",
            },
            {
                "id": "email-1",
                "source": "microsoft_graph",
                "category": "email",
                "project_id": None,
                "created_at": "2026-07-07T00:00:00+00:00",
            },
            {
                "id": "meeting-1",
                "source": "fireflies",
                "category": "meeting",
                "project_id": None,
                "created_at": "2026-07-07T00:00:00+00:00",
            },
            {
                "id": "brain-1",
                "source": "microsoft_graph",
                "category": "teams_message",
                "project_id": None,
                "business_area_id": 4,
                "created_at": "2026-07-07T00:00:00+00:00",
            },
        ]
    )

    rows = list(
        _iter_unassigned_documents(
            client,
            limit=10,
            since=datetime(2026, 7, 6, tzinfo=timezone.utc),
            source_filter="microsoft_graph",
            categories=["teams_message"],
        )
    )

    assert [row["id"] for row in rows] == ["teams-1"]


def test_low_confidence_backfill_writes_pending_review_candidate(monkeypatch):
    app_client = _FakeClient(
        [
            {
                "id": "meeting-1",
                "title": "Bob Wright Review",
                "source": "fireflies",
                "category": "meeting",
                "project_id": None,
                "created_at": "2026-07-07T00:00:00+00:00",
                "content": "Ambiguous discussion without a unique project identifier.",
            }
        ]
    )
    rag_client = _FakeRagClient(
        {
            "rag_document_metadata": [{"id": "teams-1", "project_id": None}],
            "document_chunks": [
                {
                    "chunk_id": "teams-1-0",
                    "document_id": "teams-1",
                    "metadata": {"title": "Union Collective EIFS samples"},
                }
            ],
        }
    )

    monkeypatch.setattr(
        backfill,
        "ProjectAssigner",
        lambda client: _FakeAssigner(
            client,
            AssignmentTarget(
                project_id=None,
                business_area_id=None,
                method="unassigned",
                confidence=0.0,
            ),
        ),
    )
    monkeypatch.setattr(backfill, "get_rag_write_client", lambda: rag_client)

    result = backfill.run_incremental_project_backfill(
        app_client,
        limit=10,
        since=datetime(2026, 7, 6, tzinfo=timezone.utc),
    )

    assert result["assigned"] == 0
    assert result["skipped_low_confidence"] == 1
    assert result["review_staged"] == 1
    inserts = [write for write in rag_client.writes if write["op"] == "insert"]
    assert len(inserts) == 1
    payload = inserts[0]["payload"]
    assert payload["source_document_id"] == "meeting-1"
    assert payload["candidate_project_id"] is None
    assert payload["status"] == "pending_review"
    assert payload["attribution_method"] == backfill.REVIEW_REQUIRED_METHOD
    assert "document_metadata.content" in payload["matched_fields"]


def test_high_confidence_backfill_still_auto_assigns(monkeypatch):
    app_client = _FakeClient(
        [
            {
                "id": "teams-1",
                "title": "Union Collective EIFS samples",
                "source": "microsoft_graph",
                "category": "teams_message",
                "project_id": None,
                "created_at": "2026-07-07T00:00:00+00:00",
                "content": "EIFS samples for Union Collective.",
            }
        ],
        projects=[{"id": 1009, "name": "Union Collective"}],
    )
    rag_client = _FakeRagClient(
        {
            "rag_document_metadata": [
                {
                    "id": "teams-1",
                    "project_id": None,
                    "source_metadata": {},
                }
            ],
            "document_chunks": [
                {
                    "chunk_id": "teams-1-0",
                    "document_id": "teams-1",
                    "metadata": {"title": "Union Collective EIFS samples"},
                }
            ],
        }
    )

    monkeypatch.setattr(
        backfill,
        "ProjectAssigner",
        lambda client: _FakeAssigner(
            client,
            AssignmentTarget(
                project_id=1009,
                business_area_id=None,
                method="attribution_rule:phrase",
                confidence=0.93,
            ),
        ),
    )
    monkeypatch.setattr(backfill, "get_rag_write_client", lambda: rag_client)

    result = backfill.run_incremental_project_backfill(
        app_client,
        limit=10,
        since=datetime(2026, 7, 6, tzinfo=timezone.utc),
    )

    assert result["assigned"] == 1
    assert result["review_staged"] == 0
    document_updates = [
        write
        for write in app_client.writes
        if write["table"] == "document_metadata" and write["op"] == "update"
    ]
    assert document_updates[0]["payload"]["project_id"] == 1009
    rag_metadata_updates = [
        write
        for write in rag_client.writes
        if write["table"] == "rag_document_metadata" and write["op"] == "update"
    ]
    assert rag_metadata_updates[0]["payload"]["project_id"] == 1009
    assert rag_metadata_updates[0]["payload"]["source_metadata"] == {}
    chunk_updates = [
        write
        for write in rag_client.writes
        if write["table"] == "document_chunks" and write["op"] == "update"
    ]
    assert chunk_updates[0]["payload"]["metadata"] == {
        "title": "Union Collective EIFS samples",
        "project_id": 1009,
    }
    review_inserts = [
        write
        for write in rag_client.writes
        if write["op"] == "insert" and write["payload"]["status"] == "pending_review"
    ]
    assert review_inserts == []


def test_high_confidence_internal_match_assigns_business_area_only(monkeypatch):
    app_client = _FakeClient(
        [
            {
                "id": "finance-1",
                "title": "Credit card reconciliation",
                "source": "microsoft_graph",
                "category": "email",
                "project_id": None,
                "business_area_id": None,
                "created_at": "2026-07-28T00:00:00+00:00",
                "content": "Finance reconciliation is ready.",
            }
        ],
        business_areas=[
            {
                "id": 3,
                "name": "Finance",
                "is_restricted": True,
            }
        ],
    )
    rag_client = _FakeRagClient(
        {
            "rag_document_metadata": [
                {
                    "id": "finance-1",
                    "project_id": 60,
                    "source_metadata": {},
                }
            ],
            "document_chunks": [
                {
                    "chunk_id": "finance-1-0",
                    "document_id": "finance-1",
                    "metadata": {
                        "project_id": 60,
                        "title": "Credit card reconciliation",
                    },
                }
            ],
        }
    )

    monkeypatch.setattr(
        backfill,
        "ProjectAssigner",
        lambda client: _FakeAssigner(
            client,
            AssignmentTarget(
                project_id=None,
                business_area_id=3,
                legacy_project_id=60,
                method="attribution_rule:phrase",
                confidence=0.97,
            ),
        ),
    )
    monkeypatch.setattr(backfill, "get_rag_write_client", lambda: rag_client)

    result = backfill.run_incremental_project_backfill(app_client, limit=10)

    assert result["assigned"] == 1
    document_update = next(
        write
        for write in app_client.writes
        if write["table"] == "document_metadata" and write["op"] == "update"
    )
    assert document_update["payload"]["project_id"] is None
    assert document_update["payload"]["business_area_id"] == 3
    assert document_update["payload"]["project"] is None
    assert document_update["payload"]["access_level"] == "restricted"

    rag_metadata_update = next(
        write
        for write in rag_client.writes
        if write["table"] == "rag_document_metadata" and write["op"] == "update"
    )
    assert rag_metadata_update["payload"] == {
        "project_id": None,
        "source_metadata": {"business_area_id": 3},
    }
    chunk_update = next(
        write
        for write in rag_client.writes
        if write["table"] == "document_chunks" and write["op"] == "update"
    )
    assert chunk_update["payload"]["metadata"] == {
        "business_area_id": 3,
        "title": "Credit card reconciliation",
    }

    attribution_insert = next(
        write
        for write in rag_client.writes
        if write["table"] == "document_attribution_candidates"
        and write["op"] == "insert"
    )
    assert attribution_insert["payload"]["candidate_project_id"] is None
    assert attribution_insert["payload"]["evidence"]["business_area_id"] == 3
