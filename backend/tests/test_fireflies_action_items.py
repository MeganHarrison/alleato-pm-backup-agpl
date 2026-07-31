"""Regression tests for Fireflies task extraction.

The legacy regex-based `_build_task_rows_from_action_items` produced the bug
this suite was originally written against: third-person Fireflies action
items copied verbatim into the tasks table with whoever was named in the text
assigned as owner. That path is now replaced by `fireflies_task_rewriter`.

These tests guard the rewriter's deterministic helpers (no LLM call) so the
narration-detection regex doesn't regress.
"""
from __future__ import annotations

from datetime import datetime
import pytest

import src.services.ingestion.fireflies_pipeline as fireflies_pipeline
import src.services.pipeline.extractor as pipeline_extractor
from src.services.ingestion.fireflies_task_rewriter import (
    _build_user_prompt,
    _looks_like_narration,
    _normalize_priority,
    _valid_iso_date,
)
from src.services.ingestion.fireflies_pipeline import FirefliesIngestionPipeline
from src.services.pipeline.models import TaskItem


# Real Fireflies action_items string for the Goodwill Kokomo design meeting —
# the meeting that surfaced the assignee-loss bug. Owners are grouped under
# **Name** headers with their items beneath.
GOODWILL_ACTION_ITEMS = """
**Colin Nicoski**
Deliver the CAD file by midweek to maintain the project schedule (00:22)
Lead the submission process for BZA variances and subsequent development plans (05:02)

**Jerome / DKGR**
Send the latest building footprint and updated shell drawings (00:56)

**Nick Jepson**
Verify scheduling urgency with Goodwill regarding variance submission (04:07)

**Nick Jepson / Team**
Confirm if there is any push to proceed with drawings prior to the July BZA meeting (03:45)
"""


class TestGroupedActionItemParsing:
    def test_preserves_assignee_per_item(self):
        pairs = FirefliesIngestionPipeline._parse_grouped_action_items(GOODWILL_ACTION_ITEMS)
        assert [p["assignee"] for p in pairs] == [
            "Colin Nicoski",
            "Colin Nicoski",
            "Jerome / DKGR",
            "Nick Jepson",
            "Nick Jepson / Team",
        ]
        # Owner headers must NOT leak into item text (the old bug kept them out
        # of the list entirely; the new behavior keeps them as the assignee).
        assert all(not p["text"].startswith("**") for p in pairs)
        assert pairs[0]["text"].startswith("Deliver the CAD file")

    def test_items_before_any_header_are_unassigned(self):
        pairs = FirefliesIngestionPipeline._parse_grouped_action_items(
            "Floating item with no owner\n**Owner**\nOwned item"
        )
        assert pairs[0] == {"assignee": None, "text": "Floating item with no owner"}
        assert pairs[1] == {"assignee": "Owner", "text": "Owned item"}

    def test_list_input_has_no_assignee(self):
        pairs = FirefliesIngestionPipeline._parse_grouped_action_items(["a", "b"])
        assert pairs == [
            {"assignee": None, "text": "a"},
            {"assignee": None, "text": "b"},
        ]

    def test_empty_dict_returns_empty(self):
        assert FirefliesIngestionPipeline._parse_grouped_action_items({}) == []


class TestActionItemsStorageRoundTrip:
    def test_storage_format_then_structured_parse_recovers_owners(self):
        pairs = FirefliesIngestionPipeline._parse_grouped_action_items(GOODWILL_ACTION_ITEMS)
        stored = FirefliesIngestionPipeline._format_action_items_storage(pairs)
        # Stored value carries the owner headers so the UI can group by assignee.
        assert "**Colin Nicoski**" in stored
        assert "**Nick Jepson**" in stored
        assert "- Deliver the CAD file by midweek" in stored

        # Re-parsing the stored markdown (as the parser does on re-ingest) must
        # recover the same owner→item pairs.
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        sections = {"Action Items": stored}
        flat = [p["text"] for p in pairs]
        recovered = pipeline._parse_action_items_structured(sections, flat)
        assert [p["assignee"] for p in recovered] == [p["assignee"] for p in pairs]

    def test_structured_parse_falls_back_to_unassigned_on_count_mismatch(self):
        # Legacy inline format collapses to a single grouped item; flat parser
        # recovers more, so we fall back to owner-less pairs rather than mislabel.
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        sections = {"Action Items": "- item one (29:49) - item two (08:36)"}
        flat = ["item one (29:49)", "item two (08:36)"]
        recovered = pipeline._parse_action_items_structured(sections, flat)
        assert recovered == [
            {"assignee": None, "text": "item one (29:49)"},
            {"assignee": None, "text": "item two (08:36)"},
        ]


class TestRewriterOwnerHint:
    def test_user_prompt_includes_fireflies_owner(self):
        prompt = _build_user_prompt(
            title="Goodwill Kokomo Weekly Design Meeting",
            source_date="2026-06-01",
            participants=["Nick Jepson"],
            speaker_email_map={},
            action_items=["Verify scheduling urgency with Goodwill"],
            notes_context="",
            item_owners=["Nick Jepson"],
        )
        assert "[Fireflies owner: Nick Jepson] Verify scheduling urgency" in prompt

    def test_user_prompt_omits_hint_when_owner_missing(self):
        prompt = _build_user_prompt(
            title="m",
            source_date=None,
            participants=[],
            speaker_email_map={},
            action_items=["Do the thing"],
            notes_context="",
            item_owners=[None],
        )
        assert "- Do the thing" in prompt
        assert "Fireflies owner" not in prompt


