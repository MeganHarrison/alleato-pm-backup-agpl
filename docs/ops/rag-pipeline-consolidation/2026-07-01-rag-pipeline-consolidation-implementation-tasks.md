# Task: RAG pipeline consolidation implementation

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-848 - https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover

## Related Links

- Architecture proposal: [2026-07-01-rag-pipeline-consolidation-architecture-proposal.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md)
- Proposal task doc: [2026-07-01-rag-pipeline-consolidation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-tasks.md)
- Fireflies ownership map: [2026-07-01-fireflies-current-ownership-map.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-fireflies-current-ownership-map.md)
- Microsoft Graph ownership map: [2026-07-01-microsoft-graph-current-ownership-map.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-microsoft-graph-current-ownership-map.md)
- Linear issue: [AAI-848](https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover)
- Current production architecture baseline: [AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md](/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md)

## Objective

Implement the consolidation plan in a sequence that shows fast, visible progress without leaving parallel runtime paths alive in the repository.

## Implementation Rules

- Migrate one workflow boundary at a time, not scattered helpers.
- A source family is not complete until the old path is deleted from the main repo.
- Do not keep archived or disabled duplicate implementations in the main repo.
- Every implementation slice must have live proof, deletion proof, and operator visibility proof.

## Active Ownership

- Main thread (Codex): complete the direct `run_graph_sync.py` ownership cutover and prove the live Graph cron runs only through the direct script owner.
- Main thread (Codex): repair and prove the Outlook intake AI DB credential boundary after the first direct Graph sync live run exposed `outlook_email_intake` RLS drift.
- Main thread (Codex): keep operator/reporting and implementation records current for every consolidation slice.
- Sub-agent A (`019f1eb9-b488-7ee3-9bc3-753a874d40c9`): completed read-only mapping of current frontend/admin review surfaces and exact files to change for fast human-readable Fireflies status/task feedback.
- Sub-agent B (`019f1eb9-d0cc-7961-a8e3-fe81bd275af0`): completed cheap verification/debt sweep for the current Fireflies cutover slice, including narrow compile/test blockers and residual old-path references.
- Sub-agent C (`019f1ecf-d14d-7d72-aeeb-84af20371842`): completed read-only sweep that isolated the last live inline Fireflies task-write references before deletion.
- Sub-agent D (`019f1ed6-6f13-7341-a449-19a109b6c050`): completed read-only mapping of Microsoft Graph-derived source-family ownership and duplicate downstream Outlook/Graph paths for the next cutover slice.
- Sub-agent E (`019f1edd-e3c7-72b0-a6d2-1064f6370b3b`): completed read-only comparison of Outlook direct attachment writes versus attachment-promotion behavior, including existing test coverage and remaining parity blockers.
- Sub-agent F (`019f1eef-6f4c-7572-bcbb-7c5d80ce60f5`): completed read-only mapping of the next Graph cleanup boundary and confirmed the smallest safe delete set is the scheduler-owned Graph embedding and Outlook attachment-promotion jobs.
- Sub-agent G (`019f1ef8-5fb5-7461-ba06-4edab9900bdc`): monitoring the live resumed Render `alleato-graph-sync` cron run and will report only final status plus concise key log lines.
- No sub-agent is currently assigned to the active Teams direct-owner cutover slice; the main thread is executing the code delete, Render update, and live proof end to end.

## Sub-Agent Log

