from src.services.project_intelligence.packet_repository import (
    PACKET_ITEM_COLUMNS,
    extract_packet_items,
    finding_key,
    merge_item,
)


def test_packet_item_projection_covers_merge_lifecycle_contract():
    columns = set(PACKET_ITEM_COLUMNS.split(","))

    assert {
        "id",
        "status",
        "resolved_at",
        "source_document_ids",
        "executive_artifact_id",
        "occurred_at",
        "first_seen_at",
        "source_evidence",
        "metadata",
    } <= columns


def test_finding_key_dedupes_case_and_punctuation():
    assert finding_key("risk", "Steel delivery — delayed!") == finding_key("risk", "steel delivery delayed")


def test_extract_packet_items_covers_cumulative_sections_and_dedupes():
    packet = {"packet_json": {"summary": {
        "timeline": [{"title": "Notice issued", "sourceIds": ["doc-1"]}],
        "risks": [{"title": "Steel delay", "sourceIds": ["doc-1"]}, {"title": "Steel delay", "sourceIds": ["doc-2"]}],
        "opportunities": [{"title": "Early procurement"}],
        "openDecisions": [{"title": "Approve alternate steel"}],
        "unresolvedQuestions": [{"question": "Will the shipment arrive Friday?"}],
    }}}
    rows = extract_packet_items(packet)
    assert {row["item_type"] for row in rows} == {"timeline", "risk", "opportunity", "decision", "unresolved_question"}
    assert len([row for row in rows if row["item_type"] == "risk"]) == 1


def test_merge_item_preserves_first_seen_and_sets_resolution_timestamp():
    prior = {"first_seen_at": "2026-07-01T00:00:00+00:00", "status": "open", "source_document_ids": ["doc-1"]}
    incoming = {"item_type": "risk", "finding_key": "risk:steel-delay", "title": "Steel delay", "status": "resolved", "source_ids": ["doc-2"]}
    merged = merge_item(prior, incoming, project_id=7, packet_id="packet-2", now="2026-07-21T00:00:00+00:00")
    assert merged["first_seen_at"] == prior["first_seen_at"]
    assert merged["last_seen_at"] == "2026-07-21T00:00:00+00:00"
    assert merged["resolved_at"] == merged["last_seen_at"]
    assert merged["source_document_ids"] == ["doc-1", "doc-2"]
