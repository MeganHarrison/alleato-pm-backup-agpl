# Fireflies Current Ownership Map

Status: Current-state implementation artifact
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-848 - https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover

## Related Links

- Implementation task doc: [2026-07-01-rag-pipeline-consolidation-implementation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-implementation-tasks.md)
- Architecture proposal: [2026-07-01-rag-pipeline-consolidation-architecture-proposal.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-architecture-proposal.md)
- Linear issue: [AAI-848](https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover)

## Purpose

Identify the actual current Fireflies runtime owners before cutover so the first migration slice can delete the superseded path immediately after proof.

## Summary

Current Fireflies ownership is split across:

- native Fireflies ingestion logic in [fireflies_pipeline.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/ingestion/fireflies_pipeline.py)
- generic pipeline orchestration in [orchestrator.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/pipeline/orchestrator.py)
- explicit Render cron sync in [run_fireflies_sync.py](/Users/meganharrison/Documents/alleato-pm/backend/scripts/run_fireflies_sync.py)
- manual/admin replay triggers in [admin_endpoints.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/admin_endpoints.py)
- health and readiness reporting in [status/route.ts](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/source-sync/status/route.ts), [source-sync-health-panel.tsx](/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-intelligence/source-sync-health-panel.tsx), and [verify_meeting_vectorization_health.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_meeting_vectorization_health.mjs)

This is the exact ambiguity the cutover needs to remove.

## Current Runtime Owners

### 1. Source ingress and transcript materialization

Current owner:

- [backend/src/api/main.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/main.py)
  - `POST /api/ingest/fireflies/recent`
- [backend/src/services/ingestion/fireflies_pipeline.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/ingestion/fireflies_pipeline.py)
  - `sync_recent_transcripts(...)`
  - `ingest_markdown_text(...)`
  - `_record_fireflies_sync_run(...)`

Current role:

- fetch recent transcript summaries from Fireflies
- fetch full transcript payloads
- build canonical markdown
- upload transcript markdown to storage
- hand the content into the ingestion path
- record `source_sync_runs`

Cutover classification:

- `KEEP LOGIC, REPLACE OWNER`

Reason:

- This file contains the real Fireflies-specific materialization logic and should likely stay as implementation logic.
- It should stop being orchestrated by the in-process scheduler and be invoked by the new canonical workflow boundary instead.

### 2. Generic parse/chunk/embed/extract orchestration

Current owner:

- [backend/src/services/pipeline/orchestrator.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/pipeline/orchestrator.py)
  - `run_full_pipeline(metadata_id)`

Current role:

- choose the Stage 1 parser
- run parser
- run vision
- run embedder
- run extractor
- run intelligence compiler
- mark ingestion jobs as error on failure

Fireflies relevance:

- Fireflies currently flows through this generic pipeline after transcript ingestion.

Cutover classification:

- `REPLACE FOR FIREFLIES BOUNDARY`

Reason:

- This is a shared generic orchestrator.
- It may remain for other source families temporarily, but the Fireflies-first cutover should stop depending on it as the Fireflies orchestration owner.

### 3. Scheduled sync trigger

Current owners:

- [render.yaml](/Users/meganharrison/Documents/alleato-pm/render.yaml)
  - `alleato-fireflies-sync`
- [backend/scripts/run_fireflies_sync.py](/Users/meganharrison/Documents/alleato-pm/backend/scripts/run_fireflies_sync.py)
  - `main(limit=25)`

Current role:

- schedule periodic Fireflies sync
- call the Fireflies-native ingestion pipeline directly
- run the communication-project backfill after sync completes

Cutover classification:

- `KEPT AS EXPLICIT OWNER`

Reason:

- The scheduler-owned Fireflies backlog drain and scheduled sync wrappers were deleted after live proof.
- The dedicated Render cron plus direct script entrypoint is now the single scheduled owner and no longer depends on `scheduler.py`.

### 4. Manual/admin replay and trigger surfaces

Current owners:

- [backend/src/api/admin_endpoints.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/admin_endpoints.py)
  - `POST /documents/replay-stale-raw-ingested`
  - `POST /documents/reprocess-fireflies`
- `frontend/src/app/api/documents/trigger-pipeline/route.ts` (deleted in this slice)
  - former phase-based trigger route using `fireflies_ingestion_jobs`

Current role:

- manually queue stale `raw_ingested` jobs by posting to the canonical Fireflies process endpoint
- previously ran parse/embed/extract phases against Fireflies ingestion jobs from the app; deleted in this slice

Cutover classification:

- `REPLACE, THEN DELETE FIRELIES-SPECIFIC OWNERSHIP`

Reason:

- These routes expose operational recovery, but they are coupled to the old stage model and generic pipeline endpoint.
- The future operator console should replay through the canonical workflow owner instead.

### 5. Verification and health surfaces

Current owners:

- [scripts/verify/verify_meeting_vectorization_health.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_meeting_vectorization_health.mjs)
- [frontend/src/app/api/admin/source-sync/status/route.ts](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/source-sync/status/route.ts)
- [frontend/src/components/ai-intelligence/source-sync-health-panel.tsx](/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-intelligence/source-sync-health-panel.tsx)

Current role:

- verify recent Fireflies vectorization health
- expose Fireflies lifecycle and backlog state to operators

Cutover classification:

- `KEEP AND RETARGET`

Reason:

- These are observability surfaces, not core runtime owners.
- They should read from the new canonical workflow/status model after cutover.

## Current Manual and Script Surfaces

Potential delete or migration candidates:

- `backend/src/scripts/replay_fireflies_jobs_direct.py` (deleted in this slice)
- [backend/src/scripts/refresh_fireflies_transcripts.py](/Users/meganharrison/Documents/alleato-pm/backend/src/scripts/refresh_fireflies_transcripts.py)
- [scripts/backfill-fireflies-transcript-chunks-from-storage.mjs](/Users/meganharrison/Documents/alleato-pm/scripts/backfill-fireflies-transcript-chunks-from-storage.mjs)
- [scripts/verify/verify_fireflies_task_integrity.py](/Users/meganharrison/Documents/alleato-pm/scripts/verify/verify_fireflies_task_integrity.py)

Initial classification:

- replay script: `DELETED AFTER CUTOVER`
- refresh script: evaluate separately; not deleted in this slice
- task integrity verifier: `KEEP FOR FOLLOW-ON TASK-EXTRACTION SLICE`
- chunk-storage backfill script: evaluate separately; likely not part of the steady-state owner

## Keep / Replace / Delete Table

| Surface | Current purpose | Cutover action |
| --- | --- | --- |
| `backend/src/services/ingestion/fireflies_pipeline.py` | Fireflies-specific fetch/materialize/ingest logic | Keep logic, replace orchestration owner |
| `backend/src/services/pipeline/orchestrator.py` | generic parse/embed/extract orchestration | Replace for Fireflies boundary |
| `backend/scripts/run_fireflies_sync.py` + `render.yaml` cron | explicit scheduled Fireflies sync owner | Keep as canonical scheduled owner |
| `backend/src/api/admin_endpoints.py` replay-stale-raw-ingested | manual stale-job replay | Replace with workflow-native replay, then delete Fireflies ownership role |
| `frontend/src/app/api/documents/trigger-pipeline/route.ts` | app-side phase trigger over old stages | Deleted after operator cutover |
| `scripts/verify/verify_meeting_vectorization_health.mjs` | vectorization proof | Keep and retarget |
| admin source-sync UI/routes | operator visibility | Keep and retarget |

## First Delete Candidates After Fireflies Cutover

The first deletion pass should target the exact Fireflies competing runtime owners:

- scheduler-owned Fireflies sync job path in [scheduler.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/scheduler.py) (deleted in this slice)
- scheduler-owned Fireflies backlog drain path in [scheduler.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/scheduler.py) (deleted in the prior deletion slice)
- Fireflies reliance in `frontend/src/app/api/documents/trigger-pipeline/route.ts` (deleted in this slice)
- Fireflies-specific stale replay path in [admin_endpoints.py](/Users/meganharrison/Documents/alleato-pm/backend/src/api/admin_endpoints.py) once replaced by the new owner
- obsolete direct replay scripts once no longer needed for proof or one-off remediation

## Follow-On Decision Boundary

The first cutover boundary should be:

- Fireflies intake
- transcript materialization
- chunking
- embedding
- searchable proof

Do not include project assignment and task extraction in the first boundary if doing so delays deletion of the old Fireflies sync/vectorization owner. That second business-outcome slice should follow immediately after the first cutover.
