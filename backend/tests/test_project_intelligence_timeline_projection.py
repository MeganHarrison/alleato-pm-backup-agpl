from pathlib import Path

from src.services.project_intelligence.projections.source_timeline import (
    looks_like_change_event_signal,
)


def test_change_event_language_is_detected_without_generic_project_noise():
    assert looks_like_change_event_signal(
        title="Potential scope change",
        content="The owner requested extra work and pricing.",
        summary="Cost exposure requires review.",
    )
    assert not looks_like_change_event_signal(
        title="Weekly coordination",
        content="The team reviewed routine field progress.",
        summary="No material change.",
    )


def test_shared_compiler_cannot_direct_write_timeline_or_change_candidates():
    source = Path("src/services/intelligence/compiler.py").read_text()
    for table in (
        "project_intelligence_timeline_events",
        "project_intelligence_timeline_event_sources",
        "change_event_candidates",
    ):
        assert f'table("{table}")' not in source
    assert "upsert_project_timeline_event(" in source
    assert "upsert_timeline_event_source(" in source
    assert "upsert_change_event_candidate(" in source
