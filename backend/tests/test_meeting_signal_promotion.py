"""Tests for deep meeting extraction and canonical task persistence."""

from src.services.intelligence import client as intelligence_client
from src.services.pipeline import extractor, llm
from src.services.pipeline.models import TaskItem


def test_extract_deep_meeting_intelligence_parses_evidence_confidence_status(monkeypatch):
    """The deep pass maps the model's structured output onto typed items with
    evidence_quote, clamped confidence, and a validated status_hint."""
    fake_output = {
        "what_changed": "Permit is now approved; finishes still open.",
        "decisions": [
            {
                "description": "Proceed with slab pour next week",
                "rationale": "permit cleared",
                "owner": "Sam",
                "evidence_quote": "let's pour the slab Tuesday",
                "confidence": 1.4,  # out of range -> clamped to 1.0
                "status_hint": "new",
            }
        ],
        "risks": [
            {
                "description": "Finish selection delay risks the punchlist date",
                "category": "schedule",
                "impact": "high",
                "evidence_quote": "finishes are holding us up",
                "confidence": "not-a-number",  # invalid -> default
                "status_hint": "bogus",  # invalid -> None
            }
        ],
        "tasks": [
            {
                "description": "Send the finish schedule to the owner",
                "assignee": "Sam",
                "dueDate": "2026-06-15",
                "priority": "high",
                "evidence_quote": "Sam will send the finish schedule",
                "confidence": 0.9,
                "status_hint": "new",
            }
        ],
    }
    monkeypatch.setattr(
        intelligence_client, "extract_with_retry", lambda messages, model=None, **_: dict(fake_output)
    )

    result = llm.extract_deep_meeting_intelligence(
        title="Weekly OAC",
        date="2026-06-10",
        participants=["Sam"],
        full_transcript="... long transcript ...",
        project_state="Currently tracked OPEN TASKS:\n- [high] Pull permit (Sam)",
        prior_context="",
        speaker_email_map={"Sam": "sam@alleatogroup.com"},
    )

    assert result.what_changed.startswith("Permit is now approved")
    decision = result.decisions[0]
    assert decision.confidence == 1.0  # clamped
    assert decision.evidence_quote == "let's pour the slab Tuesday"
    assert decision.status_hint == "new"

    risk = result.risks[0]
    assert risk.confidence == 0.6  # invalid -> default
    assert risk.status_hint is None  # invalid -> dropped

    task = result.tasks[0]
    assert task.confidence == 0.9
    assert task.evidence_quote == "Sam will send the finish schedule"
    assert task.assignee_email == "sam@alleatogroup.com"  # resolved from map


def test_extract_with_retry_omits_temperature_for_gpt5_family():
    """Guardrail: gpt-5 / o-series reject a non-default temperature with a 400 that
    extract_with_retry would otherwise swallow into a silent _extraction_failed.
    For those models the temperature kwarg must be omitted entirely."""
    assert intelligence_client._supports_custom_temperature("gpt-4o-mini") is True
    assert intelligence_client._supports_custom_temperature("gpt-5.5") is False
    assert intelligence_client._supports_custom_temperature("openai/gpt-5.5") is False
    assert intelligence_client._supports_custom_temperature("o3-mini") is False

    captured = {}

    class _FakeCompletions:
        def create(self, **kwargs):
            captured.update(kwargs)
            msg = type("M", (), {"content": '{"ok": true}'})()
            return type("R", (), {"choices": [type("C", (), {"message": msg})()]})()

    class _FakeClient:
        chat = type("Chat", (), {"completions": _FakeCompletions()})()

    import src.services.intelligence.client as _ic
    orig = _ic._client
    _ic._client = lambda: _FakeClient()
    try:
        _ic.extract_with_retry([{"role": "user", "content": "x"}], model="gpt-5.5")
        assert "temperature" not in captured, "must not send temperature to gpt-5.5"
        captured.clear()
        _ic.extract_with_retry([{"role": "user", "content": "x"}], model="gpt-4o-mini")
        assert "temperature" in captured, "should send temperature to models that support it"
    finally:
        _ic._client = orig


def test_extract_deep_meeting_intelligence_returns_empty_on_failure(monkeypatch):
    monkeypatch.setattr(
        intelligence_client,
        "extract_with_retry",
        lambda messages, model=None, **_: {"_extraction_failed": True, "_errors": ["boom"]},
    )
    result = llm.extract_deep_meeting_intelligence(
        title="t", date=None, participants=[], full_transcript="x", project_state=""
    )
    assert result.decisions == [] and result.risks == [] and result.tasks == []


