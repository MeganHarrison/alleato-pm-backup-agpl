"""Leadership-restricted meetings (Annual Reviews) — pipeline guardrails.

Companion to migration 20260723230000_leadership_restricted_meetings.sql:
the extractor must not fan restricted meetings out into insight cards/tasks,
and the embedder must stamp every chunk so the retrieval layer can gate it.
"""

from src.services.pipeline import embedder, extractor
from src.services.pipeline.models import DocumentChunk


class _CapturingTable:
    def __init__(self, sink):
        self._sink = sink

    def upsert(self, payload, on_conflict=None):
        self._sink.append(payload)
        return self

    def execute(self):
        return None


class _CapturingClient:
    def __init__(self):
        self.upserts = []

    def table(self, _name):
        return _CapturingTable(self.upserts)


def _chunk():
    return DocumentChunk(
        content="text",
        chunk_index=0,
        segment_index=-1,
        doc_type="chunk",
        content_hash="hash",
        embedding=[0.1],
    )


class TestExtractorRestriction:
    def test_access_level_stamp_is_restricted(self):
        assert extractor._is_leadership_restricted({"access_level": "leadership"})

    def test_annual_review_category_is_restricted_pre_stamp(self):
        assert extractor._is_leadership_restricted({"category": "Annual Review"})
        assert extractor._is_leadership_restricted({"category": "  annual review "})

    def test_normal_meeting_is_not_restricted(self):
        assert not extractor._is_leadership_restricted(
            {"category": "meeting", "access_level": "team"}
        )
        assert not extractor._is_leadership_restricted({})


class TestEmbedderChunkStamp:
    def test_restricted_doc_detection_matches_extractor(self):
        assert embedder._is_leadership_restricted_doc({"access_level": "leadership"})
        assert embedder._is_leadership_restricted_doc({"category": "Annual Review"})
        assert not embedder._is_leadership_restricted_doc({"category": "meeting"})

    def test_upsert_chunk_stamps_access_level_when_restricted(self):
        client = _CapturingClient()
        embedder._upsert_chunk(
            client,
            chunk=_chunk(),
            metadata_id="doc-1",
            segment_id=None,
            started_at=None,
            participants=[],
            project_id=90,
            title="Patrick -Review Form Feedback",
            existing_chunk_id=None,
            access_level="leadership",
        )
        assert len(client.upserts) == 1
        assert client.upserts[0]["metadata"]["access_level"] == "leadership"

    def test_upsert_chunk_omits_access_level_for_normal_docs(self):
        client = _CapturingClient()
        embedder._upsert_chunk(
            client,
            chunk=_chunk(),
            metadata_id="doc-2",
            segment_id=None,
            started_at=None,
            participants=[],
            project_id=90,
            title="Normal meeting",
            existing_chunk_id=None,
            access_level=None,
        )
        assert "access_level" not in client.upserts[0]["metadata"]
