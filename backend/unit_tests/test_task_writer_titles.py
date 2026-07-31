from dataclasses import dataclass
from typing import Any

import pytest

from src.services.project_intelligence.projections import project_communications
from src.services.pipeline.models import DecisionItem, StructuredData, TaskItem


class _Result:
    def __init__(self, data):
        self.data = data


class _TableQuery:
    def __init__(self, db, table_name):
        self.db = db
        self.table_name = table_name
        self._update_payload = None

    def select(self, *_args, **_kwargs):
        return self

    def eq(self, *_args, **_kwargs):
        return self

    def or_(self, *_args, **_kwargs):
        return self

    def order(self, *_args, **_kwargs):
        return self

    def limit(self, *_args, **_kwargs):
        return self

    def delete(self):
        self.db.deletes.append(self.table_name)
        return self

    def update(self, payload):
        self._update_payload = payload
        return self

    def execute(self):
        if self._update_payload is not None:
            self.db.updates.append(
                {"table": self.table_name, "payload": self._update_payload}
            )
            return _Result([self._update_payload])
        if self.table_name == "document_metadata":
            return _Result(self.db.document_rows)
        if self.table_name == "source_signal_candidates":
            return _Result([])
        return _Result([])


class _FakeSupabase:
    def __init__(self, document_rows):
        self.document_rows = document_rows
        self.deletes = []
        self.updates = []

    def table(self, table_name):
        return _TableQuery(self, table_name)


@dataclass
class _UpsertCall:
    metadata_id: str
    project_id: int
    source_system: str
    description: str
    assignee: str | None
    assignee_email: str | None


@pytest.fixture(autouse=True)
def _allow_bounded_pm_projection(monkeypatch):
    monkeypatch.setenv("ALLOW_PM_APP_FINAL_PROJECTIONS", "true")
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "25")


@pytest.mark.parametrize(
    ("source_system", "expected_comm_type"),
    [
        ("outlook_email", "email"),
        ("teams_message", "teams"),
    ],
)
def test_project_communications_writes_email_and_teams_tasks(monkeypatch, source_system, expected_comm_type):
    doc_id = f"{expected_comm_type}-doc-1"
    client = _FakeSupabase(
        [
            {
                "id": doc_id,
                "title": f"{expected_comm_type.title()} source",
                "type": expected_comm_type,
                "category": expected_comm_type,
                "source": source_system,
                "source_system": source_system,
                "date": "2026-06-25",
                "captured_at": "2026-06-25T12:00:00Z",
                "participants": "Megan Harrison",
                "participants_array": ["Megan Harrison"],
                "source_metadata": {},
                "source_item_id": f"{doc_id}-source",
                "source_web_url": None,
                "source_path": None,
                "content_hash": "hash-1",
                "project_id": 1009,
            }
        ]
    )
    rag_read = _FakeSupabase([])
    rag_write = _FakeSupabase([])
    upserts: list[_UpsertCall] = []

    monkeypatch.setattr(project_communications, "get_supabase_client", lambda: client)
    monkeypatch.setattr(project_communications, "get_rag_read_client", lambda: rag_read)
    monkeypatch.setattr(project_communications, "get_rag_write_client", lambda: rag_write)
    monkeypatch.setattr(
        project_communications,
        "ensure_client_project_target",
        lambda *_args, **_kwargs: {"id": "target-1009"},
    )
    monkeypatch.setattr(project_communications, "_resolve_since", lambda *_args, **_kwargs: "2026-06-18")
    monkeypatch.setattr(project_communications, "_fetch_project_state", lambda *_args, **_kwargs: "Tracked state")
    monkeypatch.setattr(
        project_communications,
        "fetch_optional_row",
        lambda *_args, **_kwargs: {"content": "Please send the updated plan to the field team."},
    )
    monkeypatch.setattr(
        project_communications.llm,
        "extract_deep_communication_intelligence",
        lambda **_kwargs: StructuredData(
            tasks=[
                TaskItem(
                    description="Send the updated plan to the field team.",
                    assignee="Megan Harrison",
                    assignee_email="megan@alleatogroup.com",
                    priority="medium",
                    confidence=0.94,
                )
            ]
        ),
    )
    monkeypatch.setattr(
        project_communications,
        "record_source_processing_status",
        lambda *_args, **_kwargs: None,
    )

    def fake_upsert_task(_client: Any, task: TaskItem, *, metadata_id: str, project_id: int, client_id: Any, source_system: str):
        upserts.append(
            _UpsertCall(
                metadata_id=metadata_id,
                project_id=project_id,
                source_system=source_system,
                description=task.description,
                assignee=task.assignee,
                assignee_email=task.assignee_email,
            )
        )
        return {"id": "task-1"}

    monkeypatch.setattr(project_communications, "_upsert_task", fake_upsert_task)

    result = project_communications.synthesize_project_intelligence(
        1009,
        since="2026-06-18",
        max_docs=10,
        skip_synthesized=False,
    )

    result_key = "emails" if expected_comm_type == "email" else "teams"
    assert result[result_key] == 1
    assert result["tasks_written"] == 1
    assert result["errors"] == []
    assert result["pm_projection_rows"] == {"tasks": 1}
    assert upserts == [
        _UpsertCall(
            metadata_id=doc_id,
            project_id=1009,
            source_system=expected_comm_type,
            description="Send the updated plan to the field team.",
            assignee="Megan Harrison",
            assignee_email="megan@alleatogroup.com",
        )
    ]


