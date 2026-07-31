# Source Intelligence Health Outcomes

Status: Complete
Owner: Codex
Linear: AAI-993
Linear URL: https://linear.app/megankharrison/issue/AAI-993/use-source-intelligence-outcomes-in-scheduled-rag-lifecycle-health
Started: 2026-07-07

## Objective

Make scheduled source/RAG lifecycle health count completed source intelligence outcomes so docs classified as `no_actionable_tasks` do not appear as task-extraction failures.

## Scope

- Verify the current scheduled health failure shape.
- Update health metadata loading to include `source_intelligence_jobs.output_summary`.
- Preserve explicit `source_processing_jobs.metadata.task_extraction_status` precedence.
- Add targeted unit coverage.
- Verify live scheduled health output after the change.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New schema or migrations.
- Broad eval suite runs.
- Editing unrelated dirty checkout files.

## Checklist

- [x] Current health failure shape captured.
- [x] Existing compiler outcome contract inspected.
- [x] Health metadata merge implemented.
- [x] Targeted unit coverage added.
- [x] Targeted tests pass.
- [x] Live scheduled health output verified.
- [x] Evidence section filled with command summaries.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Current live scheduled health:
  - Emails task extraction: `0/233`, critical.
  - Teams task extraction: `0/7`, critical.
  - SharePoint task extraction: `0/68`, critical.
- Root cause:
  - `source_intelligence_jobs` has `225` recent succeeded rows with `output_summary.task_extraction_status='no_actionable_tasks'`.
  - `backend/src/services/health/source_rag_health.py` only reads `source_processing_jobs.metadata`, so those completed compiler outcomes are invisible to scheduled health.
- Implemented:
  - `backend/src/services/health/source_rag_health.py` now merges succeeded `source_intelligence_jobs.output_summary` into the lifecycle metadata map used by scheduled health.
  - Explicit task-extraction metadata wins over newer generic embedding metadata.
  - Project-intelligence health now evaluates project-assigned rows instead of every source awaiting attribution.
  - Project-intelligence health counts source synthesis, signal candidate, packet refresh, packet id, and evidence rows as intelligence-processing outcomes.
- Unit tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_rag_health.py -q`
  - Result: `5 passed, 6 warnings`.
- Live scheduled health check after fix:
  - `run_source_rag_health_check(trigger_remediation=False)` still returns overall `degraded`, but the false task-extraction criticals are gone.
  - Teams task extraction improved from `0/7 critical` to `7/7 healthy`.
  - Emails task extraction improved from `0/233 critical` to `131/233 warning`.
  - SharePoint task extraction improved from `0/68 critical` to `63/68 warning`.
  - Emails project intelligence improved from `0/233 critical` to `40/67 warning`.
  - Teams project intelligence now has denominator `0` because no recent Teams rows are project assigned yet; the real critical is Teams project assignment `0/7`.
- Remaining real issues:
  - Teams project assignment is still `0/7 critical`.
  - Meeting project intelligence is still `0/3 critical`.
  - SharePoint project intelligence is still `0/5 critical`.
  - Existing backlog warnings remain: embedding backlog `364`, compiler backlog `279`, packet refresh failed `8`.
- Detection gap:
  - Scheduled health read one lifecycle ledger but ignored the compiler outcome ledger that already contains task/no-actionable decisions.
- Prevention:
  - Test coverage now asserts source-intelligence outcome metadata beats generic embedding metadata for task-extraction health.

## Notes

- This is a health read-model fix. It does not mark unprocessed rows as healthy and does not create tasks or intelligence artifacts.