class TestNarrationDetection:
    @pytest.mark.parametrize(
        "text",
        [
            "Provide support and coaching to Brandon Clymer regarding the deluge system",
            "Inform Brandon once Ben's answers are ready",
            "Brandon Clymer asked Katie Conner about overdue payments",
            "Coordinate with Sarah on contract edits",
            "Coordinate scheduling of a detailed discussion call",
        ],
    )
    def test_rejects_narration_shapes(self, text: str):
        assert _looks_like_narration(text), f"Expected narration to be flagged: {text!r}"

    @pytest.mark.parametrize(
        "text",
        [
            "Escalate Katie Conner's overdue payment",
            "Send updated CAD with trays to Brandon",
            "Submit RFI #042 about door swing",
            "Schedule fire marshal inspection for week of June 10",
        ],
    )
    def test_accepts_imperative_tasks(self, text: str):
        assert not _looks_like_narration(text), f"Imperative task should not be flagged: {text!r}"


class TestPriorityNormalization:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("high", "high"),
            ("Medium", "medium"),
            ("LOW", "low"),
            ("urgent", "high"),
            ("", None),
            (None, None),
            ("not-a-priority", None),
        ],
    )
    def test_normalize(self, raw, expected):
        assert _normalize_priority(raw) == expected


class TestDateValidation:
    @pytest.mark.parametrize(
        "raw,expected",
        [
            ("2026-05-21", "2026-05-21"),
            ("not-a-date", None),
            ("", None),
            (None, None),
            ("2026/05/21", None),
        ],
    )
    def test_valid_iso_date(self, raw, expected):
        assert _valid_iso_date(raw) == expected


class _FakeMessage:
    def __init__(self, content: str) -> None:
        self.content = content


class _FakeChoice:
    def __init__(self, content: str) -> None:
        self.message = _FakeMessage(content)


class _FakeResponse:
    def __init__(self, content: str) -> None:
        self.choices = [_FakeChoice(content)]


class _FakeOpenAIClient:
    """Minimal stand-in for the OpenAI client returning a canned chat response."""

    def __init__(self, content: str) -> None:
        self._content = content
        self.chat = self  # type: ignore[assignment]
        self.completions = self  # type: ignore[assignment]

    def create(self, *args, **kwargs):  # noqa: ANN002, ANN003 - test stub
        return _FakeResponse(self._content)


class _FakeTaskTable:
    def __init__(self) -> None:
        self.upserted = None

    def upsert(self, data, on_conflict=None):  # noqa: ANN001
        self.upserted = {"data": data, "on_conflict": on_conflict}
        return self

    def execute(self):
        return None


class _FakeSupabaseClient:
    def __init__(self) -> None:
        self.tasks_table = _FakeTaskTable()

    def table(self, name: str):
        assert name == "tasks"
        return self.tasks_table


class _ResolvedEmployee:
    is_employee = True
    person_type = "employee"
    method = "test"
    confidence = 1.0
    name = "Megan Harrison"
    person_id = "person-1"
    email = "megan@example.com"


class _FakeTaskAssigneeResolver:
    def __init__(self, client) -> None:  # noqa: ANN001
        self.client = client

    def resolve(self, assignee, assignee_email):  # noqa: ANN001
        return _ResolvedEmployee()


class TestExtractorTaskProjectLinks:
    def test_upsert_task_persists_project_ids_with_project_id(self, monkeypatch):
        monkeypatch.setattr(pipeline_extractor, "TaskAssigneeResolver", _FakeTaskAssigneeResolver)
        client = _FakeSupabaseClient()

        persisted = pipeline_extractor._upsert_task(
            client,
            TaskItem(
                description="Send updated schedule to the project team",
                assignee="Megan Harrison",
                assignee_email="megan@example.com",
                priority="medium",
            ),
            metadata_id="meeting-1",
            project_ids=[1009],
            project_id=1009,
        )

        assert persisted is True
        assert client.tasks_table.upserted["on_conflict"] == "metadata_id,description"
        data = client.tasks_table.upserted["data"]
        assert data["project_id"] == 1009
        assert data["project_ids"] == [1009]
        assert data["source_system"] == "fireflies"


