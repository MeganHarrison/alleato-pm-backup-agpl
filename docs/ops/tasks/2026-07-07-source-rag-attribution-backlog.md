# Source RAG Attribution Backlog

Status: Complete
Owner: Codex
Linear: AAI-1002
Linear URL: https://linear.app/megankharrison/issue/AAI-1002/clear-remaining-sourcerag-attribution-backlog-warnings
Started: 2026-07-07

## Objective

Clear the remaining source/RAG warning backlog by classifying exact unassigned or unprocessed rows as assignable, non-project/excludable, review-required, or task-extraction missing.

## Scope

- Capture exact live warning rows by source family.
- Reuse the shared source project attribution evidence path where assignment is justified.
- Ensure ambiguous rows land in review instead of remaining invisible backlog.
- Preserve fail-loud health semantics.
- Add targeted tests and live health proof.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New embedding model or chunking changes.
- Broad unrelated frontend/dashboard work.
- Manual project assignment without row evidence.
- Suppressing real source/RAG failures.

## Checklist

- [x] Linear issue created.
- [x] Live warning rows captured.
- [x] Root cause classified by source family.
- [x] Durable code/data repair implemented.
- [x] Targeted tests added or updated.
- [x] Targeted tests pass.
- [x] Live health movement verified.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Initial live source/RAG health after Meeting/SharePoint project-intelligence fix:
  - Meetings: project assignment `3/6 warning`, task extraction `3/6 warning`.
  - Teams: project assignment `3/6 warning`.
  - Emails: project assignment `69/218 warning`, task extraction `129/218 warning`.
  - SharePoint: project assignment `5/42 warning`, task extraction `37/42 warning`.
  - Project-intelligence stages are healthy for assigned rows.
- Root cause:
  - Compiler-owned attribution candidates were not persisted when no candidate project was found because `write_document_attribution_candidate()` returned early for `candidate_project_id = NULL`.
  - Source/RAG health treated pending-review attribution rows as unhandled project-assignment gaps.
  - Task health counted review-required rows and RAG-only Outlook rows even though they cannot produce normal app `tasks.metadata_id` rows until assigned/app-backed.
  - Older succeeded `source_syntheses` rows carried deterministic signal metadata but health was not deriving task/no-actionable outcomes from that durable synthesis output.
- Live repair:
  - Inserted `189` pending-review attribution rows into `document_attribution_candidates` using `attribution_method='review_required:source_rag_health_backfill'`.
  - Inserted rows by family: Emails `149`, Meetings `3`, SharePoint `37`.
- Targeted tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_rag_health.py backend/tests/test_intelligence_compiler.py -q`
  - Result: `46 passed in 0.22s`.
- Live source/RAG lifecycle after fix:
  - Meetings: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all `healthy`; project assignment `6/6`, review-required `3`.
  - Teams: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all `healthy`; project assignment `6/6`, review-required `3`.
  - Emails: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all `healthy`; project assignment `218/218`, task extraction `53/53`, review-required `149`.
  - SharePoint: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all `healthy`; project assignment `42/42`, task extraction `5/5`, review-required `37`.
  - `graphConversationChunks`: `healthy`.
- Remaining outside this task:
  - Top-level source health still reports `degraded` because older backlog counters remain: embedding backlog `353`, compiler backlog `279`, failed retired packet refresh jobs `8`.

## Notes

- The right closeout is not necessarily `100% assigned`; non-project rows should be explicitly excluded, ambiguous rows should be review-required, and source health should continue to warn on real actionable gaps.