def test_merge_deep_and_rewriter_tasks_dedupes_overlap():
    deep = [TaskItem(description="Send the finish schedule to the owner", confidence=0.9)]
    rewriter = [
        TaskItem(description="Send finish schedule to owner for sign-off"),  # overlaps deep
        TaskItem(description="Order the long-lead switchgear from the vendor"),  # unique
    ]
    merged = extractor._merge_deep_and_rewriter_tasks(deep, rewriter)
    descriptions = [t.description for t in merged]
    assert "Order the long-lead switchgear from the vendor" in descriptions
    assert len(merged) == 2  # deep task kept, overlapping rewriter task dropped


class _FakeTaskTable:
    """Minimal Supabase table stub capturing the upserted task row."""

    def __init__(self, recorder):
        self._recorder = recorder

    def upsert(self, data, on_conflict=None):
        self._recorder["upserted"].append(data)
        return self

    def execute(self):
        return type("Resp", (), {"data": []})()


class _FakeTaskClient:
    def __init__(self, recorder):
        self._recorder = recorder

    def table(self, name):
        return _FakeTaskTable(self._recorder)


def _patch_employee_resolver(monkeypatch):
    from src.services import task_assignees

    resolved = task_assignees.ResolvedAssignee(
        person_id="p1", name="Sam", email="sam@alleatogroup.com",
        method="exact", confidence=0.99, person_type="employee",
    )
    monkeypatch.setattr(
        extractor, "TaskAssigneeResolver", lambda client: type("R", (), {"resolve": lambda self, n, e: resolved})()
    )


def test_upsert_task_low_confidence_deep_task_flagged_needs_review(monkeypatch):
    _patch_employee_resolver(monkeypatch)
    recorder = {"upserted": []}
    client = _FakeTaskClient(recorder)

    low = TaskItem(
        description="Maybe look into the elevator lead time at some point",
        assignee="Sam", confidence=0.4, evidence_quote="someone should check the elevator",
        status_hint="new",
    )
    extractor._upsert_task(client, low, "meeting-1", [42], 42)

    row = recorder["upserted"][0]
    assert row["status"] == "open"  # tasks table CHECK has no needs_review status
    assert row["extraction_source"] == "deep_extractor"
    assert row["extraction_model"] == "gpt-5.5"
    # tasks-quality trigger (migration 20260528000000) rejects AI tasks with a
    # null/empty extraction_prompt_version — deep tasks must set it.
    assert row["extraction_prompt_version"] == extractor.DEEP_EXTRACTION_PROMPT_VERSION
    assert row["title"]  # trigger also requires a non-empty title
    assert row["extraction_metadata"]["needs_review"] is True
    assert row["extraction_metadata"]["deep_confidence"] == 0.4
    assert row["extraction_metadata"]["evidence_quote"] == "someone should check the elevator"


def test_upsert_task_high_confidence_deep_task_auto_created(monkeypatch):
    _patch_employee_resolver(monkeypatch)
    recorder = {"upserted": []}
    client = _FakeTaskClient(recorder)

    high = TaskItem(
        description="Send the stamped permit set to the GC by Friday",
        assignee="Sam", confidence=0.95, evidence_quote="Sam, send the permit set Friday",
    )
    extractor._upsert_task(client, high, "meeting-1", [42], 42)

    row = recorder["upserted"][0]
    assert row["status"] == "open"
    assert row["extraction_source"] == "deep_extractor"
    assert row["extraction_prompt_version"] == extractor.DEEP_EXTRACTION_PROMPT_VERSION
    assert "needs_review" not in row["extraction_metadata"]
    assert row["extraction_metadata"]["deep_confidence"] == 0.95


def test_upsert_task_legacy_fireflies_task_records_prompt_version(monkeypatch):
    _patch_employee_resolver(monkeypatch)
    recorder = {"upserted": []}
    client = _FakeTaskClient(recorder)

    legacy = TaskItem(
        description="Check headphone and sound settings before the next call.",
        assignee="Sam",
    )
    extractor._upsert_task(client, legacy, "meeting-1", [42], 42)

    row = recorder["upserted"][0]
    assert row["source_system"] == "fireflies"
    assert row["extraction_source"] == "fireflies_pipeline_legacy"
    assert row["extraction_prompt_version"] == extractor.LEGACY_FIREFLIES_TASK_PROMPT_VERSION
