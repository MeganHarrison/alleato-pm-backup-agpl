# Source RAG Top-Level Backlog

Status: Complete
Owner: Codex
Linear: AAI-1006
Linear URL: https://linear.app/megankharrison/issue/AAI-1006/clear-remaining-top-level-sourcerag-backlog-counters
Started: 2026-07-07

## Objective

Clear the remaining top-level source/RAG degraded status after the lifecycle matrix is healthy by repairing active backlog or excluding retired/historical counters with evidence.

## Scope

- Capture exact rows behind the embedding backlog, compiler backlog, and retired packet-refresh failures.
- Repair active backlog where safe.
- Update health read-model only where counters are stale, retired, or inconsistent with current architecture.
- Add targeted tests for any health read-model change.
- Verify live top-level source/RAG health movement.
- Push task-owned files to `origin/main`.

## Out Of Scope

- New embedding model or vector schema changes.
- PM APP projection policy changes.
- Broad historical reprocessing without row evidence.
- Touching unrelated dirty frontend or orchestration work.

## Checklist

- [x] Linear issue created.
- [x] Live backlog rows captured.
- [x] Root cause classified for each counter.
- [x] Repair or read-model fix implemented.
- [x] Targeted tests added or updated.
- [x] Targeted tests pass.
- [x] Live top-level health verified.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Initial live top-level warnings after lifecycle fix:
  - `embedding_backlog`: 353 ingested documents do not have chunks yet.
  - `compiler_backlog`: 279 compiler jobs are queued, running, or failed.
  - `packet_refresh_failed`: 8 packet refresh jobs failed.
- Initial lifecycle state:
  - `ragLifecycle.status = healthy`.
  - No lifecycle alerts.
- Root cause classification:
  - Embedding backlog was a mix of real chunk drift and health read-model undercount. `document_chunks` lookups used 100 long Graph/Teams IDs per `IN` request; live proof showed batch `100` missed 53 chunked docs, while batch `25` reduced missing docs to 1 oversized `codex_training_doc`.
  - Compiler backlog was retired `ai_intelligence_compiler_v0_1` source-intelligence job noise: 259 old queued attribution rows and 20 old failed RLS rows. Active source jobs are now counted separately from raw retired rows.
  - Packet refresh failed was retired direct packet-refresh noise: 8 old failed `ai_intelligence_compiler_v0_1` jobs with no trigger source/card IDs. Active packet jobs are now counted separately from raw retired rows.
  - RAG watchdog status inherited unrelated `acumatica_financial_sync` degradation from source-sync health. The watchdog now passes/fails on watched RAG sources, watched alerts, and lifecycle alerts only.
- Live data repair:
  - Re-embedded 53 missing-chunk candidates through `embed_graph_document()`.
  - Wrote 107 chunks across Teams DM daily conversations, Outlook messages/attachments, and drawing uploads.
  - One oversized `codex_training_doc` failed provider token limits (`maximum request size is 300000 tokens per request`); it remains visible as `unembedded=1`, below the RAG warning threshold and outside watched source families.
  - Ran source compiler for 9 repaired Outlook attachments. PM final projection correctly failed closed under `ALLOW_PM_APP_FINAL_PROJECTIONS=false`, but each run wrote a succeeded `source_syntheses` row, satisfying project-intelligence lifecycle health.
- Final targeted tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_sync_health.py backend/tests/test_source_rag_health.py -q`
  - Result: `39 passed in 0.06s`.
- Final live verification:
  - `RAG_STATUS healthy passed True`
  - `RAG_WARNINGS []`
  - `RAG_CRITICAL []`
  - `RAG_UNHEALTHY_SOURCES []`
  - `RAG_LIFECYCLE healthy []`
  - Lifecycle family proof:
    - Meetings: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all healthy.
    - Teams: synced/vectorized/project_assigned/tasks_extracted/project_intelligence all healthy.
    - Emails: synced `258/258`, vectorized `232/232`, project_assigned `217/217`, tasks_extracted `46/46`, project_intelligence_updated `76/76`, all healthy.
    - SharePoint: synced `70/70`, vectorized `68/68`, project_assigned `42/42`, tasks_extracted `5/5`, project_intelligence_updated `5/5`, all healthy.
- Remaining non-RAG source-sync state:
  - `SOURCE_SYNC_STATUS degraded` only because `acumatica_financial_sync` still has the Payment.ApplicationHistory endpoint/GI issue.
  - RAG source-sync counters after repair: `unembedded=2` (`teams_chat_export=1`, `codex_training_doc=1`) with no RAG warning because this is below threshold and lifecycle is healthy.

## Notes

- The goal is not to hide active work. Retired/stale counters can be excluded only when row evidence proves the current architecture no longer consumes them.