- 2026-07-01 17:22 ET: Assigned Sub-agent A (`019f1eb9-b488-7ee3-9bc3-753a874d40c9`) to map Fireflies operator/reporting and task-review surfaces with exact file ownership recommendations.
- 2026-07-01 17:22 ET: Assigned Sub-agent B (`019f1eb9-d0cc-7961-a8e3-fe81bd275af0`) to run a cheap verification/debt sweep for the Fireflies cutover and report only concrete blockers.
- 2026-07-01 17:27 ET: Sub-agent B (`019f1eb9-d0cc-7961-a8e3-fe81bd275af0`) reported no narrow compile/import blockers in the active Fireflies cutover files. It flagged one real Fireflies inconsistency (`backend/scripts/reprocess_recent_fireflies_tasks.py`) and one broader shared-helper debt (`frontend/src/lib/documents/pipeline-trigger.ts` still points at `/api/pipeline/process` for generic non-Fireflies document ingest flows).
- 2026-07-01 17:30 ET: Sub-agent A (`019f1eb9-b488-7ee3-9bc3-753a874d40c9`) confirmed the operator-surface root cause: `/pipeline` was not a truthful Fireflies page because it used the default document-status view that excludes meetings, and it identified `/pipeline-health` as a redundant overlapping lifecycle surface.
- 2026-07-01 17:43 ET: Assigned Sub-agent C (`019f1ecf-d14d-7d72-aeeb-84af20371842`) to verify whether any active runtime/docs/tests still treat `FIREFLIES_REWRITE_TASKS_DURING_INGEST` or the inline Fireflies task writer as a live path after the assignment/task-extraction cutover.
- 2026-07-01 18:01 ET: Sub-agent C (`019f1ecf-d14d-7d72-aeeb-84af20371842`) confirmed the only remaining live debt was the inline Fireflies task-write branch in `backend/src/services/ingestion/fireflies_pipeline.py`, its supporting helper in `backend/src/services/supabase_helpers.py`, the cron kill-switch in `render.yaml`, the matching blueprint test, and the architecture note describing that disabled path.
- 2026-07-01 18:15 ET: Assigned Sub-agent D (`019f1ed6-6f13-7341-a449-19a109b6c050`) to map Microsoft Graph-derived communications/documents runtime ownership and identify the best next source-family cutover boundary after Fireflies.
- 2026-07-01 18:21 ET: Sub-agent D (`019f1ed6-6f13-7341-a449-19a109b6c050`) reported that the highest-value next Graph cutover is Outlook downstream ownership after intake persistence: keep fetch in `sync_outlook_emails(...)`, make `attachment_promotion.py` the only attachment-to-document owner, keep `embed.py` as the only vectorization owner, and keep `project_synthesizer.py` as the only project/task/card owner while removing competing inline source hooks.
- 2026-07-01 18:31 ET: Assigned Sub-agent E (`019f1edd-e3c7-72b0-a6d2-1064f6370b3b`) to compare `outlook.py::_sync_email_attachment(...)` against `attachment_promotion.py::_promote_attachment(...)` and isolate the exact parity gap plus existing test coverage before code deletion begins.
- 2026-07-01 18:38 ET: Sub-agent E (`019f1edd-e3c7-72b0-a6d2-1064f6370b3b`) confirmed the highest-risk Outlook parity gaps before deletion were storage/file access, text extraction, late project-assignment recovery, and missing direct test coverage. It also confirmed remaining blockers still include promotion-scope differences and missing content-hash dedupe parity.
- 2026-07-01 18:28 ET: Assigned Sub-agent F (`019f1eef-6f4c-7572-bcbb-7c5d80ce60f5`) to isolate the next Microsoft Graph consolidation boundary after the Outlook downstream cutover, limited to scheduler/admin/manual wrapper surfaces.
- 2026-07-01 18:31 ET: Sub-agent F (`019f1eef-6f4c-7572-bcbb-7c5d80ce60f5`) confirmed the smallest safe next delete set is the scheduler-owned `graph_embedding` and `outlook_attachment_promotion` jobs in `backend/src/services/scheduler.py`; it recommended leaving FastAPI manual triggers and the daily synthesis backstop alone for now.
- 2026-07-01 18:39 ET: Assigned Sub-agent G (`019f1ef8-5fb5-7461-ba06-4edab9900bdc`) to monitor the live resumed Render `alleato-graph-sync` cron and return final run status/log signal without blocking the main thread.
- 2026-07-01 19:28 ET: Main thread advanced to the next direct Graph owner boundary: `backend/scripts/run_graph_sync.py` is now the canonical cron owner and the former scheduler-owned `graph_sync` wrapper path has been deleted.
- 2026-07-01 19:29 ET: First live direct Graph cron run proved the new owner executed, but failed on AI DB intake writes with `42501 row-level security` against `outlook_email_intake`, isolating the next blocker to the Outlook intake credential boundary rather than scheduler ownership.
- 2026-07-01 19:35 ET: Main thread refreshed the live Render `alleato-graph-sync` cron Supabase/RAG env vars from the known-good local secure source and added an Outlook intake fail-loud guardrail so future RLS drift names the exact bad boundary instead of surfacing an opaque PostgREST error.
- 2026-07-01 19:47 ET: Main thread proved the Outlook intake auth boundary was repaired on the next `alleato-graph-sync` run after deploy `dep-d92mlnrtqb8s73cvhip0` by reading fresh `outlook_email_intake` rows written after the run start timestamp `2026-07-01T19:31:53Z`.
- 2026-07-01 19:49 ET: With the auth blocker cleared, the next live runtime issue narrowed to transient SharePoint file-download `503 Service Unavailable` failures, so the main thread started hardening the shared Graph download client with bounded retry behavior.
- 2026-07-01 20:00 ET: Main thread proved the direct Graph cron slice cleanly on live Render: `alleato-graph-sync` finished successfully at `2026-07-01T19:52:48Z` with `total_synced=34`, `errors=[]`, fresh Outlook intake rows, and bounded SharePoint `503` retries.
- 2026-07-01 20:02 ET: Main thread advanced to the next remaining Graph duplicate-owner seam, `graph_subscription_reconcile`, changed the live Render cron to the existing direct script entrypoint, and deleted the scheduler-owned wrapper path in repo code.
- 2026-07-01 20:05 ET: Main thread pulled the direct `alleato-graph-subscription-reconcile` rerun logs after env repair and proved the live direct owner finished successfully with `checked=11`, `failed=0`, and no stale removals.
- 2026-07-01 20:16 ET: Main thread advanced to the next Graph ownership seam: replacing the generic phase-based Teams cron runner with named direct entrypoints for Teams channel sync and Teams DM sync, then deleting the old phase runner from the live path.
- 2026-07-01 20:18 ET: Main thread patched both live Teams cron services to the new direct commands, found both services were still provider-suspended, resumed them, and forced deploys for commit `c097f2274b3b15bc6cfd104ce8a46fcfe0bfb471` before off-schedule run proof.
- 2026-07-01 20:19 ET: First off-schedule Teams proof on the new commit failed immediately in both services with `ModuleNotFoundError: No module named 'scripts.graph_sync_common'`, which exposed that the cron container executes from `/app/scripts` without `scripts` as an importable package.
- 2026-07-01 20:21 ET: Main thread fixed the import path to `from graph_sync_common import ...`, pushed commit `f64e31cb57037bbe10c90b2e324b47bf2440e91d`, and forced fresh deploys for `alleato-teams-channel-sync`, `alleato-teams-dm-sync`, and `alleato-graph-sync` so the full Graph family is not left on a broken import boundary.
- 2026-07-01 20:26 ET: Main thread proved `alleato-teams-channel-sync` on the new direct script plus repaired RAG env. The rerun finished successfully at `2026-07-01T20:26:18Z` with `teams=1`, `errors=[]`, and all downstream phases explicitly skipped by design.
- 2026-07-01 20:28 ET: Main thread found one more live Teams DM config drift during proof: Render still had `TEAMS_DM_SYNC_MAX_USERS=10` while the repo blueprint requires `1`. The env var was corrected live and a bounded follow-up deploy `dep-d92nhscvikkc73aq7900` was started so the final DM proof matches repo truth.
- 2026-07-01 20:32 ET: Main thread proved the bounded `alleato-teams-dm-sync` rerun on the corrected env. It finished successfully at `2026-07-01T20:32:09Z` with `teams_dm=0`, `errors=[]`, and downstream phases explicitly skipped by design.
- 2026-07-01 20:35 ET: Main thread advanced the observability seam: `alleato-source-sync-health` was still live on an inline `python -c` command, still suspended, and still provider-configured with `APP_DB_PRESSURE_GUARD_REQUIRED=false`.
- 2026-07-01 20:36 ET: Main thread patched the live `alleato-source-sync-health` service to `python3 scripts/run_source_sync_health_recompute.py`, set `APP_DB_PRESSURE_GUARD_REQUIRED=true`, resumed the service, and started deploy `dep-d92nkaa8qa3s73b9qvu0` for commit `f49c79d1ec7e5dd9dacc9670f8c8d8c49cf3558f`.

## Step-By-Step Tasks

### Phase 0: Packet and ownership setup

- [x] Create one shared folder for this workstream.
- [x] Create architecture proposal in that folder.
- [x] Create proposal task doc in that folder.
- [x] Create implementation task doc in that folder.
- [x] Create Linear implementation issue.
- [x] Add/update Linear comments as implementation progresses.

### Phase 1: Canonical cutover contract

- [x] Define the canonical lifecycle owner file/module for the new pipeline.
- [x] Define the canonical workflow input contract for document processing.
- [ ] Define the canonical per-document status ledger fields.
- [ ] Define the canonical retry/error contract.
- [ ] Define which existing status fields/tables remain source of truth.
- [ ] Define explicit “terminal but not failed” states such as intentional exclusion.
- [ ] Record the contract in a checked-in implementation note if it differs from the proposal.

### Phase 2: Fireflies current-state ownership map

- [x] Inventory every current Fireflies entrypoint.
- [x] Inventory every current Fireflies scheduler/backlog/replay path.
- [x] Inventory every current Fireflies parse/chunk/embed/project/task path.
- [x] Inventory every admin/manual Fireflies trigger.
- [x] Mark each path as keep, replace, or delete.
- [x] Record exact owner files for all Fireflies runtime paths.
- [x] Record exact delete candidates that must disappear after cutover.

### Phase 3: Fireflies new path design

- [x] Define the Fireflies ingress function boundary.
- [ ] Define the queue event payload for Fireflies intake.
- [ ] Define the canonical workflow stages for Fireflies intake through vectorization.
- [ ] Define where transcript materialization happens.
- [ ] Define where chunking/embedding state is written.
- [ ] Define what operator-visible status must update at each stage.
- [ ] Define the exact live proof for “searchable” after cutover.

### Phase 4: Operator visibility before deletion

- [x] Define the minimum operator console data needed for Fireflies cutover.
- [x] Add/adjust the pipeline run view so Fireflies shows the canonical workflow status.
- [ ] Add/adjust the document lifecycle detail so a Fireflies meeting can be inspected end to end.
- [x] Ensure the operator can see sync, chunk, embed, and failure state without manual table inspection.
- [x] Ensure errors are human-readable and source-specific.

### Phase 5: Fireflies intake-to-vectorization cutover

- [x] Implement the Fireflies ingress path on the new orchestration model.
- [ ] Implement the Fireflies canonical workflow through transcript materialization.
- [x] Implement chunking and embedding within the same canonical Fireflies path.
- [x] Update status ledger writes to reflect the new owner.
- [ ] Disable the superseded Fireflies runtime owner once the new path is ready for proof.

### Phase 6: Fireflies live proof

