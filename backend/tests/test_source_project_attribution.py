from src.services.ingestion.source_project_attribution import (
    build_project_attribution_evidence,
    load_source_chunk_text,
)


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, rows):
        self.rows = list(rows)
        self.limit_count = None

    def select(self, *_args):
        return self

    def eq(self, key, value):
        self.rows = [row for row in self.rows if row.get(key) == value]
        return self

    def order(self, key):
        self.rows = sorted(self.rows, key=lambda row: row.get(key) or 0)
        return self

    def limit(self, value):
        self.limit_count = value
        return self

    def execute(self):
        rows = self.rows[: self.limit_count] if self.limit_count else self.rows
        return _Result([dict(row) for row in rows])


class _FakeRagClient:
    def __init__(self, rows):
        self.rows = rows

    def table(self, table_name):
        assert table_name == "document_chunks"
        return _TableQuery(self.rows)


def test_load_source_chunk_text_orders_and_concatenates_chunks():
    rag = _FakeRagClient(
        [
            {"document_id": "teams-1", "chunk_index": 1, "text": "second"},
            {"document_id": "teams-1", "chunk_index": 0, "text": "first"},
            {"document_id": "other", "chunk_index": 0, "text": "ignore"},
        ]
    )

    assert load_source_chunk_text("teams-1", rag_client=rag) == "first\nsecond"


def test_build_project_attribution_evidence_uses_chunk_text_when_metadata_content_blank():
    rag = _FakeRagClient(
        [
            {
                "document_id": "teams-1",
                "chunk_index": 0,
                "text": "Hunter: Need drawings and pricing for Exol PA Phase 2 guardrails.",
            }
        ]
    )

    evidence = build_project_attribution_evidence(
        {
            "id": "teams-1",
            "title": "Teams DM Conversation: 19:8704ffd5b",
            "content": "",
            "participants": "Hunter Rutledge",
        },
        rag_client=rag,
    )

    assert evidence["title"] == "Teams DM Conversation: 19:8704ffd5b"
    assert "Exol PA Phase 2" in evidence["content"]
    assert evidence["participants"] == ["Hunter Rutledge"]
    assert evidence["content_source"] == "document_chunks"


def test_build_project_attribution_evidence_uses_chunk_text_when_only_summary_exists():
    rag = _FakeRagClient(
        [
            {
                "document_id": "teams-1",
                "chunk_index": 0,
                "text": "Andrew: Bidding status for Union Collective needs more subcontractors.",
            }
        ]
    )

    evidence = build_project_attribution_evidence(
        {
            "id": "teams-1",
            "title": "Teams DM Conversation: 19:31fc2e2e2",
            "content": "",
            "summary": "Informal internal Teams coordination.",
        },
        rag_client=rag,
    )

    assert evidence["content"].startswith("Andrew: Bidding status for Union Collective")
    assert "Informal internal Teams coordination" in evidence["content"]
    assert evidence["content_source"] == "document_chunks"


def test_build_project_attribution_evidence_prefers_document_content():
    rag = _FakeRagClient(
        [
            {
                "document_id": "email-1",
                "chunk_index": 0,
                "text": "chunk text should not be needed",
            }
        ]
    )

    evidence = build_project_attribution_evidence(
        {
            "id": "email-1",
            "title": "Email: Westfield",
            "content": "Document metadata body",
            "summary": "Document summary",
        },
        rag_client=rag,
    )

    assert evidence["content"] == "Document metadata body\nDocument summary"
    assert evidence["content_source"] == "document_metadata"