class TestMeetingMemoryExtraction:
    """Guards the meeting → ai_memories path against structural code bugs.

    Regression: `_extract_meeting_memories` referenced `_openai_provider_configs`,
    `_client_for_provider`, and `_model_for_provider` — none of which exist in the
    module — so every meeting ingest raised NameError. It was swallowed by the
    caller's try/except, silently disabling memory extraction for every Fireflies
    meeting. This test exercises the chat path so that class of bug can't recur
    undetected.
    """

    def test_extraction_reaches_chat_without_undefined_helpers(self, monkeypatch):
        from src.services.ingestion import fireflies_pipeline

        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        monkeypatch.setattr(
            fireflies_pipeline,
            "get_openai_client",
            lambda: _FakeOpenAIClient("[]"),
        )

        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        # An empty "[]" response returns before any Supabase/embedder access, so
        # __init__ collaborators are not needed. Before the fix this raised
        # NameError: name '_openai_provider_configs' is not defined.
        result = pipeline._extract_meeting_memories(
            document_id="doc-1",
            project_id=1009,
            title="Weekly Design Sync",
            content="We agreed to ship the CAD file by Friday.",
            action_items=["Deliver the CAD file by Friday"],
        )
        assert result is None

    def test_valid_memory_runs_full_parse_path(self, monkeypatch):
        from src.services.ingestion import fireflies_pipeline

        monkeypatch.setenv("OPENAI_API_KEY", "test-key")
        # Clear Supabase creds so the method stops at the storage guard *after*
        # parsing + validating memories — exercising the JSON/validation path
        # without any network write.
        monkeypatch.delenv("SUPABASE_URL", raising=False)
        monkeypatch.delenv("NEXT_PUBLIC_SUPABASE_URL", raising=False)
        monkeypatch.delenv("SUPABASE_SERVICE_ROLE_KEY", raising=False)
        memory_json = (
            '[{"type": "commitment", "content": "Colin delivers the CAD file by '
            'Friday.", "importance": 0.8, "confidence": 0.9}]'
        )
        monkeypatch.setattr(
            fireflies_pipeline,
            "get_openai_client",
            lambda: _FakeOpenAIClient(memory_json),
        )

        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        # Returns at the missing-Supabase-creds guard, never touching the network.
        result = pipeline._extract_meeting_memories(
            document_id="doc-2",
            project_id=1009,
            title="Weekly Design Sync",
            content="Colin will deliver the CAD file by Friday.",
            action_items=[],
        )
        assert result is None


class _SkipGuardStore:
    def __init__(self):
        # `_link_transcript_to_meeting` / `_upsert_structured_meeting` both
        # read `self.store._client` directly (matching the real
        # SupabaseRagStore shape) — an empty fake client makes both no-op
        # cleanly (no meeting candidates found) rather than raising
        # AttributeError, exercising the same code path a real store hits.
        self._client = _FakeStructuredMeetingClient()

    def find_document_by_hash(self, content_hash):  # noqa: ANN001
        return {"id": "doc-existing", "project_id": 1009, "fireflies_id": "ff-123"}

    def has_embedded_chunks_for_document(self, document_id):  # noqa: ANN001
        return True

    def find_document_by_fireflies_id(self, fireflies_id):  # noqa: ANN001
        raise AssertionError("exact-content skip should not need Fireflies-id lookup")


class _MissingChunksStore:
    def __init__(self):
        self.metadata_payloads = []
        self.chunks = []
        self._client = _FakeStructuredMeetingClient()

    def find_document_by_hash(self, content_hash):  # noqa: ANN001
        return {"id": "doc-existing", "project_id": 1009, "fireflies_id": "ff-123"}

    def has_embedded_chunks_for_document(self, document_id):  # noqa: ANN001
        return False

    def find_document_by_fireflies_id(self, fireflies_id):  # noqa: ANN001
        return {"id": "doc-existing", "project_id": 1009, "fireflies_id": fireflies_id}

    def upsert_document_metadata(self, metadata):  # noqa: ANN001
        self.metadata_payloads.append(metadata)
        return metadata

    def set_document_scope(
        self,
        document_id,
        *,
        project_id,
        business_area_id,
    ):  # noqa: ANN001
        self.scope = {
            "document_id": document_id,
            "project_id": project_id,
            "business_area_id": business_area_id,
        }

    def start_ingestion_job(self, fireflies_id, content_hash):  # noqa: ANN001
        return None

    def delete_chunks_for_document(self, document_id):  # noqa: ANN001
        return None

    def upsert_chunks(self, chunks):  # noqa: ANN001
        self.chunks.extend(chunks)

    def complete_ingestion_job(self, job_id, status, error=None):  # noqa: ANN001
        return None


class _FakeEmbedder:
    def embed(self, texts):  # noqa: ANN001
        return [[0.1, 0.2, 0.3] for _ in texts]


class _UnexpectedWorkEmbedder:
    def embed(self, texts):  # noqa: ANN001
        raise AssertionError("unchanged transcripts must not be re-embedded")