- [ ] Trigger a fresh Fireflies record through the new path.
- [ ] Verify transcript materialization for that exact record.
- [ ] Verify chunk creation for that exact record.
- [ ] Verify embedding/searchability for that exact record.
- [ ] Verify operator console visibility for that exact record.
- [ ] Record exact evidence artifact paths/commands.

### Phase 7: Fireflies old-path deletion

- [x] Delete superseded Fireflies scheduler-owned orchestration code.
- [x] Delete superseded Fireflies backlog/replay code no longer needed.
- [x] Delete dead Fireflies helper scripts/routes/docs tied to the old path.
- [x] Re-run proof after deletion to ensure only one Fireflies path remains.
- [x] Record the deleted files list in the task evidence and Linear update.

### Phase 8: Fireflies assignment and task extraction follow-on

- [x] Define the second cutover boundary for project assignment and task extraction.
- [x] Add the task extraction review queue behavior/operator actions.
- [x] Implement the canonical assignment + task extraction path for Fireflies.
- [x] Verify created tasks, assignment correctness, and fast feedback actions.
- [x] Delete superseded Fireflies assignment/extraction runtime paths.

### Phase 9: Next source-family planning

- [x] Pick the next source family after Fireflies.
- [ ] Repeat the same pattern: one boundary, live proof, old-path deletion.
- [ ] Replace the generic Teams phase cron owner with direct Teams channel and Teams DM owner scripts.
- [ ] Prove both Teams crons run successfully through the new direct entrypoints.
- [ ] Delete the superseded generic Graph phase runner from the live path and record remaining non-live references separately.

### Phase 10: Microsoft Graph Outlook downstream cutover

- [x] Record exact Outlook attachment/document duplicate owners and parity gaps.
- [x] Define the canonical Outlook attachment-to-document owner.
- [x] Define the canonical Graph vectorization owner for promoted Outlook attachments.
- [x] Define the canonical project/task/card owner for Graph communications after sync.
- [x] Close the attachment content/storage parity gap so the canonical owner matches required behavior.
- [x] Delete the superseded direct Outlook attachment document-write path.
- [x] Delete any now-obsolete inline Graph source intelligence hooks replaced by the canonical downstream owner.
- [x] Prove one real Outlook item still flows from intake to attachment/document/vector/project/task outcome.

## Acceptance Criteria

- Fireflies has one production path from intake through vectorization.
- A newly processed Fireflies item can be verified as searchable through the new path.
- The old Fireflies runtime paths are deleted from the main repository.
- Operator pages clearly show Fireflies sync, chunking, embedding, and failure state.
- The follow-on assignment/task extraction slice is defined with its own delete-on-proof rule.

## Evidence To Capture

- exact source record ids used for proof
- exact commands/endpoints used for proof
- screenshots or operator-page artifacts showing lifecycle status
- searchability proof for the exact Fireflies item
- deleted file list for the retired Fireflies path
- Linear comment ids for kickoff, milestone, and cutover proof

## Current Slice Notes

### 2026-07-01 Fireflies ownership-map findings

- Fireflies source ingress is currently native backend code through `POST /api/ingest/fireflies/recent` in `backend/src/api/main.py` and `FirefliesIngestionPipeline.sync_recent_transcripts(...)` in `backend/src/services/ingestion/fireflies_pipeline.py`.
- Fireflies still has a competing in-process orchestration owner in `backend/src/services/scheduler.py` for both scheduled sync and backlog drain.
- Fireflies vectorization still depends on the generic `run_full_pipeline(...)` orchestration path in `backend/src/services/pipeline/orchestrator.py`.
- Manual/operator replay initially depended on the old model through `backend/src/api/admin_endpoints.py` replay-stale-raw-ingested and the now-deleted `frontend/src/app/api/documents/trigger-pipeline/route.ts`.
- The first delete candidates after cutover are the scheduler-owned Fireflies sync/backlog paths and the Fireflies-specific phase-trigger/replay surfaces once they are replaced by the canonical workflow owner.

### 2026-07-01 Fireflies cutover slice 1

- The first implementation slice will establish one explicit Fireflies-native reprocess owner for existing meeting documents.
- That owner will reuse `FirefliesIngestionPipeline.ingest_markdown_text(...)` instead of sending Fireflies recovery through the generic `run_full_pipeline(...)` path.
- The first reroutes in scope are `backend/src/api/admin_endpoints.py` stale replay and the app-side Fireflies trigger surface that has since been deleted.
- The old scheduler-owned Fireflies path is intentionally not deleted in this slice until live proof exists for the new recovery owner.

### 2026-07-01 Fireflies cutover slice 1 result

- Added canonical owner module `backend/src/services/ingestion/fireflies_reprocessing.py`.
- Added canonical backend endpoint `POST /api/ingest/fireflies/process` in `backend/src/api/main.py`.
- Rerouted `backend/src/api/admin_endpoints.py` stale replay helper to the new Fireflies endpoint.
- Replaced admin `generate-embeddings` Fireflies recovery work from `run_parser/run_embedder/run_extractor` to `reprocess_existing_fireflies_document(...)`.
- Rerouted the former frontend Fireflies trigger route from `/api/pipeline/process` to `/api/ingest/fireflies/process`, then deleted it after the operator page stopped depending on phase-based triggers.

### 2026-07-01 Verification notes

- `python -m py_compile backend/src/api/main.py backend/src/api/admin_endpoints.py backend/src/services/ingestion/fireflies_reprocessing.py backend/src/services/supabase_helpers.py` passed.
- `python -m pytest backend/tests/test_api_routes.py -q` is currently blocked in local test bootstrap because FastAPI import requires `python-multipart` in this environment before route tests can start.
- The former frontend Fireflies trigger route was import-verified before deletion; the route itself is no longer present after the operator cutover.

### 2026-07-01 Live proof evidence

- Candidate 1: `metadata_id=01KVT4ZNDVQ92ADFY23RRHKPCJ` (`Union Collective: Design Meeting`)
- Candidate 2: `metadata_id=01KWANTSD4E1VZA5J4P491VH4W` (`Greyrock Westfield Collective`)
- Command used for direct owner proof:
  - `python <<'EOF' ... from src.services.ingestion.fireflies_reprocessing import reprocess_existing_fireflies_document ... EOF`
- Candidate 1 result:
  - `documentId=01KVT4ZNDVQ92ADFY23RRHKPCJ`
  - `chunkCount=62`
  - `actionItemCount=18`
- Candidate 2 result:
  - `documentId=01KWANTSD4E1VZA5J4P491VH4W`
  - `chunkCount=56`
  - `actionItemCount=11`
- Candidate 2 read-back proof:
  - `fireflies_ingestion_jobs.stage='done'`
  - `fireflies_ingestion_jobs.error_message=null`
  - `fireflies_ingestion_jobs.last_attempt_at='2026-07-01T16:18:53.521Z'`
  - `fireflies_ingestion_jobs.updated_at='2026-07-01T16:18:53.521Z'`
  - `document_chunks` has `56` rows with `source_type='meeting_transcript'` and non-null embeddings for `document_id=01KWANTSD4E1VZA5J4P491VH4W`
- Searchability proof:
  - `search_document_chunks` RPC returned `resultCount=5`
  - top result matched `document_id=01KWANTSD4E1VZA5J4P491VH4W`
  - top result similarity was `1`

### 2026-07-01 Proof blockers fixed during implementation

- Bug 1:
  - Cause: `fetch_document_metadata()` selected `document_metadata.updated_at`, which does not exist in the live DB.
  - Detection gap: static compile did not exercise the live schema.
  - Prevention step: keep live-schema proof as part of Fireflies replay verification.
