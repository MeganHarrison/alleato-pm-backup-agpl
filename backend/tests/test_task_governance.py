from services.intelligence.task_governance import (
    classify_task_or_responsibility,
    govern_tasks,
)
from services.pipeline.models import TaskItem


def test_classifies_standing_support_as_responsibility():
    item = TaskItem(description="Continue providing technical coaching as questions arise", confidence=0.95)
    result = classify_task_or_responsibility(item)
    assert result["classification"] == "ongoing_responsibility"
    assert result["projectable"] is False


def test_dedupes_rephrased_tasks_and_preserves_review_and_provenance():
    first = TaskItem(description="Send the finish schedule to the owner", confidence=0.9, evidence_quote="send schedule")
    second = TaskItem(description="Send finish schedule to owner for sign-off", confidence=0.6, evidence_quote="for sign-off")
    result = govern_tasks([first, second], source_document_id="doc-7")
    assert len(result) == 1
    winner = result[0]
    assert winner.task_governance["needs_review"] is True
    assert winner.provenance["source_document_id"] == "doc-7"
    assert winner.task_governance["duplicate_count"] == 2


def test_ambiguous_statement_is_retained_for_human_review():
    item = TaskItem(description="Coordinate with the team", confidence=0.4)
    result = govern_tasks([item])
    assert len(result) == 1
    assert result[0].task_governance["needs_review"] is True