class TestIngestShortCircuitsUnchangedTranscript:
    def test_exact_content_reingest_skips_llm_and_embedding_work(self):
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = _SkipGuardStore()
        pipeline.embedder = _UnexpectedWorkEmbedder()
        pipeline._fireflies_api_key = None
        pipeline._project_assigner = None
        pipeline._infer_project_id_from_context = lambda *args, **kwargs: None

        markdown = """# Weekly Design Sync

**Fireflies ID:** ff-123
**Date:** 2026-06-16

## Summary
No material updates.

## Action Items
- Follow up with architect

## Transcript
[00:01] **Brandon**: Quick project check-in.
"""

        result = pipeline.ingest_markdown_text(markdown, dry_run=False)

        assert result.document_id == "doc-existing"
        assert result.skipped is True
        assert result.dry_run is False
        assert result.action_item_count == 1
        assert result.chunk_count == 0

    def test_exact_content_reingest_reprocesses_when_embedded_chunks_are_missing(self, monkeypatch):
        monkeypatch.setattr(
            fireflies_pipeline,
            "record_source_processing_status",
            lambda *args, **kwargs: None,
        )

        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = _MissingChunksStore()
        pipeline.embedder = _FakeEmbedder()
        pipeline._fireflies_api_key = None
        pipeline._project_assigner = None
        pipeline._infer_project_id_from_context = lambda *args, **kwargs: None
        pipeline._extract_meeting_memories = lambda *args, **kwargs: None
        pipeline._update_ingestion_job_state = lambda *args, **kwargs: None

        markdown = """# Weekly Design Sync

**Fireflies ID:** ff-123
**Date:** 2026-06-16

## Summary
No material updates.

## Action Items
- Follow up with architect

## Transcript
[00:01] **Brandon**: Quick project check-in.
"""

        result = pipeline.ingest_markdown_text(markdown, dry_run=False)

        assert result.document_id == "doc-existing"
        assert result.skipped is False
        assert result.chunk_count == 1
        assert len(pipeline.store.chunks) == 1

    def test_skipped_unchanged_branch_links_meeting_and_upserts_structured_row(self, monkeypatch):
        """Regression: commit 61903b9cb fixed an UnboundLocalError where
        `existing_project_id` was referenced before assignment in the
        skipped_unchanged branch. This test drives the full path end-to-end
        to ensure the fix holds: linking to a matching meeting + upserting
        a structured meeting row both succeed when content hash matches."""
        monkeypatch.setattr(
            fireflies_pipeline,
            "record_source_processing_status",
            lambda *args, **kwargs: None,
        )

        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = _SkipGuardStore()
        pipeline.embedder = _UnexpectedWorkEmbedder()
        pipeline._fireflies_api_key = None
        pipeline._project_assigner = None
        pipeline._infer_project_id_from_context = lambda *args, **kwargs: None
        # Track calls to verify linking and upsert happen
        linking_calls = []
        upsert_calls = []

        def _mock_link(*args, **kwargs):
            linking_calls.append((args, kwargs))
            return None  # _link_transcript_to_meeting returns None on no match

        def _mock_upsert(sb, doc_meta):
            upsert_calls.append((sb, doc_meta))
            return {"id": "meeting-linked", "project_id": 1009}

        pipeline._link_transcript_to_meeting = _mock_link
        pipeline._upsert_structured_meeting = _mock_upsert

        markdown = """# Weekly Design Sync

**Fireflies ID:** ff-existing
**Date:** 2026-06-16

## Summary
No material updates.

## Action Items
- Follow up with architect

## Transcript
[00:01] **Brandon**: Quick project check-in.
"""

        result = pipeline.ingest_markdown_text(markdown, dry_run=False)

        # Document skipped due to exact-content match
        assert result.skipped is True
        assert result.document_id == "doc-existing"
        # Verify both linking and upsert were called (no UnboundLocalError)
        assert len(linking_calls) == 1
        assert len(upsert_calls) == 1
        # Verify the upsert received the correct project_id from existing
        upsert_doc_meta = upsert_calls[0][1]
        assert upsert_doc_meta["project_id"] == 1009


class _FakeMeetingQueryResponse:
    def __init__(self, data):
        self.data = data


class _FakeMeetingQuery:
    def __init__(self, rows, updates):
        self.rows = rows
        self.updates = updates
        self._eq_calls = []
        self._payload = None

    def select(self, *args):  # noqa: ANN002
        return self

    def eq(self, column, value):  # noqa: ANN001
        self._eq_calls.append((column, value))
        return self

    def order(self, *args, **kwargs):  # noqa: ANN001
        return self

    def update(self, payload):  # noqa: ANN001
        self._payload = payload
        return self

    def execute(self):
        if self._payload is None:
            rows = [row for row in self.rows]
            for column, value in self._eq_calls:
                rows = [row for row in rows if row.get(column) == value]
            return _FakeMeetingQueryResponse(rows)

        self.updates.append({"payload": self._payload, "conditions": list(self._eq_calls)})
        return _FakeMeetingQueryResponse([])


class _FakeMeetingClient:
    def __init__(self, rows):
        self.rows = rows
        self.updates = []

    def table(self, name):  # noqa: ANN001
        assert name == "meetings"
        return _FakeMeetingQuery(self.rows, self.updates)


class _MeetingLinkStore:
    def __init__(self, rows):
        self._client = _FakeMeetingClient(rows)