- Bug 2:
  - Cause: app catalog upsert passed non-owned metadata keys like `intelligence_compiler` into `document_metadata`.
  - Detection gap: `_app_document_catalog_payload()` was effectively permissive instead of schema-bounded.
  - Prevention step: app payload is now restricted to the live `document_metadata` column allowlist.
- Bug 3:
  - Cause: stored Fireflies markdown without a parseable `**Fireflies ID:**` marker caused replay to derive a new synthetic `document_id`, which then broke `fireflies_ingestion_jobs.metadata_id` FK updates.
  - Detection gap: replay assumed stored Fireflies content still contained canonical identity markers.
  - Prevention step: replay now injects the Fireflies identity header from the existing `document_metadata` row before parsing.

### 2026-07-01 Deletion slice now in progress

- Delete scheduler-owned Fireflies backlog orchestration in `backend/src/services/scheduler.py`.
- Delete scheduler-owned Fireflies scheduled sync registration and wrappers in `backend/src/services/scheduler.py`.
- Delete direct worker replay script `backend/src/scripts/replay_fireflies_jobs_direct.py`.
- Clean up references, tests, and docs that still point at those deleted owners.
- Leave only the canonical Fireflies-native replay owner and its explicit endpoint as the valid recovery path.

### 2026-07-01 Deletion slice result

- Deleted scheduler-owned Fireflies backlog registration and worker code from `backend/src/services/scheduler.py`.
- Deleted the scheduler-owned Fireflies scheduled sync wrappers from `backend/src/services/scheduler.py`.

### 2026-07-01 Graph direct-owner progress

- `alleato-graph-sync` now runs through `backend/scripts/run_graph_sync.py` and finished successfully on live Render at `2026-07-01T19:52:48Z` with `total_synced=34`, `errors=[]`, `attachment_promotion.promoted=13`, `embed.embedded=13`, and `intelligence_extraction.synthesis_packets_written=11`.
- `alleato-graph-subscription-reconcile` now runs through `backend/src/scripts/run_graph_subscription_reconcile.py` and finished successfully on live Render at `2026-07-01T20:04:59Z` with `checked=11`, `failed=0`, `created=0`, `renewed=0`, and `skipped=11`.
- The next consolidation slice is the Teams-only cron boundary. The generic live phase runner has been deleted from repo code and replaced with:
  - `backend/scripts/run_graph_teams_channel_sync.py`
  - `backend/scripts/run_graph_teams_dm_sync.py`
- Remaining verification blocker in this slice:
  - `backend/tests/test_render_sync_blueprints.py` still exposes broader repo policy debt because many `alleato-*` crons in `render.yaml` are configured with `APP_DB_PRESSURE_GUARD_REQUIRED=false`. This is older operational drift, not a regression introduced by the Teams direct-owner cutover.
  - Final Teams DM proof is still in progress because the first rerun was launched before the live `TEAMS_DM_SYNC_MAX_USERS` drift was corrected; the bounded redeploy `dep-d92nhscvikkc73aq7900` must go live and then one more DM rerun must finish cleanly.
  - Teams direct-owner proof is complete, but broader cron-config guardrail debt still remains across other `alleato-*` services that read back with `APP_DB_PRESSURE_GUARD_REQUIRED=false`.
  - Source-sync-health live proof is still in progress until deploy `dep-d92nkaa8qa3s73b9qvu0` goes live and one direct-script run is captured.
- Deleted scheduler-owned Fireflies scheduled sync registration and wrappers from `backend/src/services/scheduler.py`.
- Added dedicated scheduled Fireflies owner `backend/scripts/run_fireflies_sync.py`.
- Updated `render.yaml` cron `alleato-fireflies-sync` to call `python3 scripts/run_fireflies_sync.py` directly instead of importing scheduler internals.
- Deleted direct replay worker script `backend/src/scripts/replay_fireflies_jobs_direct.py`.
- Deleted scheduler tests that only protected the removed backlog worker from `backend/tests/test_scheduler_graph_jobs.py`.
- Removed active env-var references for the deleted backlog worker from:
  - `docs/reference/ENV-VARS.md`
  - `scripts/verify/verify-render-web-scheduler-disabled.mjs`
  - `scripts/verify/verify-live-db-incident.mjs`
- Removed active README reference to the deleted direct replay script in `backend/README.md`.
- Updated the Fireflies ownership-map document to reflect the deletion.
- Added Render blueprint coverage for the direct Fireflies cron entrypoint in `backend/tests/test_render_sync_blueprints.py`.

### 2026-07-01 Deletion verification notes

- `python -m py_compile backend/scripts/run_fireflies_sync.py backend/src/services/ingestion/sync_followups.py backend/src/services/scheduler.py backend/src/api/main.py backend/src/api/admin_endpoints.py backend/src/services/ingestion/fireflies_reprocessing.py backend/src/services/supabase_helpers.py` passed.
- Repo sweep for active runtime/docs/tests returned no remaining matches for `run_fireflies_sync_job`, `_run_fireflies_sync`, `FIREFLIES_SYNC_ENABLED`, `FIREFLIES_SYNC_INTERVAL_MINUTES`, or `FIREFLIES_SYNC_LIMIT` under active backend/scripts/tests/docs-reference/verify surfaces.
- Live direct-sync proof after deletion:
  - command: `python - <<'EOF' from backend.scripts.run_fireflies_sync import main; raise SystemExit(main(limit=1)) EOF`
  - result: `requested=1`, `found=1`, `processed=1`, `error_count=0`
  - transcript: `01KWEXC1RYQY8D4S95CEHPMJNQ` (`Owner Billings & PSR Review – Doug Franklin`)
  - ingestion result: `document_id=01KWEXC1RYQY8D4S95CEHPMJNQ`, `chunk_count=71`, `action_item_count=10`
  - follow-on project backfill: `scanned=250`, `assigned=1`, `failed=0`
- Live read-back proof after direct-sync deletion cutover:
  - `fireflies_ingestion_jobs.stage='done'`
  - `fireflies_ingestion_jobs.error_message=null`
  - `fireflies_ingestion_jobs.last_attempt_at='2026-07-01T17:12:22.355008+00:00'`
  - `fireflies_ingestion_jobs.updated_at='2026-07-01T17:12:22.466179+00:00'`
  - exact `document_id=01KWEXC1RYQY8D4S95CEHPMJNQ` has `71` embedded `meeting_transcript` rows in the RAG database
- Remaining backend pytest blocker is environment/test-harness debt, not the deletion slice:
  - local venv progressed past missing `python-multipart`, `fastapi`, `httpx2`, and `httpx`
  - current next blocker is `ModuleNotFoundError: No module named 'openai'` while loading backend route imports in test bootstrap
- Historical references still remain in archival or lessons docs and generated inventory artifacts, but no active runtime owner or active env doc now points to the deleted scheduler-owned Fireflies path.

### 2026-07-01 Fireflies assignment/extraction deletion result

- Deleted the env-gated inline Fireflies task-write branch from `backend/src/services/ingestion/fireflies_pipeline.py`.
- Deleted the now-unused helper `delete_open_rewriter_tasks_for_document(...)` from `backend/src/services/supabase_helpers.py`.
- Deleted the obsolete Fireflies cron env override from `render.yaml`.
- Updated `backend/tests/test_render_sync_blueprints.py` to assert the simplified direct Fireflies cron command.
- Removed stale test-only support for the deleted inline task-write helper from `backend/tests/test_fireflies_action_items.py`.
- Removed dead unused Fireflies direct-task-builder helpers from `backend/src/services/ingestion/fireflies_pipeline.py` so the repo no longer keeps that superseded task owner logic around.
- Updated active docs to describe the canonical post-ingest extractor as the only live Fireflies task owner:
  - `docs/2026-06-22-docs-migration/patterns/meeting-pipeline.md`
  - `docs/architecture/AI-RAG-ARCHITECTURE.md`

