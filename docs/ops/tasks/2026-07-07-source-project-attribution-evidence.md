# Source Project Attribution Evidence

Status: In Progress
Owner: Codex
Linear: AAI-996
Linear URL: https://linear.app/megankharrison/issue/AAI-996/unify-source-project-attribution-evidence-for-teams-chunks
Started: 2026-07-07

## Objective

Make Teams, emails, meetings, and documents feed the same project-attribution engine with the best available source evidence, including embedded chunk text when `document_metadata.content` is blank.

## Scope

- Capture the live Teams attribution failure shape.
- Add a shared source attribution evidence helper.
- Use the helper in the source intelligence compiler.
- Use the helper in incremental communication project backfill.
- Add targeted regression tests.
- Verify live Teams attribution health/backfill after the change.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New attribution database schema.
- New LLM attribution model.
- Broad eval suite.
- Editing unrelated dirty checkout files.

## Checklist

- [x] Live Teams failure shape captured.
- [x] Existing shared `ProjectAssigner` inspected.
- [x] Shared attribution evidence helper implemented.
- [x] Compiler uses shared evidence helper.
- [x] Communication backfill uses shared evidence helper.
- [x] Targeted tests added.
- [x] Targeted tests pass.
- [x] Live Teams attribution/backfill verified.
- [x] Evidence section filled with command summaries.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Live Teams status before this slice:
  - Teams sync: `10/10 healthy`.
  - Teams vectorization: `7/7 healthy`, `3` terminal low-content rows excluded.
  - Teams graph conversation chunks: `healthy`; Teams DM chunks use `source_type='teams_dm'`.
  - Teams project assignment: `0/6 critical`.
  - Teams task extraction outcomes: `6/6`, currently `no_actionable_tasks`.
- Root cause:
  - The shared attribution engine exists as `ProjectAssigner.assign_project(...)`.
  - `project_inference.infer_project_id(...)` already routes Microsoft Graph sources through that engine.
  - Teams DM/day `document_metadata.content` can be blank while `document_chunks.text` contains the real message text and project signals.
  - Compiler and communication backfill currently pass metadata content/summary/overview, so the shared engine receives incomplete Teams evidence.
- Detection gap:
  - Existing tests cover the attribution engine itself but not source evidence assembly from RAG chunks.
- Prevention:
  - Added unit coverage proving source attribution can use chunk text when metadata content is blank.
  - Added unit coverage proving generic summaries do not suppress chunk text fallback.
  - Added unit coverage proving compiler project inference receives shared attribution evidence.
  - Added unit coverage proving incremental backfill can be scoped to Teams only.

## Implementation Evidence

- Added `backend/src/services/ingestion/source_project_attribution.py`.
  - Builds one attribution input shape for all sources: title, participants, content, and content source.
  - Uses raw `content` / `raw_text` first.
  - Falls back to `document_chunks.text` when raw document content is blank.
  - Appends `summary` / `overview` after raw/chunk text so generic summaries do not hide project phrases.
- Updated `backend/src/services/intelligence/compiler.py`.
  - Project inference now receives shared attribution evidence instead of directly reading `document.content`.
- Updated `backend/src/services/ingestion/communication_project_backfill.py`.
  - Backfill now uses shared attribution evidence.
  - Added optional `source_filter` and `categories` parameters so live repairs can be scoped.
- Added targeted attribution rules:
  - `current bidding status for Union Collective` -> project `1009`.
  - `EIFS samples for Union Collective` -> project `1009`.
  - `Exol PA Phase 2` -> project `876`.
- Targeted tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_project_attribution.py backend/tests/test_communication_project_backfill.py backend/tests/test_intelligence_compiler.py::test_process_source_document_uses_shared_attribution_evidence backend/tests/test_project_assignment.py -q`
  - Result: `18 passed`.
- Live scoped Teams backfill:
  - Command: `run_incremental_project_backfill(..., source_filter='microsoft_graph', categories=['teams_message'], since=2026-07-06, min_confidence=0.70)`.
  - Result: `scanned=10`, `assigned=3`, `skipped_low_confidence=7`, `failed=0`, methods `{'attribution_rule:phrase': 3}`.
- Live Teams health after backfill:
  - Synced: `10/10 healthy`.
  - Vectorized: `7/7 healthy`, `3` terminal low-content rows excluded.
  - Project assigned: `3/6 warning`, `4` excluded.
  - Tasks extracted: `6/6 healthy`, `4` excluded.
  - Project intelligence updated: `3/3 healthy`, `4` excluded.
  - Graph conversation chunks: `healthy`.

## Notes

- This is an evidence-plumbing fix. It keeps the shared attribution engine as the single scoring authority.
- Remaining Teams project-assignment warning is expected until the other three project-required rows are either assigned by new curated rules or marked review/not-project after human-quality evidence review.