class TestTranscriptToMeetingLinking:
    def test_links_exact_title_match_once(self):
        meeting_rows = [
            {
                "id": "meeting-1",
                "project_id": 1009,
                "name": "Weekly Design Sync",
                "meeting_date": "2026-06-16",
                "transcript_document_id": None,
                "meeting_link": None,
            }
        ]
        store = _MeetingLinkStore(meeting_rows)
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = store

        meeting_id = pipeline._link_transcript_to_meeting(
            document_id="doc-1",
            meeting_title="Weekly Design Sync",
            project_id=1009,
            captured_at=datetime(2026, 6, 16),
            fireflies_id=None,
        )

        assert meeting_id == "meeting-1"
        assert len(store._client.updates) == 1
        assert store._client.updates[0]["payload"] == {"transcript_document_id": "doc-1"}
        assert store._client.updates[0]["conditions"] == [("id", "meeting-1")]

    def test_does_not_overwrite_existing_transcript_link(self):
        meeting_rows = [
            {
                "id": "meeting-2",
                "project_id": 1009,
                "name": "Weekly Design Sync",
                "meeting_date": "2026-06-16",
                "transcript_document_id": "already-linked",
                "meeting_link": None,
            }
        ]
        store = _MeetingLinkStore(meeting_rows)
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = store

        meeting_id = pipeline._link_transcript_to_meeting(
            document_id="doc-2",
            meeting_title="Weekly Design Sync",
            project_id=1009,
            captured_at=datetime(2026, 6, 16),
            fireflies_id=None,
        )

        assert meeting_id is None
        assert len(store._client.updates) == 0

    def test_logs_ambiguous_matches_with_no_update(self):
        meeting_rows = [
            {
                "id": "meeting-3",
                "project_id": 1009,
                "name": "Weekly Design Sync",
                "meeting_date": "2026-06-16",
                "transcript_document_id": None,
                "meeting_link": None,
            },
            {
                "id": "meeting-4",
                "project_id": 1009,
                "name": "Weekly Design Sync",
                "meeting_date": "2026-06-16",
                "transcript_document_id": None,
                "meeting_link": None,
            },
        ]
        store = _MeetingLinkStore(meeting_rows)
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        pipeline.store = store

        meeting_id = pipeline._link_transcript_to_meeting(
            document_id="doc-3",
            meeting_title="Weekly Design Sync",
            project_id=1009,
            captured_at=datetime(2026, 6, 16),
            fireflies_id=None,
        )

        assert meeting_id is None
        assert len(store._client.updates) == 0


# ---------------------------------------------------------------------------
# _upsert_structured_meeting — Task 8: every new Fireflies transcript
# automatically gets a `meetings` row (series upsert + max(number)+1 + insert).
# ---------------------------------------------------------------------------


class _DuplicateKeyError(Exception):
    """Stand-in for the exception real supabase-py raises on a unique_violation
    (message-based detection, matching `_is_duplicate_key_error` elsewhere in
    this codebase — e.g. `src/services/acumatica_sync.py`)."""

    def __init__(self, message: str = "duplicate key value violates unique constraint"):
        super().__init__(message)


class _FakeSupabaseResponse:
    def __init__(self, data):
        self.data = data


class _FakeStructuredMeetingsTable:
    """Fake `meetings` table supporting the exact chains
    `_upsert_structured_meeting` issues: eq(transcript_document_id).limit(1),
    eq(series_id).order(number desc).limit(1), and insert()."""

    def __init__(self, rows, *, fail_next_insert_with=None):
        self.rows = rows
        self.inserted = []
        self._fail_next_insert_with = fail_next_insert_with
        self._eq_calls = []
        self._order_desc = False
        self._mode = "select"

    def select(self, *_args):
        self._mode = "select"
        self._eq_calls = []
        return self

    def eq(self, column, value):
        self._eq_calls.append((column, value))
        return self

    def order(self, _column, desc=False):
        self._order_desc = desc
        return self

    def limit(self, _value):
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._payload = payload
        return self

    def execute(self):
        if self._mode == "insert":
            if self._fail_next_insert_with is not None:
                exc = self._fail_next_insert_with
                self._fail_next_insert_with = None  # only fails once
                raise exc
            row = {"id": f"meeting-{len(self.inserted) + 1}", **self._payload}
            self.inserted.append(row)
            self.rows.append(row)
            return _FakeSupabaseResponse([row])

        rows = list(self.rows)
        for column, value in self._eq_calls:
            rows = [r for r in rows if r.get(column) == value]
        if self._order_desc:
            rows = sorted(rows, key=lambda r: r.get("number", 0), reverse=True)
        return _FakeSupabaseResponse(rows)


class _FakeSeriesTable:
    """Fake `meeting_series` table supporting eq(project_id).eq(name).limit(1)
    and insert(), with optional injected unique-violation on the next insert."""

    def __init__(self, rows, *, fail_next_insert_with=None):
        self.rows = rows
        self.inserted = []
        self._fail_next_insert_with = fail_next_insert_with
        self._eq_calls = []
        self._mode = "select"

    def select(self, *_args):
        self._mode = "select"
        self._eq_calls = []
        return self

    def eq(self, column, value):
        self._eq_calls.append((column, value))
        return self

    def limit(self, _value):
        return self

    def insert(self, payload):
        self._mode = "insert"
        self._payload = payload
        return self

    def execute(self):
        if self._mode == "insert":
            if self._fail_next_insert_with is not None:
                exc = self._fail_next_insert_with
                self._fail_next_insert_with = None
                raise exc
            row = {"id": f"series-{len(self.inserted) + 1}", **self._payload}
            self.inserted.append(row)
            self.rows.append(row)
            return _FakeSupabaseResponse([row])

        rows = list(self.rows)
        for column, value in self._eq_calls:
            rows = [r for r in rows if r.get(column) == value]
        return _FakeSupabaseResponse(rows)


