from pathlib import Path


def test_shared_compiler_delegates_report_suggestion_writes():
    source = Path("src/services/intelligence/compiler.py").read_text()
    assert 'table("project_report_suggestions")' not in source
    assert "upsert_project_report_suggestions(" in source


def test_report_suggestion_owner_is_canonical_project_intelligence_module():
    source = Path("src/services/project_intelligence/projections/report_suggestions.py").read_text()
    assert 'table("project_report_suggestions")' in source
    assert "project_report_suggestion_projection" in source