### 2026-07-01 Fireflies assignment/extraction verification notes

- `python -m py_compile backend/src/services/ingestion/fireflies_pipeline.py backend/src/services/supabase_helpers.py backend/scripts/run_fireflies_sync.py backend/src/services/ingestion/sync_followups.py backend/src/services/ingestion/fireflies_reprocessing.py` passed.
- Repo sweep after deletion returned no active runtime/config matches for:
  - `FIREFLIES_REWRITE_TASKS_DURING_INGEST`
  - `delete_open_rewriter_tasks_for_document`
  - `_build_task_rows_via_rewriter(...)`
  - `env FIREFLIES_REWRITE_TASKS_DURING_INGEST=false`
- Remaining `fireflies_rewriter` references are limited to:
  - canonical extractor ownership in `backend/src/services/pipeline/extractor.py`
  - the shared prompt module `backend/src/services/ingestion/fireflies_task_rewriter.py`
  - historical evidence artifacts documenting prior runs
- Targeted pytest remains blocked by existing local test-bootstrap debt, not this slice:
  - `pytest backend/tests/test_render_sync_blueprints.py -q`
  - blocker: `RuntimeError: Form data requires "python-multipart" to be installed` while importing `backend/tests/conftest.py`

### 2026-07-01 Fireflies assignment/extraction live proof

- Canonical reprocess command:
  - `python - <<'EOF' ... from src.services.ingestion.fireflies_reprocessing import reprocess_existing_fireflies_document ... EOF`
- Canonical reprocess result for `metadata_id=01KWANTSD4E1VZA5J4P491VH4W`:
  - `owner='fireflies_native_reprocess'`
  - `chunkCount=56`
  - `actionItemCount=11`
  - `taskCount=10`
  - `decisionCount=4`
  - `riskCount=5`
  - `opportunityCount=4`
- Live task/assignment read-back for `metadata_id=01KWANTSD4E1VZA5J4P491VH4W`:
  - `document_metadata.project_id=43`
  - `tasks.count=12`
  - `unassigned_tasks=0`
  - `mismatched_project_tasks=0`
  - sample titles:
    - `Confirm Gray Rock numbers with Jason`
    - `Compile Westfield subcontractor payment list`
    - `Track S&M and Richardson payment holds`
    - `Secure correctly named lien waivers`
    - `Process Fort Worth permit fee invoice`
- Control read-back for unassigned meeting `metadata_id=01KWEXC1RYQY8D4S95CEHPMJNQ`:
  - `document_metadata.project_id=null`
  - `tasks.count=0`
- Canonical extractor proof log during reprocess:
  - the run emitted `[FirefliesTaskRewriter] ...` from the post-ingest extractor path before returning `owner='fireflies_native_reprocess'`
  - this confirms the surviving task rewrite logic is now only the canonical post-ingest extractor path, not the deleted inline ingest-time branch

### 2026-07-01 Next source-family pick

- The next source family after Fireflies is Microsoft Graph-derived communications/documents.
- Reason:
  - the consolidation proposal already identified Graph-derived communications as the other highest-pain family after Fireflies
  - scheduler-owned Graph sync, webhook drain, embedding, and Outlook attachment promotion wrappers still create a mixed-owner runtime seam in `backend/src/services/scheduler.py`
  - the repo also still exposes multiple manual Graph admin/API entrypoints under `backend/src/api/main.py` and `backend/src/api/admin_endpoints.py`, which makes this the next best candidate for the same one-owner/delete-the-old-path pattern
- Initial local inventory for the next slice:
  - Render initially mixed Teams-only direct phase crons, inline Graph sync, and scheduler-owned Graph follow-up jobs before the direct-owner cleanup sequence started
  - Scheduler still owns `_run_graph_sync`, `_run_graph_webhook_drain`, `_run_graph_embedding`, and `_run_outlook_attachment_promotion` at the start of the Graph cleanup sequence
  - the deeper duplicate-owner problem is Outlook downstream ownership after intake persistence
- Chosen first Graph sub-slice:
  - keep Outlook fetch + intake persistence in `sync_outlook_emails(...)`
  - make `attachment_promotion.py` the only attachment-to-document owner
  - keep `embed_pending_graph_documents(...)` the only vectorization owner
  - keep `synthesize_new_comms_since(...)` the only project/task/card owner
  - delete competing inline source-module hooks after proof
  - first parity requirement discovered before deletion:
    - `outlook.py::_sync_email_attachment(...)` still uploads bytes, extracts attachment text, and writes richer attachment metadata than `attachment_promotion.py` currently guarantees when storage-copy is off
    - this means the next Graph implementation step must start by closing that parity gap before deleting the duplicate Outlook attachment owner
  - first parity slice implemented:
    - `attachment_promotion.py` now fetches attachment bytes from intake or Graph when available, uploads them to storage, extracts text for supported extensions, and writes richer attachment metadata instead of defaulting to metadata-only promotion
    - `review_needed` attachments caused only by missing project assignment can now re-enter promotion once a project is later assigned
    - focused direct tests now cover the promoted attachment storage/text path and the late-assignment retry gate

### 2026-07-01 Outlook attachment promotion parity slice

- Updated `backend/src/services/integrations/microsoft_graph/attachment_promotion.py` so the canonical promotion owner now:
  - loads attachment bytes from stored intake content or fetches them live through Graph when needed
  - uploads promoted files to Supabase Storage
  - extracts text for supported file extensions
  - writes richer metadata/content fallback using the shared Outlook attachment metadata formatter
  - retries `review_needed` attachments when the only prior blocker was missing project assignment and a project now exists
- Added focused tests in `backend/tests/test_outlook_attachment_promotion.py` for:
  - promoted attachment byte fetch -> storage upload -> extracted text write
  - metadata-only fallback when bytes are unavailable
  - late project-assignment retry eligibility

### 2026-07-01 Outlook attachment promotion verification notes

- `python -m py_compile backend/src/services/integrations/microsoft_graph/attachment_promotion.py backend/tests/test_outlook_attachment_promotion.py` passed.
- Direct in-process execution of focused tests passed:
  - `test_promote_attachment_fetches_bytes_and_uploads_storage`
  - `test_promote_attachment_uses_metadata_fallback_without_bytes`
  - `test_should_retry_attachment_promotion_when_project_assignment_arrives`
  - `test_should_not_retry_review_needed_attachment_without_new_project`
  - `test_promote_attachment_reuses_existing_content_hash_document`
  - `test_classify_attachment_promotes_generic_project_pdf_without_keyword`
  - `test_should_retry_legacy_review_needed_extension_row_when_project_exists`
- Deletion follow-through completed:
  - removed `outlook.py::_sync_email_attachment(...)` so Outlook attachments now persist only through intake -> `attachment_promotion.py`
  - removed the inline Outlook source-intelligence trigger from `sync_outlook_emails(...)`
  - removed the inline Graph embed trigger from the normal `embed_graph_document(...)` completion path so project/task/card synthesis stays owned by `synthesize_new_comms_since(...)`