class _FakeStructuredMeetingClient:
    """Routes `.table("meetings")` / `.table("meeting_series")` to independent
    fake tables sharing this client's row lists."""

    def __init__(
        self,
        meeting_rows=None,
        series_rows=None,
        *,
        fail_next_meeting_insert_with=None,
        fail_next_series_insert_with=None,
    ):
        self.meetings = _FakeStructuredMeetingsTable(
            meeting_rows if meeting_rows is not None else [],
            fail_next_insert_with=fail_next_meeting_insert_with,
        )
        self.series = _FakeSeriesTable(
            series_rows if series_rows is not None else [],
            fail_next_insert_with=fail_next_series_insert_with,
        )

    def table(self, name):
        if name == "meetings":
            return self.meetings
        if name == "meeting_series":
            return self.series
        raise AssertionError(f"unexpected table: {name}")


def _new_pipeline() -> FirefliesIngestionPipeline:
    return FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)


class TestStoragePathSanitization:
    def test_build_storage_path_handles_unicode_titles(self):
        pipeline = _new_pipeline()

        path = pipeline._build_storage_path("Réunion / façade: süd", None)

        assert path.endswith(" - Reunion facade sud.md")


class TestUpsertStructuredMeeting:
    def test_existing_link_is_idempotent_skip(self):
        client = _FakeStructuredMeetingClient(
            meeting_rows=[
                {
                    "id": "meeting-9",
                    "project_id": 1009,
                    "series_id": "series-1",
                    "number": 3,
                    "name": "Weekly OAC",
                    "transcript_document_id": "doc-existing",
                }
            ]
        )
        pipeline = _new_pipeline()

        result = pipeline._upsert_structured_meeting(
            client, {"id": "doc-existing", "project_id": 1009, "title": "Weekly OAC"}
        )

        assert result["id"] == "meeting-9"
        # No new series/meeting rows were created — pure skip.
        assert client.series.inserted == []
        assert client.meetings.inserted == []

    def test_no_project_id_skips_without_creating_rows(self):
        client = _FakeStructuredMeetingClient()
        pipeline = _new_pipeline()

        result = pipeline._upsert_structured_meeting(
            client, {"id": "doc-1", "project_id": None, "title": "Untethered Sync"}
        )

        assert result is None
        assert client.series.inserted == []
        assert client.meetings.inserted == []

    def test_new_series_and_first_meeting_number(self):
        client = _FakeStructuredMeetingClient()
        pipeline = _new_pipeline()

        result = pipeline._upsert_structured_meeting(
            client,
            {
                "id": "doc-2",
                "project_id": 1009,
                "title": "Weekly Design Sync",
                "date": "2026-06-16T15:00:00+00:00",
                "meeting_link": "https://fireflies.ai/view/abc123",
            },
        )

        assert result is not None
        assert result["number"] == 1
        assert result["mode"] == "minutes"
        assert result["is_draft"] is False
        assert result["name"] == "Weekly Design Sync"
        assert result["meeting_date"] == "2026-06-16"
        assert result["meeting_link"] == "https://fireflies.ai/view/abc123"
        assert result["transcript_document_id"] == "doc-2"
        assert len(client.series.inserted) == 1
        assert client.series.inserted[0]["project_id"] == 1009
        assert client.series.inserted[0]["name"] == "Weekly Design Sync"

    def test_existing_series_numbers_max_plus_one(self):
        client = _FakeStructuredMeetingClient(
            meeting_rows=[
                {
                    "id": "meeting-1",
                    "project_id": 1009,
                    "series_id": "series-existing",
                    "number": 4,
                    "name": "Weekly Design Sync",
                    "transcript_document_id": "doc-old",
                }
            ],
            series_rows=[{"id": "series-existing", "project_id": 1009, "name": "Weekly Design Sync"}],
        )
        pipeline = _new_pipeline()

        result = pipeline._upsert_structured_meeting(
            client,
            {"id": "doc-3", "project_id": 1009, "title": "Weekly Design Sync"},
        )

        assert result["number"] == 5
        assert result["series_id"] == "series-existing"
        # No duplicate series was created — the existing one was reused.
        assert client.series.inserted == []

    def test_duplicate_number_race_retries_once(self):
        # Simulate: this helper reads max(number)=1 and computes next=2, but a
        # concurrent writer already inserted number=2 by the time this insert
        # lands, so Postgres raises unique_violation on (series_id, number).
        # The retry re-reads max(number) (now 2, since the concurrent row is
        # visible) and succeeds at 3.
        concurrent_row = {
            "id": "concurrent-writer",
            "project_id": 1009,
            "series_id": "series-existing",
            "number": 2,
            "transcript_document_id": "doc-concurrent",
        }
        client = _FakeStructuredMeetingClient(
            meeting_rows=[
                {
                    "id": "meeting-1",
                    "project_id": 1009,
                    "series_id": "series-existing",
                    "number": 1,
                    "name": "Weekly Design Sync",
                    "transcript_document_id": "doc-old",
                }
            ],
            series_rows=[{"id": "series-existing", "project_id": 1009, "name": "Weekly Design Sync"}],
            fail_next_meeting_insert_with=_DuplicateKeyError(),
        )
        pipeline = _new_pipeline()

        # The fake insert() raises before appending a row, so the "concurrent"
        # insert must be seeded into the row list directly to be visible to
        # the retry's max(number) re-read — this mirrors what a real
        # concurrent transaction would have committed by then.
        original_insert = client.meetings.insert

        def _insert_with_concurrent_seed(payload):
            if client.meetings._fail_next_insert_with is not None and concurrent_row not in client.meetings.rows:
                client.meetings.rows.append(concurrent_row)
            return original_insert(payload)

        client.meetings.insert = _insert_with_concurrent_seed

        result = pipeline._upsert_structured_meeting(
            client,
            {"id": "doc-4", "project_id": 1009, "title": "Weekly Design Sync"},
        )

        assert result is not None
        assert result["number"] == 3  # retried after the injected unique violation
        assert len(client.meetings.inserted) == 1

    def test_exception_inside_helper_does_not_propagate(self):
        class _ExplodingClient:
            def table(self, _name):
                raise RuntimeError("boom: table lookup exploded")

        pipeline = _new_pipeline()

        result = pipeline._upsert_structured_meeting(
            _ExplodingClient(), {"id": "doc-5", "project_id": 1009, "title": "Weekly Design Sync"}
        )

        assert result is None

    def test_retry_exhausted_both_inserts_fail_with_unique_violation(self):
        """Regression: when both initial insert and retry insert hit unique
        violations, the helper must return None (containment) without raising.
        This prevents retry loops from ever cycling beyond the single retry."""
        client = _FakeStructuredMeetingClient(
            meeting_rows=[
                {
                    "id": "meeting-1",
                    "project_id": 1009,
                    "series_id": "series-existing",
                    "number": 1,
                    "name": "Weekly Design Sync",
                    "transcript_document_id": "doc-old",
                }
            ],
            series_rows=[{"id": "series-existing", "project_id": 1009, "name": "Weekly Design Sync"}],
            fail_next_meeting_insert_with=_DuplicateKeyError(),
        )
        pipeline = _new_pipeline()

        # Inject a concurrent row BEFORE calling upsert (so it exists for
        # the first re-read max(number) call), then fail the retry insert too.
        client.meetings.rows.append(
            {
                "id": "concurrent-writer-1",
                "project_id": 1009,
                "series_id": "series-existing",
                "number": 2,
                "transcript_document_id": "doc-concurrent",
            }
        )

        original_insert = client.meetings.insert
        insert_attempts = {"count": 0}

        def _insert_always_fails(payload):
            insert_attempts["count"] += 1
            if client.meetings._fail_next_insert_with is not None:
                client.meetings._fail_next_insert_with = None  # consume it once
                raise _DuplicateKeyError()
            # Retry insert also fails
            raise _DuplicateKeyError()

        client.meetings.insert = _insert_always_fails

        # Should return None cleanly (containment) without raising, even when
        # both the initial insert and the retry insert fail.
        result = pipeline._upsert_structured_meeting(
            client,
            {"id": "doc-exhausted", "project_id": 1009, "title": "Weekly Design Sync"},
        )

        assert result is None
        # Exactly 2 insert attempts: the initial insert plus one retry — the
        # helper must not loop beyond a single retry.
        assert insert_attempts["count"] == 2