def test_project_communications_signal_promotion_failure_does_not_block_task_write(monkeypatch):
    client = _FakeSupabase(
        [
            {
                "id": "email-doc-with-signal",
                "title": "Email: Action and decision",
                "type": "email",
                "category": "email",
                "source": "outlook_email",
                "source_system": "outlook_email",
                "date": "2026-06-25",
                "captured_at": "2026-06-25T12:00:00Z",
                "participants": "Megan Harrison",
                "participants_array": ["Megan Harrison"],
                "source_metadata": {},
                "source_item_id": "email-source-1",
                "source_web_url": None,
                "source_path": None,
                "content_hash": "hash-2",
                "project_id": 1009,
            }
        ]
    )
    rag_read = _FakeSupabase([])
    rag_write = _FakeSupabase([])
    upserts: list[_UpsertCall] = []

    monkeypatch.setattr(project_communications, "get_supabase_client", lambda: client)
    monkeypatch.setattr(project_communications, "get_rag_read_client", lambda: rag_read)
    monkeypatch.setattr(project_communications, "get_rag_write_client", lambda: rag_write)
    monkeypatch.setattr(
        project_communications,
        "ensure_client_project_target",
        lambda *_args, **_kwargs: {"id": "target-1009"},
    )
    monkeypatch.setattr(project_communications, "_resolve_since", lambda *_args, **_kwargs: "2026-06-18")
    monkeypatch.setattr(project_communications, "_fetch_project_state", lambda *_args, **_kwargs: "Tracked state")
    monkeypatch.setattr(
        project_communications,
        "fetch_optional_row",
        lambda *_args, **_kwargs: {"content": "Proceed with the decision and send the plan."},
    )
    monkeypatch.setattr(
        project_communications.llm,
        "extract_deep_communication_intelligence",
        lambda **_kwargs: StructuredData(
            decisions=[
                DecisionItem(
                    description="Proceed with the updated logistics plan.",
                    rationale="The project team agreed in the thread.",
                    confidence=0.92,
                    evidence_quote="Proceed with the updated logistics plan.",
                )
            ],
            tasks=[
                TaskItem(
                    description="Send the updated logistics plan to the field team.",
                    assignee="Megan Harrison",
                    assignee_email="megan@alleatogroup.com",
                    priority="medium",
                    confidence=0.94,
                )
            ],
        ),
    )
    monkeypatch.setattr(
        project_communications,
        "record_source_processing_status",
        lambda *_args, **_kwargs: None,
    )
    monkeypatch.setattr(
        project_communications,
        "write_source_signal_candidate",
        lambda *_args, **_kwargs: {"id": "candidate-1", "status": "candidate"},
    )
    monkeypatch.setattr(
        project_communications,
        "promote_signal_candidate",
        lambda *_args, **_kwargs: (_ for _ in ()).throw(RuntimeError("projection disabled")),
    )

    def fake_upsert_task(_client: Any, task: TaskItem, *, metadata_id: str, project_id: int, client_id: Any, source_system: str):
        upserts.append(
            _UpsertCall(
                metadata_id=metadata_id,
                project_id=project_id,
                source_system=source_system,
                description=task.description,
                assignee=task.assignee,
                assignee_email=task.assignee_email,
            )
        )
        return {"id": "task-1"}

    monkeypatch.setattr(project_communications, "_upsert_task", fake_upsert_task)

    result = project_communications.synthesize_project_intelligence(
        1009,
        since="2026-06-18",
        max_docs=10,
        max_extractions=1,
        skip_synthesized=False,
    )

    assert result["extractions_attempted"] == 1
    assert result["tasks_written"] == 1
    assert result["pm_projection_rows"] == {
        "insight_cards": 1,
        "insight_card_targets": 1,
        "insight_card_evidence": 1,
        "tasks": 1,
    }
    assert result["errors"][0]["stage"] == "signal_promotion"
    assert upserts[0].metadata_id == "email-doc-with-signal"
    assert upserts[0].source_system == "email"