- Scheduler cleanup follow-through completed:
  - removed the scheduler-owned `graph_embedding` job registration from `backend/src/services/scheduler.py`
  - removed the scheduler-owned `outlook_attachment_promotion` job registration from `backend/src/services/scheduler.py`
  - removed the dead scheduler wrapper functions `run_graph_embedding_job(...)`, `run_outlook_attachment_promotion_job(...)`, `_run_graph_embedding(...)`, and `_run_outlook_attachment_promotion(...)`
  - updated `backend/src/services/integrations/microsoft_graph/sync.py` comments to reflect that `run_graph_sync(...)` is now the primary automated owner for attachment promotion
  - removed the obsolete scheduler embed-wrapper test from `backend/tests/test_scheduler_graph_jobs.py`
- Remaining gap after deletion:
  - the legacy fireflies supplement helper inside `backend/src/services/integrations/microsoft_graph/embed.py` still calls `_run_source_intelligence_compiler(...)`, but that is outside the current Outlook/Graph downstream cutover boundary and should be handled in a separate cleanup slice if we want to fully retire that helper
  - webhook drain ownership slice completed structurally:
    - added dedicated runtime owner `backend/scripts/run_graph_webhook_drain.py`
    - created live Render cron `crn-d92m440k1i2s73d2n0g0` / `alleato-graph-webhook-drain`
    - removed scheduler-owned `graph_webhook_drain` registration and wrappers from `backend/src/services/scheduler.py`
  - first live cron run root cause:
    - the newly created Render cron built from `origin/main` commit `7c30aff1b03ea1641b8403023a63d8cd54f59c37`
    - that deploy finished `live` at `2026-07-01T18:56:57Z`
    - Render then started the cron run at `2026-07-01T18:57:01Z`
    - runtime failed with `python3: can't open file '/app/scripts/run_graph_webhook_drain.py': [Errno 2] No such file or directory`
    - cause: the dedicated script exists locally in this repo but is not yet on `origin/main`, so the first live cron image did not include it
  - second live cron run root cause after the repo push:
    - the rebuilt image included the script, but the direct service env set was missing `SUPABASE_SERVICE_ROLE_KEY`
    - runtime failed in `get_supabase_client()` with `RuntimeError: Environment variable 'SUPABASE_ANON_KEY' is required for Supabase access`
    - cause: the cron had `SUPABASE_URL` but only inherited `SUPABASE_SERVICE_KEY` in the local payload, while the live Graph cron uses `SUPABASE_SERVICE_ROLE_KEY`
  - live remediation completed:
    - pushed commit `c78e85f9110807e3afb0c1ea135ca07c63e638c0` to `origin/main`
    - verified Render auto-deploy `dep-d92m94naqgkc739c119g` reached `live` from that commit
    - added `SUPABASE_SERVICE_ROLE_KEY` directly to Render service `crn-d92m440k1i2s73d2n0g0`
    - forced follow-up deploy `dep-d92mau4vikkc73ccr3d0` to refresh runtime env
  - direct success proof:
    - manual run `crn-d92m440k1i2s73d2n0g0-1782932895` started at `2026-07-01T19:08:15Z`
    - run output was:
      - `status='skipped'`
      - `reason='no_pending_mailboxes'`
      - `queued=0`
      - `processed=0`
      - `failed=0`
      - `items_synced=0`
    - Render logged `Cron job run finished successfully` at `2026-07-01T19:08:54Z`

### 2026-07-01 Outlook attachment promotion live proof

- Live canonical promotion command:
  - `python - <<'EOF' ... from src.services.integrations.microsoft_graph.attachment_promotion import promote_outlook_intake_attachments ... EOF`
- Live promotion result:
  - `seen=1`
  - `promoted=1`
  - `failed=0`
- Exact promoted attachment:
  - `outlook_email_intake_attachments.id=6`
  - `file_name='5-5-26 Meeting - GW Illinois Weekly OAC Meeting All Stores 10.pdf'`
  - old status was `review_needed` with `promotion_reason='promotable_extension_no_context:pdf'`
  - new status is `promoted` with `promotion_reason='extension:pdf'`
- Live document read-back:
  - `document_metadata.id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'`
  - `project_id=90`
  - `status='raw_ingested'`
  - `source_system='outlook_attachment'`
  - `storage_bucket='documents'`
  - `file_path='outlook-attachments/bclymer_alleatogroup.com/cddf78f909bfccbf2870beb6/cd70974b7c2f-5-5-26_Meeting_-_GW_Illinois_Weekly_OAC_Meeting_All_Stores_10.pdf'`
  - `content_hash='263a003f1a4963cb32e080f3c1a3391b45a8f38e92d3d8193c7ece4e70c34b0a'`
  - `source_metadata.storage_copy_status='copied'`
  - `source_metadata.storage_content_type='application/pdf'`
- Live project document read-back:
  - `project_documents.id=3444`
  - `project_id=90`
  - `source_system='outlook_attachment'`
  - `source_item_id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'`
  - `storage_bucket='documents'`
  - `storage_path='outlook-attachments/bclymer_alleatogroup.com/cddf78f909bfccbf2870beb6/cd70974b7c2f-5-5-26_Meeting_-_GW_Illinois_Weekly_OAC_Meeting_All_Stores_10.pdf'`
- Live vectorization + downstream outcome proof:
  - canonical embed command returned `{"embedded": 1, "skipped": 0, "skipped_disabled": 4, "total_chunks": 9, "errors": 0, "by_category": {"Email Attachment": 1}}`
  - AI DB read-back for `rag_document_metadata.id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'` showed:
    - `app_document_id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'`
    - `project_id=90`
    - `embedding_status='embedded'`
  - AI DB read-back for `document_chunks` showed `chunk_count=9` for `document_id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'`
  - app DB read-back for the same `document_metadata.id` showed `status='embedded'`
  - canonical project-intelligence command returned:
    - `{"since": "2026-07-01T18:17:40+00:00", "projects": 1, "emails": 0, "teams": 0, "cards_written": 0, "tasks_written": 0, "synthesis_packets_written": 0, "synthesis_packets_skipped": 1, "pm_projection_rows": {}, "errors": []}`
  - follow-up read-back confirmed:
    - `tasks` rows with `metadata_id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'` = `0`
    - `source_signal_candidates` rows with `source_document_id='outlook_attachment_cddf78f909bfccbf2870beb6_cd70974b7c2f0e6af165eafc'` = `0`
  - interpretation:
    - this exact promoted Outlook attachment now completes the canonical downstream flow through attachment promotion and vectorization
    - the canonical synthesizer reviewed the project window and produced no cards/tasks for this attachment, which is a clean zero-yield outcome rather than a broken path
- Scheduler cleanup verification:
  - `python -m py_compile backend/src/services/scheduler.py backend/src/services/integrations/microsoft_graph/sync.py backend/tests/test_scheduler_graph_jobs.py` passed
  - repo search found no remaining references to:
    - `run_graph_embedding_job`
    - `run_outlook_attachment_promotion_job`
    - `_run_graph_embedding(...)`
    - `_run_outlook_attachment_promotion(...)`
  - `PYTHONPATH=backend pytest backend/tests/test_scheduler_graph_jobs.py -q` is still blocked by the local `python-multipart` bootstrap gap because `backend/tests/conftest.py` imports `src.api.main`
- Live Render drift + remediation:
  - Render API read-back showed production cron `alleato-graph-sync` (`crn-d827dut7vvec73b33fa0`) was unexpectedly `suspended` even though prior repo evidence expected it to be active
  - resumed the cron with `POST /v1/services/crn-d827dut7vvec73b33fa0/resume`
  - read-back after remediation showed:
    - `suspended='not_suspended'`
    - `schedule='20 */2 * * *'`
  - triggered a manual run with `POST /v1/cron-jobs/crn-d827dut7vvec73b33fa0/runs`
  - manual run accepted as `id='crn-d827dut7vvec73b33fa0-1782930960'`, `status='pending'`
  - immediate log proof showed the resumed cron entered a fresh build/run cycle on Render