class TestStableContentHash:
    """The Fireflies sync is an hourly poll that re-fetches recent transcripts
    and re-runs the whole pipeline on each. The only thing stopping an unchanged
    meeting from being re-embedded + re-extracted (which mints duplicate insight
    cards) is the content-hash skip guard. The formatted markdown embeds
    presigned ``**Audio:**`` / ``**Video:**`` URLs whose signature token is
    regenerated on EVERY API fetch, so hashing the raw markdown made every hour
    look like new content — the loop that duplicated meeting risks. The hash
    must key on durable content only.
    """

    _BASE = """# Sprinkler Division Morning Huddle

**Fireflies ID:** ff-abc
**Date:** 2026-07-06
**Audio:** https://cdn.fireflies.ai/audio/x.mp3?sig=AAA&expires=1000
**Video:** https://cdn.fireflies.ai/video/x.mp4?sig=BBB&expires=1000
**Fireflies Link:** https://app.fireflies.ai/view/x

## Summary
Overview one.

## Transcript
[00:01] **Brandon**: We need to reorder sprinkler heads.
[00:05] **Jason**: The hazmat brackets are still unresolved.
"""

    # Same meeting, next hourly fetch: only the presigned media URL signatures
    # rotated. This is the exact churn that drove the re-extraction loop.
    _ROTATED_URLS = _BASE.replace("sig=AAA", "sig=ZZZ").replace(
        "expires=1000", "expires=9999"
    ).replace("sig=BBB", "sig=YYY")

    # A genuinely different meeting: the transcript body changed.
    _CHANGED_BODY = _BASE.replace(
        "The hazmat brackets are still unresolved.",
        "The hazmat brackets were sourced and installed.",
    )

    def test_rotated_media_urls_do_not_change_hash(self):
        assert (
            FirefliesIngestionPipeline._stable_content_hash(self._BASE)
            == FirefliesIngestionPipeline._stable_content_hash(self._ROTATED_URLS)
        )

    def test_changed_transcript_body_changes_hash(self):
        assert (
            FirefliesIngestionPipeline._stable_content_hash(self._BASE)
            != FirefliesIngestionPipeline._stable_content_hash(self._CHANGED_BODY)
        )

    def test_regenerated_summary_does_not_change_hash(self):
        # AI-summary fields are non-deterministically refined by Fireflies and
        # carry nothing the skip decision needs — they must not force reprocess.
        refined = self._BASE.replace("Overview one.", "A completely reworded overview.")
        assert (
            FirefliesIngestionPipeline._stable_content_hash(self._BASE)
            == FirefliesIngestionPipeline._stable_content_hash(refined)
        )