def test_project_communications_projection_budget_blocks_task_write_before_pm_upsert(monkeypatch):
    monkeypatch.setenv("PM_APP_PROJECTION_MAX_TOTAL_ROWS", "1")
    client = _FakeSupabase(
        [
            {
                "id": "email-doc-budget-blocked",
                "title": "Email: Task",
                "type": "email",
                "category": "email",
                "source": "outlook_email",
                "source_system": "outlook_email",
                "date": "2026-06-25",
                "captured_at": "2026-06-25T12:00:00Z",
                "participants": "Megan Harrison",
                "participants_array": ["Megan Harrison"],
                "source_metadata": {},
                "source_item_id": "email-source-budget",
                "source_web_url": None,
                "source_path": None,
                "content_hash": "hash-budget",
                "project_id": 1009,
            }
        ]
    )
    rag_read = _FakeSupabase([])
    rag_write = _FakeSupabase([])
    upserts: list[_UpsertCall] = []

    monkeypatch.setattr(project_communications, "get_supabase_client", lambda: client)
    monkeypatch.setattr(project_communications, "get_rag_read_client", lambda: rag_read)
    monkeypatch.setattr(project_communications, "get_rag_write_client", lambda: rag_write)
    monkeypatch.setattr(
        project_communications,
        "ensure_client_project_target",
        lambda *_args, **_kwargs: {"id": "target-1009"},
    )
    monkeypatch.setattr(project_communications, "_resolve_since", lambda *_args, **_kwargs: "2026-06-18")
    monkeypatch.setattr(project_communications, "_fetch_project_state", lambda *_args, **_kwargs: "Tracked state")
    monkeypatch.setattr(
        project_communications,
        "fetch_optional_row",
        lambda *_args, **_kwargs: {"content": "Please send the updated plan."},
    )
    monkeypatch.setattr(
        project_communications.llm,
        "extract_deep_communication_intelligence",
        lambda **_kwargs: StructuredData(
            tasks=[
                TaskItem(
                    description="Send the updated plan.",
                    assignee="Megan Harrison",
                    assignee_email="megan@alleatogroup.com",
                    priority="medium",
                    confidence=0.94,
                ),
                TaskItem(
                    description="Confirm the delivery date.",
                    assignee="Megan Harrison",
                    assignee_email="megan@alleatogroup.com",
                    priority="medium",
                    confidence=0.91,
                ),
            ]
        ),
    )
    monkeypatch.setattr(
        project_communications,
        "record_source_processing_status",
        lambda *_args, **_kwargs: None,
    )

    def fake_upsert_task(_client: Any, task: TaskItem, *, metadata_id: str, project_id: int, client_id: Any, source_system: str):
        upserts.append(
            _UpsertCall(
                metadata_id=metadata_id,
                project_id=project_id,
                source_system=source_system,
                description=task.description,
                assignee=task.assignee,
                assignee_email=task.assignee_email,
            )
        )
        return {"id": "task-1"}

    monkeypatch.setattr(project_communications, "_upsert_task", fake_upsert_task)

    result = project_communications.synthesize_project_intelligence(
        1009,
        since="2026-06-18",
        max_docs=10,
        skip_synthesized=False,
    )

    assert result["tasks_written"] == 0
    assert upserts == []
    assert result["errors"]
    assert "projection row count" in result["errors"][0]["error"]
