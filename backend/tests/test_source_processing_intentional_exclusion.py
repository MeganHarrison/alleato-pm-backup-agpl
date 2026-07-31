"""Guardrail: intentional exclusions are a terminal, non-failure ledger status.

Interview-title and low-content documents are deliberately not embedded. They
must be recorded as `intentionally_excluded` (terminal, completed_at stamped),
NOT `failed_permanent` — otherwise the source-sync health map / /pipeline-health
renders correct skips as critical pipeline errors.
"""

from src.services.pipeline import source_processing as sp
from src.services.pipeline.source_processing import (
    FINAL_STATUSES,
    INTENTIONALLY_EXCLUDED_STATUS,
    SourceProcessingContext,
    record_source_processing_status,
)


class _Capture:
    """Minimal fake RAG write client capturing the upserted payload."""

    def __init__(self):
        self.payload = None

    def table(self, _name):
        return self

    def upsert(self, payload, **_kwargs):
        self.payload = payload
        return self

    def execute(self):
        return None


def test_intentionally_excluded_is_a_terminal_status():
    assert INTENTIONALLY_EXCLUDED_STATUS == "intentionally_excluded"
    assert INTENTIONALLY_EXCLUDED_STATUS in FINAL_STATUSES


def test_intentional_exclusion_stamps_completed_at_and_is_not_a_failure(monkeypatch):
    capture = _Capture()
    monkeypatch.setattr(sp, "get_rag_write_client", lambda: capture)

    record_source_processing_status(
        SourceProcessingContext(source_system="fireflies", source_item_id="ff-123"),
        status=INTENTIONALLY_EXCLUDED_STATUS,
        error_code="interview_title_excluded",
        error_message="INTENTIONALLY_EXCLUDED: interview title.",
    )

    assert capture.payload is not None
    assert capture.payload["status"] == "intentionally_excluded"
    # Terminal -> completed_at is stamped, exactly like complete / failed_permanent.
    assert capture.payload["completed_at"] is not None
    # It is NOT a retryable failure, so no retry_count is injected.
    assert "retry_count" not in capture.payload
    # The reason is retained for traceability, but the status is not a failure.
    assert not capture.payload["status"].startswith("failed")
