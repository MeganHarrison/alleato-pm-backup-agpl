from types import SimpleNamespace

from src.services.integrations.microsoft_graph.onedrive import _assignment_tag


def test_onedrive_business_area_tag_does_not_claim_project_assignment():
    target = SimpleNamespace(
        project_id=None,
        business_area_id=4,
        method="folder_name",
    )

    assert _assignment_tag(target) == "business_area_auto:folder_name"


def test_onedrive_project_tag_is_retained_for_real_projects():
    target = SimpleNamespace(
        project_id=812,
        business_area_id=None,
        method="job_number",
    )

    assert _assignment_tag(target) == "project_auto:job_number"
