from src.services.intelligence.project_synopsis import (
    build_synopsis_projection,
    packet_is_completed,
)


def packet(**overrides):
    value = {
        "id": "packet-1",
        "packet_type": "current",
        "freshness_status": "fresh",
        "current_status": None,
        "executive_summary": "Fallback summary",
        "confidence_summary": {"overall": "high"},
        "packet_json": {
            "kind": "daily_deep_read",
            "summary": {"currentExecutiveRead": "Packet synopsis", "risks": []},
            "sourceSet": {"sources": [{"id": "doc-1"}]},
        },
    }
    value.update(overrides)
    return value


def test_only_completed_packet_can_project():
    assert packet_is_completed(packet())
    assert not packet_is_completed(packet(freshness_status="failed"))
    assert not packet_is_completed(packet(packet_json={"kind": "draft"}))


def test_projection_carries_confidence_and_source_coverage():
    result = build_synopsis_projection(packet(), project_id=42)
    assert result["current_summary"] == "Packet synopsis"
    assert result["source_confidence"] == {
        "confidence": "high",
        "source_coverage": [{"id": "doc-1"}],
        "freshness_status": "fresh",
    }


def test_human_edited_synopsis_is_not_overwritten():
    result = build_synopsis_projection(packet(), project_id=42, existing={"synopsis_human_edited": True})
    assert "current_summary" not in result
