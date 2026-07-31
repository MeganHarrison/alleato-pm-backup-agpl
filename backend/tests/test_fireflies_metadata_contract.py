"""Persisted metadata contract for every Fireflies transcript."""

from src.services.ingestion.fireflies_pipeline import FIREFLIES_DOCUMENT_METADATA_CONTRACT


def test_fireflies_document_metadata_has_canonical_source_classification():
    assert FIREFLIES_DOCUMENT_METADATA_CONTRACT == {
        "source": "fireflies",
        "source_system": "fireflies",
        "type": "meeting",
        "category": "meeting",
    }
