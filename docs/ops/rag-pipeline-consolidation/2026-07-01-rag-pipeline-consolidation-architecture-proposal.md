# RAG Pipeline Consolidation Proposal

Status: Proposed before implementation
Owner: Codex
Created: 2026-07-01
Applies to: Fireflies, Microsoft Graph, SharePoint, uploaded documents, OCR, chunking, embeddings, project assignment, task extraction, and operator reporting

## Related Links

- Linear issue: [AAI-848](https://linear.app/megankharrison/issue/AAI-848/implement-rag-pipeline-consolidation-with-fireflies-first-cutover)
- Proposal task doc: [2026-07-01-rag-pipeline-consolidation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-tasks.md)
- Implementation task doc: [2026-07-01-rag-pipeline-consolidation-implementation-tasks.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-rag-pipeline-consolidation-implementation-tasks.md)
- Fireflies ownership map: [2026-07-01-fireflies-current-ownership-map.md](/Users/meganharrison/Documents/alleato-pm/docs/ops/rag-pipeline-consolidation/2026-07-01-fireflies-current-ownership-map.md)
- Authoritative current-state architecture: [AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md](/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md)

## Executive Summary

The current RAG/data pipeline is difficult to operate because runtime ownership is split across too many paths:

- in-process scheduling in `backend/src/services/scheduler.py`
- source-specific ingestion code paths
- manual/admin re-drive routes
- source health verification scripts
- frontend admin surfaces that report health but do not define a single pipeline owner

The result is high troubleshooting cost, repeated architecture rediscovery, and low operator trust. The problem is not just provider instability. The problem is that the system does not have one clearly enforced orchestration boundary.

## Recommendation

Adopt one production orchestration model for the AI/RAG pipeline:

1. Vercel Functions for ingress only
2. Vercel Queues for source intake and decoupled background dispatch
3. Vercel Workflows as the only durable orchestration owner
4. Vercel Cron for reconciliation, stale-job repair, and health sweeps only
5. Supabase remains the source of truth for product data, pipeline status, document metadata, chunks, task outcomes, and operator-facing ledgers

Do not adopt `eve` as the first move. `eve` can become a later phase if Alleato wants an ops or workflow agent on top of the consolidated pipeline. It should not be the first fix for pipeline ownership confusion.

## Root Cause

The current repo already contains good building blocks, but they are not governed by one operational contract:

- The authoritative architecture doc already states one production architecture in [AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md](/Users/meganharrison/Documents/alleato-pm/docs/architecture/AI-DATA-PIPELINE-RAG-PRODUCTION-ARCHITECTURE.md).
- The live scheduler still owns multiple independent background concerns in [scheduler.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/scheduler.py).
- Admin reporting already exposes lifecycle concepts such as `synced`, `vectorized`, `projectAssigned`, `tasksExtracted`, and `projectIntelligenceUpdated` in [source-sync/page.tsx](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(admin)/source-sync/page.tsx), [source-sync-health-panel.tsx](/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-intelligence/source-sync-health-panel.tsx), and [_contracts.ts](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/source-sync/_contracts.ts).
- Source-specific ingestion still enters through multiple runtime seams, such as [url_resource_ingestion.py](/Users/meganharrison/Documents/alleato-pm/backend/src/services/url_resource_ingestion.py) calling `run_full_pipeline(...)` directly.

The missing piece is a single enforced owner for the lifecycle after a source record arrives.

## Target Operating Principles

### One workflow owner

Every eligible source record must enter the same orchestration boundary after normalization. No source is allowed to own its own separate parse/chunk/embed/assign/extract pipeline.

### No archived pipeline code in the main repository

If a path is retired, it must be:

- deleted from the active repository, or
- moved to an external archive repository or artifact bundle outside the main repo

Do not keep “archived,” “old,” “backup,” “legacy-but-maybe,” or “disabled” pipeline implementations in the main codebase. The main repo must contain one production implementation only.

### Fail loudly

If a stage fails, the status must be visible in:

- the workflow run
- the pipeline ledger row
- the document detail view
- the operator queue

No silent fallbacks, no empty-state lies, and no “looks green unless you inspect three tables manually.”

### Business-state observability, not just runtime logs

The operator question is not “did a function run?” It is:

- did the source sync?
- did it parse?
- did it chunk?
- did it embed?
- did it assign the right project?
- did it extract tasks?
- were those tasks correct enough to approve quickly?

Vercel gives runtime observability. Alleato still needs product-level ledgers and operator pages.

## Proposed Runtime Topology

### 1. Vercel Functions: ingress only

Functions should acknowledge or validate source events quickly, then enqueue canonical work.

Examples:

- Fireflies transcript available
- Graph webhook received
- SharePoint file changed
- upload completed
- URL resource requested
- admin manual re-drive requested

Functions must not do heavy OCR, chunking, embedding, assignment, or extraction inline.

### 2. Vercel Queues: source intake

Queues should absorb bursty source events and decouple ingress from processing.

Suggested event families:

- `document-arrived`
- `document-reprocess-requested`
- `source-reconcile-requested`
- `task-review-refresh-requested`

Payloads should stay small and point to canonical ids, not entire documents.

### 3. Vercel Workflows: canonical lifecycle owner

One workflow should own the full lifecycle for a document-like record:

`processDocumentWorkflow(documentId, sourceType, projectHint?)`

Suggested durable stages:

1. load canonical metadata
2. fetch or materialize canonical source artifact
3. parse or OCR
4. normalize content
5. classify eligibility and terminal exclusions
6. chunk
7. embed
8. assign project
9. extract tasks and signals
10. promote product-facing outcomes
11. finalize pipeline status

This workflow becomes the only place where retry, backoff, pause, resume, and stuck-stage ownership lives.

### 4. Vercel Cron: reconciliation and repair only

Cron should be used for:

- subscription renewal
- missed-event reconciliation
- stale-job detection
- bounded replay of stuck work
- daily/periodic operator summaries

Cron should not become a second orchestration model.

### 5. Supabase: canonical ledgers and product state

Keep Supabase as source of truth for:

- `rag_document_metadata`
- `document_chunks`
- `source_sync_runs`
- `source_signal_candidates`
- `insight_cards`
- task rows and review outcomes
- operator-facing status ledgers

Workflow state is orchestration state, not the business database.

## Canonical Status Model

The current lifecycle model in [_contracts.ts](/Users/meganharrison/Documents/alleato-pm/frontend/src/app/api/admin/source-sync/_contracts.ts) is close to the right abstraction. Keep the stage language and tighten ownership.

Recommended canonical stages:

- `queued`
- `fetched`
- `parsed`
- `vectorized`
- `projectAssigned`
- `tasksExtracted`
- `projectIntelligenceUpdated`
- `completed`
- `failed`
- `failedPermanent`

Required per-document fields:

- `document_id`
- `source_type`
- `source_item_id`
- `workflow_run_id`
- `status`
- `current_stage`
- `last_error_code`
- `last_error_message`
- `retry_count`
- `next_retry_at`
- `content_hash`
- `chunk_count`
- `embedded_chunk_count`
- `assigned_project_id`
- `task_extraction_status`
- `task_count`
- `operator_review_status`
- `updated_at`

## Frontend Operator Console

The current admin pages prove there is already enough reporting data to build a better operator workflow. Keep the shared data contract direction, but reorganize the experience around a single operator job:

### A. Pipeline Runs

Purpose: answer “is the system working right now?”

Columns:

- source
- resource name
- current stage
- status
- last success
- last error
- retry count
- stuck age
- workflow run id

Actions:

- retry
- open detail
- mark false positive
- inspect raw error

### B. Document Lifecycle Detail

Purpose: answer “what happened to this exact thing?”

Required sections:

- source metadata
- source artifact link
- parsed-content preview
- chunk count
- embedding state
- assigned project and confidence
- extracted tasks preview
- intelligence/signal outcomes
- stage timeline
- last errors and retries

### C. Task Extraction Review Queue

Purpose: answer “are the extracted tasks any good?”

Required actions:

- approve task set
- edit task
- reject task
- mark wrong project
- rerun extraction
- leave fast feedback note

This is the fastest path to product trust because it turns extraction from a hidden side effect into an explicit operator workflow.

### D. Lifecycle Matrix

The existing lifecycle matrix and health page are useful, but they should become summary views on top of the canonical workflow ledger, not separate quasi-owners of pipeline truth.

## Repo Simplification Impact For Codex / Claude Code

Moving orchestration to Vercel will not automatically stop agents from scanning large parts of the repo.

It will improve agent efficiency only if implementation follows these rules:

1. one canonical ingestion entrypoint per source type
2. one canonical workflow file for lifecycle ownership
3. one status contract
4. one operator reporting surface
5. deletion of duplicate and retired code paths from the main repo

If those rules hold, troubleshooting changes from “scan the repo to discover the live path” to “inspect the workflow, the status ledger, and the operator view.”

That is the real visibility win.

## What To Keep

- The lifecycle semantics already exposed by the admin source-sync contract
- The PM App / AI-RAG database split
- Existing product tables that store real task or intelligence outcomes
- Existing operator-facing admin route family as the future UI home

## What To Replace

- in-process multi-owner orchestration in `backend/src/services/scheduler.py`
- direct source-to-pipeline calls that bypass a canonical queued workflow owner
- source-specific retry/replay logic spread across multiple runtime layers
- any repo-retained archived pipeline implementations

## What To Delete After Cutover

Delete, do not archive in the main repo:

- retired scheduler-owned pipeline stages once the Vercel workflow owns them
- old replay scripts that target deprecated runtime paths
- dead worker references
- compatibility writers that no longer serve a live route
- duplicate source-specific parse/embed/extract loops

If preservation is necessary for legal or forensic reasons, move them to:

- a separate archive repository, or
- a dated artifact bundle outside the main repo

## Migration Order

### Slice 1: Canonical pipeline contract and operator ledger

Before moving any runtime, define:

- one workflow contract
- one status schema
- one operator review schema
- one cutover registry naming current owners and future owners

### Slice 2: Frontend operator console

Build the human-readable reporting and fast feedback loop first. This creates operational clarity before or during migration.

### Slice 3: Migrate one source family first

Start with the source causing the most operational pain and repeated backfills. Based on recent repo history, Fireflies and Microsoft Graph-derived communications are the highest-value candidates.

### Slice 4: Remove old runtime owner for that source

Do not leave the old path in place “just in case.” Cut over, verify, then delete.

### Slice 5: Expand source by source

Move SharePoint/documents/uploads onto the same orchestration model.

### Slice 6: Final cleanup

Remove the old scheduler-owned orchestration logic that no longer has active responsibilities.

## Cutover Rule

For each migrated source family:

- old path disabled
- new path enabled
- live proof collected
- old path deleted from the main repository

No dual-write runtime period should last longer than strictly necessary for proof.

## Explicit Non-Goals

- Do not move the whole product backend to Vercel in one shot.
- Do not treat `eve` adoption as the same thing as pipeline consolidation.
- Do not build another monitoring surface that only restyles the current ambiguity.
- Do not keep multiple dormant implementations in the repo for comfort.

## Recommended Implementation Starting Point

Implement first:

1. canonical workflow contract
2. operator console
3. one source-family cutover
4. hard deletion of the superseded path

That sequence gives the fastest improvement in operator trust, engineering clarity, and AI-agent troubleshooting cost.