class TestEmptyDictSummaryHandling:
    """Fireflies returns absent summary sub-fields as an empty dict ``{}`` (not
    null). Storing that raw dict into the *text* columns action_items /
    bullet_points serialized to the literal 2-char string "{}", which is why
    149 of the last 150 meetings showed garbage instead of an empty field.
    These guard every layer of the fix.
    """

    def test_coerce_summary_text_drops_empty_containers_and_blanks(self):
        assert FirefliesIngestionPipeline._coerce_summary_text({}) is None
        assert FirefliesIngestionPipeline._coerce_summary_text([]) is None
        assert FirefliesIngestionPipeline._coerce_summary_text(None) is None
        assert FirefliesIngestionPipeline._coerce_summary_text("   ") is None

    def test_coerce_summary_text_keeps_real_text(self):
        assert (
            FirefliesIngestionPipeline._coerce_summary_text("  • point one  ")
            == "• point one"
        )

    def test_append_text_section_skips_empty_container_and_brace_junk(self):
        lines: list = []
        FirefliesIngestionPipeline._append_text_section(lines, "Bullet Gist", {})
        FirefliesIngestionPipeline._append_text_section(lines, "Bullet Gist", [])
        FirefliesIngestionPipeline._append_text_section(lines, "Bullet Gist", "{}")
        FirefliesIngestionPipeline._append_text_section(lines, "Bullet Gist", None)
        assert lines == []

    def test_append_text_section_writes_real_text(self):
        lines: list = []
        FirefliesIngestionPipeline._append_text_section(lines, "Overview", "A real overview.")
        assert lines == ["## Overview", "A real overview.", ""]

    def test_rich_metadata_bullet_points_is_none_for_empty_dict(self):
        # The exact shape Fireflies sends for a short meeting with no generated
        # summary: every sub-field is an empty dict rather than null.
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        transcript = {
            "summary": {
                "bullet_gist": {},
                "shorthand_bullet": {},
                "keywords": {},
                "action_items": {},
                "overview": "Some real overview text.",
            },
        }
        rich = pipeline._extract_fireflies_rich_metadata(transcript)
        # Before the fix this was the literal empty dict → stored as "{}".
        assert rich["bullet_points"] is None
        # Keywords ({} → None) is coerced too, proving the method ran to completion.
        assert "keywords" in rich and rich["keywords"] is None

    def test_rich_metadata_bullet_points_keeps_real_gist(self):
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        transcript = {
            "summary": {
                "bullet_gist": "☀️ Solar: proceed with 45 kW array.",
                "overview": "Overview.",
            },
        }
        rich = pipeline._extract_fireflies_rich_metadata(transcript)
        assert rich["bullet_points"] == "☀️ Solar: proceed with 45 kW array."


class TestDurationFromSentencesWhenApiUnderreports:
    """Fireflies sends a stub `duration` (0/1/2…) before processing finishes.
    A ~2-hour meeting was stored as duration_minutes=2 because the old guard
    (`duration_raw > 1`) trusted the stub. Duration must take the MAX of the
    API value and the last-sentence end_time so a low stub can't win.
    """

    def test_stub_api_duration_loses_to_sentence_length(self):
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        transcript = {
            "duration": 2,  # stub value that used to slip through (2 > 1)
            "sentences": [
                {"end_time": 60},
                {"end_time": 4650},  # 77.5 min → real length
            ],
        }
        rich = pipeline._extract_fireflies_rich_metadata(transcript)
        assert rich["duration_minutes"] == 78

    def test_accurate_api_duration_is_kept_when_larger(self):
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        transcript = {"duration": 60, "sentences": [{"end_time": 3600}]}
        rich = pipeline._extract_fireflies_rich_metadata(transcript)
        assert rich["duration_minutes"] == 60

    def test_no_signal_yields_none(self):
        pipeline = FirefliesIngestionPipeline.__new__(FirefliesIngestionPipeline)
        rich = pipeline._extract_fireflies_rich_metadata({"duration": 0, "sentences": []})
        assert rich["duration_minutes"] is None
