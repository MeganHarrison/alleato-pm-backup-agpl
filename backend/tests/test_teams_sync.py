from types import SimpleNamespace

from src.services.integrations.microsoft_graph.teams import (
    _assignment_catalog_fields,
    _assignment_tag,
)


def test_business_area_assignment_is_exact_and_never_keeps_project_scope():
    target = SimpleNamespace(
        project_id=None,
        business_area_id=3,
        method="business_area_map",
    )

    assert _assignment_catalog_fields(target) == {
        "project_id": None,
        "business_area_id": 3,
    }
    assert _assignment_tag(target) == "business_area_auto:business_area_map"


def test_project_assignment_remains_supported_for_real_projects():
    target = SimpleNamespace(
        project_id=812,
        business_area_id=None,
        method="job_number",
    )

    assert _assignment_catalog_fields(target) == {
        "project_id": 812,
        "business_area_id": None,
    }
    assert _assignment_tag(target) == "project_auto:job_number"
