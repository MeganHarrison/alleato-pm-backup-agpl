from src.services.ingestion.project_assignment import AssignmentTarget
from src.services.integrations.microsoft_graph import project_inference


class _FakeAssigner:
    def __init__(
        self,
        *,
        target: AssignmentTarget | None = None,
        project_result=(None, "unassigned", 0.0),
        error: Exception | None = None,
    ):
        self.target = target
        self.project_result = project_result
        self.error = error

    def assign_scope(self, **_kwargs):
        if self.error is not None:
            raise self.error
        assert self.target is not None
        return self.target

    def assign_project(self, **_kwargs):
        return self.project_result


def test_infer_assignment_target_preserves_business_area_destination(monkeypatch):
    monkeypatch.setattr(
        project_inference,
        "_cached_assigner",
        _FakeAssigner(
            target=AssignmentTarget(
                project_id=None,
                business_area_id=3,
                legacy_project_id=60,
                method="attribution_rule:title_keyword",
                confidence=0.98,
            )
        ),
    )

    target = project_inference.infer_assignment_target(
        object(),
        title="Finance monthly close",
        content="",
        participants=[],
    )

    assert target.business_area_id == 3
    assert target.project_id is None
    assert target.legacy_project_id == 60


def test_infer_assignment_target_rejects_low_confidence_destination(monkeypatch):
    monkeypatch.setattr(
        project_inference,
        "_cached_assigner",
        _FakeAssigner(
            target=AssignmentTarget(
                project_id=31,
                business_area_id=None,
                method="title_match_low_conf",
                confidence=0.55,
            )
        ),
    )

    target = project_inference.infer_assignment_target(
        object(),
        title="Possible project update",
        content="",
        participants=[],
    )

    assert target.project_id is None
    assert target.business_area_id is None
    assert target.method == "title_match_low_conf"
    assert target.confidence == 0.55


def test_infer_assignment_target_fails_closed_on_mapping_error(monkeypatch, caplog):
    monkeypatch.setattr(
        project_inference,
        "_cached_assigner",
        _FakeAssigner(error=RuntimeError("mapping unavailable")),
    )

    target = project_inference.infer_assignment_target(
        object(),
        title="Finance monthly close",
        content="",
        participants=[],
    )

    assert target.project_id is None
    assert target.business_area_id is None
    assert target.method == "assignment_error"
    assert target.confidence == 0.0
    assert "typed assignment failed" in caplog.text


def test_infer_project_id_remains_compatible_for_unmigrated_callers(monkeypatch):
    monkeypatch.setattr(
        project_inference,
        "_cached_assigner",
        _FakeAssigner(
            project_result=(31, "title_match", 0.95),
        ),
    )

    project_id, method, confidence = project_inference.infer_project_id(
        object(),
        title="Uniqlo Phillipsburg NJ owner meeting",
        content="",
        participants=[],
    )

    assert project_id == 31
    assert method == "title_match"
    assert confidence == 0.95