### 2026-07-01 Assignment and task-extraction cutover result

- Defined the second cutover boundary as: Fireflies-native ingestion/reprocess owner plus one direct post-ingest extraction follow-through, without routing Fireflies through `run_full_pipeline(...)`.
- Added `run_fireflies_post_ingest_extraction(metadata_id)` in `backend/src/services/ingestion/sync_followups.py`.
- Updated `backend/src/services/ingestion/fireflies_pipeline.py` so scheduled Fireflies sync runs extraction immediately after successful ingestion instead of stopping at chunks/embeddings.
- Updated `backend/src/services/ingestion/fireflies_reprocessing.py` so canonical replay now returns extraction counts alongside chunk/embedding output.
- Updated `backend/src/scripts/refresh_fireflies_transcripts.py` so Fireflies manual refresh no longer calls `run_full_pipeline(...)`.

### 2026-07-01 Assignment and task-extraction verification notes

- `python -m py_compile backend/src/services/ingestion/fireflies_pipeline.py backend/src/services/ingestion/fireflies_reprocessing.py backend/src/services/ingestion/sync_followups.py backend/scripts/run_fireflies_sync.py backend/src/scripts/refresh_fireflies_transcripts.py` passed.
- Live canonical replay proof:
  - command: `python - <<'EOF' ... from src.services.ingestion.fireflies_reprocessing import reprocess_existing_fireflies_document ... EOF`
  - record: `01KWANTSD4E1VZA5J4P491VH4W` (`Greyrock Westfield Collective`)
  - result: `taskCount=12`, `decisionCount=4`, `riskCount=4`, `opportunityCount=5`, `signalCount=0`, `skipped=true`
- Live read-back proof:
  - exact `metadata_id=01KWANTSD4E1VZA5J4P491VH4W` has `12` `tasks` rows with `source_system='fireflies'`
  - `fireflies_ingestion_jobs.stage='done'`
  - `fireflies_ingestion_jobs.error_message=null`
  - `fireflies_ingestion_jobs.last_attempt_at='2026-07-01T17:19:31.365162+00:00'`
  - `fireflies_ingestion_jobs.updated_at='2026-07-01T17:19:31.420819+00:00'`
- Current blocker in this slice:
  - meeting signal projection is guarded by `ALLOW_PM_APP_FINAL_PROJECTIONS`; extraction continued and task rows were still created, but signal promotion remained blocked for this proof run

### 2026-07-01 Graph direct-owner cutover result

- Added direct Graph cron owner `backend/scripts/run_graph_sync.py`.
- Updated `render.yaml` cron `alleato-graph-sync` to call `timeout 25m python3 scripts/run_graph_sync.py`.
- Deleted the scheduler-owned `graph_sync` registration and wrappers from `backend/src/services/scheduler.py`.
- Deleted the scheduler-only Graph sync test coverage that protected the removed wrapper path from `backend/tests/test_scheduler_graph_jobs.py`.
- Synced `docs/reference/ENV-VARS.md` with the direct-owner Graph cron contract by removing stale Graph sync env references and keeping `GRAPH_SYNC_RUN_EMBEDDING` as the live post-sync embedding switch.

### 2026-07-01 Graph direct-owner live proof and blocker

- Render API read-back confirmed production cron `alleato-graph-sync` (`crn-d827dut7vvec73b33fa0`) now points at:
  - `dockerCommand='timeout 25m python3 scripts/run_graph_sync.py'`
  - `schedule='20 */2 * * *'`
  - `suspended='not_suspended'`
- First live manual run after command cutover:
  - run id: `crn-d827dut7vvec73b33fa0-1782933658`
  - result: the direct owner script executed, so command/runtime ownership was proven
  - blocker surfaced by logs: repeated `42501 row-level security` failures on `outlook_email_intake`
- Root-cause conclusion:
  - the direct Graph owner boundary is correct and live
  - the remaining failure is the Outlook intake AI DB credential boundary, not scheduler ownership or missing script ownership

### 2026-07-01 Outlook intake credential-boundary remediation in progress

- Live remediation applied:
  - refreshed Render service `crn-d827dut7vvec73b33fa0` env vars `RAG_SUPABASE_URL`, `RAG_SUPABASE_SERVICE_ROLE_KEY`, `SUPABASE_URL`, and `SUPABASE_SERVICE_ROLE_KEY` from the known-good local secure source via `PUT /v1/services/{serviceId}/env-vars/{envVarKey}`
- Guardrail added:
  - `backend/src/services/supabase_helpers.py` now exposes `as_actionable_outlook_intake_write_error(...)`
  - `backend/src/services/integrations/microsoft_graph/outlook.py` wraps writes to:
    - `outlook_email_intake`
    - `outlook_email_skip_audit`
    - `outlook_email_intake_attachments`
  - future `42501` failures now raise an explicit message naming `RAG_SUPABASE_SERVICE_ROLE_KEY` / AI DB service-role drift
- Verification in progress:
  - fresh manual Graph cron rerun was triggered immediately after the env refresh to prove whether the intake boundary is now fixed

### 2026-07-01 Outlook intake credential-boundary result

- Published guardrail commit:
  - commit: `d738f4d8756fc386b51b0d4a336b7176e620de55`
  - deploy: `dep-d92mlnrtqb8s73cvhip0`
- Direct Graph cron rerun after the deploy:
  - run id: `crn-d827dut7vvec73b33fa0-1782934312`
  - run start log: `2026-07-01T19:31:53.353420969Z`
- AI DB read-back proof after the rerun:
  - `outlook_email_intake` rows `id=4213..4222` were written for `ctragesser@alleatogroup.com`
  - sample write timestamps:
    - `updated_at='2026-07-01T19:33:11.807778+00:00'`
    - `updated_at='2026-07-01T19:33:29.120927+00:00'`
- Log proof for the repaired boundary:
  - the rerun continued through Outlook mailbox sync and into SharePoint delta processing
  - no new `42501` / `row-level security` writes appeared after the rerun start timestamp
- Conclusion:
  - the Outlook intake AI DB credential boundary is repaired
  - the current direct Graph owner is now writing durable Outlook intake rows again

### 2026-07-01 Next Graph hardening slice in progress

- New runtime issue surfaced after the auth fix:
  - SharePoint file download failed with transient `503 Service Unavailable` for `Check 02216 Quality Roofing $1240.00.pdf`
- Root cause:
  - `GraphClient.download_bytes(...)` bypassed the Graph client’s existing bounded retry behavior for transient `429/503` and network errors
- Remediation in progress:
  - harden shared `backend/src/services/integrations/microsoft_graph/client.py` download behavior so OneDrive/SharePoint file fetches inherit the same bounded retry policy as normal Graph GET requests

### 2026-07-01 Graph direct-owner and retry hardening result

- Published retry hardening commit:
  - commit: `124cd574382c4d7c41a41ef689a815991eca092d`
  - deploy: `dep-d92mpa7avr4c7398ogh0`
- Live direct Graph cron proof on the retry-hardened deploy:
  - run id: `crn-d827dut7vvec73b33fa0-1782934768`
  - run start log: `2026-07-01T19:39:29.312515465Z`
  - Render read-back:
    - `lastSuccessfulRunAt='2026-07-01T19:52:48Z'`
