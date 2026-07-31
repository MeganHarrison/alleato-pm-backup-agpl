# Communication Attribution Review Fallback

Status: Complete
Owner: Codex
Linear: AAI-1008
Linear URL: https://linear.app/megankharrison/issue/AAI-1008/fail-loud-when-communication-project-attribution-is-unresolved
Started: 2026-07-07

## Objective

Make unresolved project attribution for synced communication sources fail loudly into review instead of remaining a daily RAG lifecycle warning.

## Scope

- Capture the live warning shape from today's RAG lifecycle verification.
- Update the shared communication project backfill so low-confidence/unassigned rows write `document_attribution_candidates.status='pending_review'`.
- Preserve existing high-confidence auto-assignment behavior.
- Add targeted regression tests.
- Verify today's emails, meetings, and Teams sources remain synced/vectorized and the unresolved meeting is explicitly staged for review.
- Push task-owned files to `origin/main`.

## Out Of Scope

- Guessing a project assignment without strong evidence.
- New attribution schema.
- Broad historical source review cleanup.
- UI work for reviewing attribution candidates.

## Checklist

- [x] Live warning row captured.
- [x] Shared backfill writes pending review for unresolved attribution.
- [x] Existing auto-assignment behavior remains covered.
- [x] Targeted tests pass.
- [x] Live RAG lifecycle warning is cleared or reduced to explicit review state.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Initial live RAG verification after vector repair:
  - Emails: `179/179` vector-required items vectorized, `0` missing.
  - Meetings: `7/7` vector-required items vectorized, `0` missing.
  - Teams: `8/8` vector-required items vectorized, `0` missing.
  - Remaining warning: meetings project attribution `6/7`.
- Warning row:
  - `document_metadata.id='01KWYH9PT6VBXM86EZFD9Q7FYA'`.
  - Title: `Bob Wright Review`.
  - Source/category: Fireflies meeting.
  - Vectorized with one `meeting_transcript` chunk after repair.
  - `project_id` is null and no attribution review candidate existed.
- Root cause:
  - Shared project attribution exists, but `run_incremental_project_backfill()` increments `skipped_low_confidence` and continues when no confident project match is found.
  - That leaves newly synced ambiguous communications as project-assignment lifecycle warnings until a separate manual/backfill process stages review.
- Prevention target:
  - The shared backfill must write one deterministic pending-review attribution candidate for unresolved source rows so health can distinguish "needs review" from "pipeline missed this."

## Implementation Evidence

- Updated `backend/src/services/ingestion/communication_project_backfill.py`.
  - Low-confidence or unassigned communication rows now write `document_attribution_candidates.status='pending_review'`.
  - The review row uses `attribution_method='review_required:communication_project_backfill'`.
  - The backfill result now includes `review_staged` so operations can distinguish auto-assignment from explicit review routing.
  - High-confidence assignment behavior is unchanged.
- Updated `backend/tests/test_communication_project_backfill.py`.
  - Added regression coverage for unresolved attribution becoming pending review.
  - Added regression coverage proving high-confidence auto-assignment still updates `document_metadata.project_id` and does not create a pending-review row.
- Targeted test evidence:
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_communication_project_backfill.py -q`
  - Result: `3 passed in 0.18s`.
  - `PYTHONPATH=backend /opt/homebrew/opt/python@3.13/libexec/bin/python3 -m pytest backend/tests/test_source_project_attribution.py backend/tests/test_communication_project_backfill.py backend/tests/test_intelligence_compiler.py::test_process_source_document_uses_shared_attribution_evidence backend/tests/test_project_assignment.py backend/tests/test_source_rag_health.py -q`
  - Result: `38 passed in 0.32s`.
- Live backfill evidence:
  - Window: `2026-07-07T04:00:00+00:00` onward.
  - Result: `scanned=4`, `assigned=0`, `skipped_low_confidence=4`, `review_staged=4`, `failed=0`.
- Live health evidence:
  - `run_source_rag_health_check(trigger_remediation=False)` returned no warnings and no critical alerts after review staging.
  - `Bob Wright Review` now has `document_attribution_candidates.status='pending_review'`, `candidate_project_id=NULL`, and `attribution_method='review_required:communication_project_backfill'`.
- Final today vectorization readback:
  - Emails: `129` synced today, `128/128` vector-required rows vectorized, `0` missing.
  - Meetings: `7` synced today, `7/7` vector-required rows vectorized, `0` missing.
  - Teams: `10` synced today, `8/8` vector-required rows vectorized, `0` missing.
- Publish evidence:
  - `npm run codex:finish -- --message "Fail loud on unresolved communication attribution" --files backend/src/services/ingestion/communication_project_backfill.py backend/tests/test_communication_project_backfill.py docs/ops/tasks/2026-07-07-communication-attribution-review-fallback.md`
  - Result: published task-owned files to `origin/main` at `05d02e664`.
