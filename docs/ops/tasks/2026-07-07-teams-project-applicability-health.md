# Teams Project Applicability Health

Status: In Progress
Owner: Codex
Linear: AAI-994
Linear URL: https://linear.app/megankharrison/issue/AAI-994/stop-false-teams-project-assignment-criticals-in-rag-health
Started: 2026-07-07

## Objective

Stop scheduled source/RAG health from raising false Teams project-assignment criticals for empty/anonymized Teams conversation documents, while preserving fail-loud alerts for Teams rows with project signals or explicit project-required metadata.

## Scope

- Capture the current live Teams project-assignment failure shape.
- Inspect existing lifecycle project-applicability rules.
- Add scheduled-health classification for Teams blank/anonymized/internal/no-content rows.
- Preserve explicit source-processing/source-intelligence metadata precedence.
- Add targeted unit coverage.
- Verify targeted tests and live health output.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New database schema or migrations.
- Broad Graph sync architecture changes.
- Reassigning real Teams project conversations.
- Editing unrelated dirty checkout files.

## Checklist

- [x] Current live Teams failure shape captured.
- [x] Existing lifecycle classifier inspected.
- [x] Health project-required classification implemented.
- [x] Targeted unit coverage added.
- [x] Targeted tests pass.
- [x] Live scheduled health output verified.
- [x] Evidence section filled with command summaries.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Current live scheduled health symptom:
  - Teams project assignment remained `0/7 critical` after source-intelligence outcome handling was fixed.
- Live row inspection:
  - Recent unassigned Teams docs are Teams DM/day conversations.
  - Sample titles include anonymized `Teams DM Conversation: 19:...`, `Teams DM Conversation: Indiana Office`, and `Teams DM Conversation: Printing Checks`.
  - `document_metadata.content` is empty for the inspected rows.
  - Follow-up direct chunk inspection showed embedded `document_chunks.text` contains usable Teams message text for chunked rows, including project signals such as Exol PA Phase 2, Union Collective, drawings, pricing, and guardrails.
  - Several rows are terminal `skipped_low_content`.
  - `source_intelligence_jobs.output_summary.task_extraction_status` is `no_actionable_tasks`.
  - No `document_attribution_candidates` exist for inspected rows.
- Root cause:
  - `backend/src/services/health/source_rag_health.py` defaults unassigned rows to project-required when no stored `project_required`/`project_applicability` metadata exists.
  - The JS lifecycle classifier already excludes empty anonymized Teams threads and low-content rows, but scheduled Python health did not apply that fallback classification.
  - The first Python fallback used only `document_metadata.content`, which is blank for Teams DM/day rows even when embedded chunk text exists.
- Detection gap:
  - Scheduled health did not test Teams blank/anonymized project applicability or the chunk-text fallback path, so false criticals and false exclusions could recur daily.
- Prevention:
  - Added unit tests that empty Teams DM/day docs are excluded from project assignment health unless explicit metadata requires review, and that project-signal Teams content remains project-required.
- Implemented:
  - `backend/src/services/health/source_rag_health.py` now includes a Python project-applicability fallback classifier for scheduled health.
  - Existing stored `project_required` and `project_applicability` metadata still takes precedence.
  - The health app-source query now includes `document_metadata.content`.
  - The health chunk query now includes `document_chunks.text` and enriches source rows with embedded chunk text when metadata content is blank.
- Unit tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_rag_health.py -q`
  - Result: `10 passed, 6 warnings`.
- Live scheduled health after fix:
  - Overall remains `degraded`.
  - `graphConversationChunks` remains `healthy`.
  - Teams sync is healthy: `10/10`.
  - Teams vectorization remains healthy: `7/7`, with `3` terminal low-content rows excluded.
  - Teams project assignment is still a real critical: `0/6`, with `4` non-project/low-content rows excluded.
  - Teams task extraction has outcomes for the project-required rows: `6/6`.
  - Teams project intelligence remains `unknown 0/0` because no recent Teams rows have project assignment yet.
  - Remaining real criticals: Meeting project intelligence `0/3`; SharePoint project intelligence `0/5`.
  - Remaining warnings: Meeting project assignment/tasks `3/6`; Emails project assignment `67/232`, tasks `131/232`, project intelligence `40/67`; SharePoint project assignment `5/68`, tasks `63/68`.

## Notes

- This is a health classification fix, not a sync bypass. Real Teams conversations with content/project signals should still fail loudly until assigned or reviewed.