- Final runtime summary from logs:
  - `status='complete'`
  - `total_synced=34`
  - `outlook=34`
  - `sharepoint=0`
  - `errors=[]`
  - `attachment_promotion.promoted=13`
  - `embed.embedded=13`
  - `intelligence_extraction.synthesis_packets_written=11`
- SharePoint retry proof:
  - runtime emitted bounded retry logs:
    - `Download 503 response — retrying in 2s (attempt 1/4)`
  - the cron still finished successfully instead of failing the run
- Outlook intake durable-write proof after the successful run:
  - fresh `outlook_email_intake` rows persisted for:
    - `bclymer@alleatogroup.com` through `updated_at='2026-07-01T19:40:46.142263+00:00'`
    - `cgillespie@alleatogroup.com` through `updated_at='2026-07-01T19:41:16.233969+00:00'`
- Conclusion:
  - the direct `run_graph_sync.py` owner is now live and proven end to end
  - the previous auth failure is fixed
  - the transient SharePoint `503` path is now bounded and non-fatal

### 2026-07-01 Graph subscription-reconcile ownership cutover in progress

- Remaining duplicate-owner seam:
  - Render already has dedicated cron `alleato-graph-subscription-reconcile`
  - repo still kept:
    - inline Python command in `render.yaml`
    - scheduler-owned `run_graph_subscription_reconcile_job()` / `_run_graph_subscription_reconcile()` wrappers
- Cutover actions in progress:
  - changed `render.yaml` to `timeout 5m python3 src/scripts/run_graph_subscription_reconcile.py`
  - removed the scheduler-owned subscription-reconcile registration and wrapper code from `backend/src/services/scheduler.py`
  - removed scheduler-only tests for that deleted path from `backend/tests/test_scheduler_graph_jobs.py`
  - patched the live Render cron `crn-d8qo05egvqtc73e1fd30` to the same direct script owner
  - triggered manual proof run `crn-d8qo05egvqtc73e1fd30-1782936145`

### 2026-07-01 Operator/reporting cutover slice in progress

- Replaced the Fireflies pipeline page language in `frontend/src/app/(main)/pipeline/page.tsx` from old parse/embed/extract operator phases to lifecycle outcomes: synced, vectorized, project assigned, tasks extracted, processing, failed.
- Fixed `frontend/src/app/(main)/pipeline/page.tsx` to query the actual Fireflies corpus through `/api/documents/status?type=meeting&source=fireflies` instead of the default document view that hides meetings.
- Updated `frontend/src/app/api/documents/status/route.ts` to return Fireflies lifecycle labels, task counts, raw backend stage, and project-assignment state so the frontend can render human-readable status without manual table inspection.
- Added a direct operator handoff from `/pipeline` to `/admin/task-training` for fast task review.
- Deleted `frontend/src/app/api/documents/trigger-pipeline/route.ts` because the page no longer uses phase-based Fireflies triggers.
- Left `frontend/src/lib/documents/pipeline-trigger.ts` untouched in this slice because its live callers are generic document uploads/attachments, not the Fireflies-specific cutover surface.
- Updated `backend/scripts/reprocess_recent_fireflies_tasks.py` to use `reprocess_existing_fireflies_document(...)` so Fireflies-only remediation scripts now follow the canonical owner.
- Updated active Fireflies docs to reflect the direct cron/script owner and canonical Fireflies-native reprocess path:
  - `docs/2026-06-22-docs-migration/patterns/meeting-pipeline.md`
  - `docs/2026-06-22-docs-migration/api/BACKEND-API.md`
  - `docs/2026-06-22-docs-migration/PRPs/intelligence/deep-extraction-realtime-spec.md`
  - `docs/architecture/AI-RAG-ARCHITECTURE.md`

### 2026-07-01 Operator/reporting cutover verification notes

- `python -m py_compile backend/scripts/reprocess_recent_fireflies_tasks.py` passed.
- `frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json -e "import('./frontend/src/app/api/documents/status/route.ts'); import('./frontend/src/app/(main)/pipeline/page.tsx'); import('./frontend/src/lib/documents/pipeline-trigger.ts');"` passed.
- `frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json -e "import('./frontend/src/app/(main)/pipeline/page.tsx'); import('./frontend/src/app/api/documents/status/route.ts');"` passed after the Fireflies-only query/handoff update.
- Active Fireflies code sweep now shows:
  - `backend/scripts/reprocess_recent_fireflies_tasks.py` uses `reprocess_existing_fireflies_document(...)`
  - `frontend/src/app/(main)/pipeline/page.tsx` no longer renders trigger-phase UI language
  - remaining `/api/pipeline/process` helper reference is currently generic document-ingest debt, not a Fireflies-specific runtime owner in this slice
- Remaining UI/reporting follow-on from Sub-agent A:
  - `/pipeline-health` has now been reduced to a redirect, but broader docs and remaining references still need cleanup so `/source-sync` is the clear control-plane owner everywhere
  - the stronger long-term shape is `/pipeline` for concise Fireflies lifecycle plus `/admin/task-training` for review, with `/source-sync` or `/rag?tab=lifecycle` as the cross-source control plane

### 2026-07-01 Lifecycle task-outcome slice result

- Extended the shared admin lifecycle contract in `frontend/src/app/api/admin/source-sync/_lifecycle.ts` and `_contracts.ts` to expose explicit Fireflies task outcomes: `tasks_created`, `no_actionable_tasks`, `task_signal_staged`, `not_extracted`.
- Updated `frontend/src/app/api/admin/source-sync/lifecycle-documents/route.ts` to return `taskOutcome` per document.
- Updated `frontend/src/app/(admin)/rag/page.tsx` to render the task outcome label directly in the lifecycle drill-down list.
- Redirected `frontend/src/app/(admin)/pipeline-health/page.tsx` to `/admin/source-sync`.
- Updated `frontend/src/app/(admin)/admin/page.tsx` so the admin launcher points to `/source-sync` instead of the redundant `pipeline-health` alias.
- Updated `frontend/src/app/(admin)/learning-feedback/page.tsx` and `frontend/src/app/(main)/pipeline/page.tsx` with direct `/admin/task-training` handoffs.
- Renamed old Fireflies admin endpoint surfaces in `backend/src/api/admin_endpoints.py` to canonical names:
  - `/api/admin/documents/reprocess-fireflies`
  - `/api/admin/documents/reprocess-status/{task_id}`
  - `/api/admin/documents/fireflies-stats`

### 2026-07-01 Lifecycle task-outcome verification notes

- `frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json -e "import('./frontend/src/app/api/admin/source-sync/_lifecycle.ts'); import('./frontend/src/app/api/admin/source-sync/_contracts.ts'); import('./frontend/src/app/api/admin/source-sync/lifecycle-documents/route.ts'); import('./frontend/src/app/(admin)/rag/page.tsx');"` passed.
- `frontend/node_modules/.bin/tsx --tsconfig frontend/tsconfig.json -e "import('./frontend/src/app/(admin)/admin/page.tsx'); import('./frontend/src/app/(admin)/pipeline-health/page.tsx'); import('./frontend/src/app/(admin)/learning-feedback/page.tsx');"` passed.
- `python -m py_compile backend/src/api/admin_endpoints.py` passed.
- Frontend sweep confirms the new visible task-outcome labels and the `/source-sync` launcher path are in place.

## Current Status

- [x] Implementation packet folder created.
- [x] Linear issue created.
- [x] Fireflies ownership map complete.
- [ ] Canonical Fireflies cutover complete.
- [ ] Old Fireflies runtime path fully deleted.
- [ ] Fireflies assignment/task extraction follow-on complete.
