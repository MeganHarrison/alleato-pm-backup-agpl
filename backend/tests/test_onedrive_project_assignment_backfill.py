from src.services.ingestion import (
    communication_project_backfill as communication_backfill,
)
from src.services.ingestion.project_assignment import AssignmentTarget
from src.services.integrations.microsoft_graph import (
    onedrive_project_assignment_backfill as onedrive_backfill,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _Query:
    def __init__(self, rows, table_name, writes):
        self.rows = [dict(row) for row in rows]
        self.table_name = table_name
        self.writes = writes
        self.payload = None
        self.single_result = False
        self.limit_count = None

    def select(self, *_columns):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def is_(self, key, value):
        if value == "null":
            self.rows = [row for row in self.rows if row.get(key) is None]
        return self

    def ilike(self, key, value):
        needle = value.strip("%").lower()
        self.rows = [
            row for row in self.rows if needle in str(row.get(key) or "").lower()
        ]
        return self

    def limit(self, value):
        self.limit_count = value
        return self

    def single(self):
        self.single_result = True
        return self

    def update(self, payload):
        self.payload = dict(payload)
        return self

    def execute(self):
        if self.payload is not None:
            self.writes.append(
                {
                    "table": self.table_name,
                    "op": "update",
                    "payload": self.payload,
                }
            )
            return _Result([self.payload])
        rows = self.rows[: self.limit_count] if self.limit_count else self.rows
        if self.single_result:
            return _Result(rows[0] if rows else None)
        return _Result(rows)


class _Client:
    def __init__(self, documents, projects=None, business_areas=None):
        self.tables = {
            "document_metadata": documents,
            "projects": projects or [],
            "business_areas": business_areas or [],
        }
        self.writes = []

    def from_(self, table_name):
        return _Query(self.tables[table_name], table_name, self.writes)

    def table(self, table_name):
        return self.from_(table_name)


class _RagClient(_Client):
    pass


class _Assigner:
    def __init__(self, _client, target):
        self.target = target
        self.calls = []

    def assign_scope(self, **kwargs):
        self.calls.append(kwargs)
        return self.target


def test_folder_match_converts_mapped_internal_project_to_business_area(monkeypatch):
    client = _Client(
        documents=[
            {
                "id": "sharepoint-finance-1",
                "title": "Monthly close.xlsx",
                "file_name": "Monthly close.xlsx",
                "source_path": "Alleato Group/Alleato Finance/Monthly close.xlsx",
                "source_system": "sharepoint",
                "category": "document",
                "tags": "",
                "project_id": None,
                "business_area_id": None,
                "participants": "",
            }
        ],
        projects=[{"id": 60, "name": "Alleato Finance"}],
        business_areas=[
            {"id": 3, "name": "Finance", "is_restricted": True},
        ],
    )
    rag_client = _RagClient(
        documents=[],
    )
    rag_client.tables.update(
        {
            "rag_document_metadata": [
                {
                    "id": "sharepoint-finance-1",
                    "project_id": None,
                    "source_metadata": {},
                }
            ],
            "document_chunks": [
                {
                    "chunk_id": "sharepoint-finance-1-0",
                    "document_id": "sharepoint-finance-1",
                    "metadata": {"project_id": 60},
                }
            ],
        }
    )
    assigner = _Assigner(
        client,
        AssignmentTarget(
            project_id=None,
            business_area_id=3,
            legacy_project_id=60,
            method="existing_business_area_mapping",
            confidence=1.0,
        ),
    )
    monkeypatch.setattr(
        onedrive_backfill,
        "ProjectAssigner",
        lambda _client: assigner,
    )
    monkeypatch.setattr(
        communication_backfill,
        "get_rag_write_client",
        lambda: rag_client,
    )

    result = onedrive_backfill.run_onedrive_project_assignment_backfill(client)

    assert result["assigned_business_area"] == 1
    assert result["assigned_project"] == 0
    assert assigner.calls == [
        {
            "meeting_title": "Monthly close.xlsx",
            "participants": [],
            "content": "",
            "existing_project_id": 60,
            "migrate_mapped_existing": True,
        }
    ]
    document_update = next(
        write for write in client.writes if write["table"] == "document_metadata"
    )
    assert document_update["payload"]["project_id"] is None
    assert document_update["payload"]["business_area_id"] == 3
    assert document_update["payload"]["project"] is None
    assert document_update["payload"]["access_level"] == "restricted"
    assert (
        "business_area_auto:existing_business_area_mapping"
        in document_update["payload"]["tags"]
    )
    assert "project_auto:" not in document_update["payload"]["tags"]

    rag_update = next(
        write
        for write in rag_client.writes
        if write["table"] == "rag_document_metadata"
    )
    assert rag_update["payload"] == {
        "project_id": None,
        "source_metadata": {"business_area_id": 3},
    }
    chunk_update = next(
        write for write in rag_client.writes if write["table"] == "document_chunks"
    )
    assert chunk_update["payload"]["metadata"] == {"business_area_id": 3}


def test_backfill_skips_documents_that_already_have_business_area_scope(monkeypatch):
    client = _Client(
        documents=[
            {
                "id": "sharepoint-ops-1",
                "title": "Operations SOP.pdf",
                "source_path": "Alleato Group/Internal Operations/Operations SOP.pdf",
                "source_system": "sharepoint",
                "category": "document",
                "tags": "",
                "project_id": None,
                "business_area_id": 4,
                "participants": "",
            }
        ]
    )
    monkeypatch.setattr(
        onedrive_backfill,
        "ProjectAssigner",
        lambda _client: (_ for _ in ()).throw(
            AssertionError("assigner should not be created for an empty candidate set")
        ),
    )

    result = onedrive_backfill.run_onedrive_project_assignment_backfill(client)

    assert result["scanned"] == 0
    assert result["eligible"] == 0
    assert client.writes == []
