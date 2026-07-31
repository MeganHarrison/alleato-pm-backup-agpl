# Task: Cut the RAG Pipeline Over to the Canonical Durable Workflow

Status: Complete
Owner: S20260729-RAGCANON
Created: 2026-07-29
Task ID: AAI-1280-RAG-CANON
Linear Issue: AAI-1280
Related Handoff: `docs/ops/handoffs/2026-07-29-S20260729-RAGCANON-rag-workflow-production-cutover.md`

## Objective

Make the canonical production repository and deployed application use Vercel
Workflow as the only durable owner of document-processing order and retry,
with authenticated single-stage execution on Render and no legacy in-process
orchestrator.

## Scope

- Vercel Workflow ingress, enqueue client, and five-stage workflow
- Authenticated FastAPI compatibility ingress and stage callbacks
- Fireflies, Microsoft Graph, URL, upload, and operator callers
- Removal of the Python orchestration/digest/reprocessing owners
- Focused source, behavior, deployment, and end-to-end verification

## Source of Truth

- Durable ordering/retry:
  `frontend/src/lib/rag-pipeline/process-document-workflow.ts`
- Frontend ingress:
  `frontend/src/app/api/rag-pipeline/process/route.ts`
- Backend enqueue:
  `backend/src/services/pipeline/workflow_client.py`
- Single-stage execution:
  `backend/src/services/pipeline/stage_runner.py`
- Retired owners:
  `backend/src/services/pipeline/orchestrator.py`,
  `backend/src/services/pipeline/digest.py`, and
  `backend/src/services/ingestion/fireflies_reprocessing.py`

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Workflow owns exactly `load → parse → vision → embed → extract`.
- [x] FastAPI compatibility ingress authenticates and only enqueues.
- [x] FastAPI stage callback authenticates and runs exactly one named stage.
- [x] Fireflies, Graph scheduled processing, URLs, uploads, and operator callers
      enqueue the durable workflow.
- [x] Legacy Python ordering/reprocessing owners are deleted.
- [x] Missing configuration, caller auth, zero-chunk embedding, enqueue
      rejection, and stage failure surface specific errors.
- [x] Workflow enqueue prefers its scoped secret and can use the existing
      server-only admin credential when the scoped Render variable is absent.
- [x] Focused Python and Node regression tests pass.
- [x] Source-freshness verifier uses the PM database for source state and the
      dedicated RAG database for health snapshots and chunk coverage.
- [x] Canonical Vercel deployment is `READY` with required environment.
- [x] Canonical Render deployment exposes the authenticated stage route.
- [x] One controlled production record completes all five stages and is
      retrieved with source/citation evidence.
- [x] Source-freshness guard is healthy or every remaining degraded source has
      an explicit repair result.

## Implementation Checklist

- [x] Claimed exact paths before editing.
- [x] Reused Vercel Workflow and existing FastAPI stage implementations.
- [x] Removed duplicate ordering and hidden vision execution.
- [x] Prevented normalized Outlook/Teams communications from entering the
      document-vision provider while preserving vision for Graph documents.
- [x] Added caller-auth, workflow-ownership, stage-runner, workflow-client, and
      Graph queue-order regression tests.
- [x] Preserved explicit OCR/source adapters and shared provider transport.

## Integration and Verification

- [x] `npm run test:rag:workflow-ownership`
- [x] `node --test scripts/verify/__tests__/rag-pipeline-callers-auth-contract.test.mjs`
- [x] Focused backend tests: 29 passed, 1 platform skip.
- [x] `render.yaml` parses as YAML.
- [x] Python compile and `git diff --check` pass.
- [x] Deployed Vercel/Render readback captured.
- [x] Live source-to-citation evidence captured.
- [x] Independent review approved.
- [x] Task-owned files published through exact-file publication receipts.

## Failure-Loudly Contract

- Cause surfaced as: specific missing environment, unauthorized ingress,
  permanent stage failure, retryable stage failure, zero-chunk result, or
  missing Workflow `runId`.
- Detection path: Workflow run events, Render stage response/log, source
  processing status, and source-freshness guard.
- Recovery path: correct configuration or source data and replay the exact
  document through the compatibility ingress; never restart a second
  in-process orchestrator.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the durable migration was implemented in a backup repository
  while canonical production remained on the deleted in-process owner.
- Detection gap: source publication and deployed route readback were not part
  of the earlier completion claim.
- Prevention: ownership contract tests, authenticated caller tests, canonical
  repository publication, and live route/source-to-citation proof are now one
  acceptance contract.
- Guardrail evidence:
  `scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Workflow ownership | `npm run test:rag:workflow-ownership` | Pass | 11/11 |
| Caller auth | caller auth contract test | Pass | 4/4 |
| Backend behavior | focused pytest command | Pass | 29 passed, 1 Windows-only SIGALRM skip |
| Boundary unit tests | `test_pipeline_stage_runner.py`, `test_pipeline_workflow_client.py` | Pass | stage isolation, auth, enqueue, and missing-run-ID cases |
| Backend ownership docs | `backend/README.md`, `backend/API.md` | Pass | Eve, Workflow, FastAPI, BYOK, and provider boundaries documented |
| Stub trigger documentation | meeting-item task route comment | Pass | removed references to the deleted Python orchestrator |
| Render config | PyYAML parse | Pass | 21 services |
| Legacy reference search | targeted `rg` | Pass | no live references to removed owners |
| Source freshness verifier | focused pytest + live read-only run | Pass | 4/4 regression tests; real RAG coverage is healthy and degraded upstream sources now exit nonzero |
| Workflow credential compatibility | focused pytest + ownership contract | Pass | scoped secret remains preferred; server admin fallback is authenticated with constant-time comparison; stable production URL fallback prevents Render URL-env drift; 5/5 focused tests |
| Graph stage classification | focused stage-runner pytest | Pass | normalized communications skip parse, vision, and extract but still use the Graph embedder; SharePoint documents retain explicit vision |
| Dual metadata load | live stage probe + focused pytest | Pass | PM lookup uses `file_path`; missing PM rows fall back to RAG `storage_path` and map it explicitly; query failures are no longer swallowed as missing rows |
| Vercel build memory | deployment logs + source contract | Pass | enhanced machine, 11-GB heap, and disabled non-reusable Webpack cache completed the production build |
| Deployment | Vercel + Render readback | Pass | deployment `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb` is `READY` on exact commit `17c7b78e`; Render stage callbacks are live |
| End to end | controlled production record | Pass | run `wrun_01KYR3MKXQEHC80QFCB56TSD5F` completed five ordered steps on attempt one; five embedded chunks persisted; scoped retrieval similarity `1.0` |
| Configuration probe | authenticated Render URL ingestion | Pass after loud failure | missing URL override first failed before data creation; tested stable production URL fallback repaired the boundary and the replay queued a durable run |
| Vercel build | canonical production deployment | Pass | Workflow compiled 13 steps and 2 workflows; Next build and deployment completed |
| RAG chunk coverage | live dual-database verifier | Pass | email 14,086; Teams 36,007; meeting transcript 32,155; segment summary 14,133; meeting summary 4,201 |
| Source-health recompute | authenticated Render recompute | Degraded, classified | recompute completed, wrote 25 snapshots and routed 1 alert; remaining critical inputs are 78 stale Teams resources, 1 Microsoft Graph resource, and 1 Acumatica resource |

## Remaining Risk

- The corrected freshness guard reports real stale/error states for upstream
  Graph, Fireflies, Teams, and Acumatica snapshots. It no longer hides these
  behind false zero-chunk results or a successful JSON-mode exit code.
- Upstream repair results are explicit: Teams contains historical/stale
  resources requiring subscription/cursor retirement or resync; Microsoft
  Graph is four hours stale and requires its scheduled sync; Acumatica is
  blocked by the provider's missing payment-application GI/endpoint. None has
  an embedding backlog in the recomputed source-health payload, so these are
  acquisition/provider issues rather than a failed vector pipeline.

## Final Status

- [x] All required checklist items are complete.
- [x] Deployment and end-to-end evidence are filled in.
- [x] Failure behavior and prevention are explicit.
- [x] Independent review is attached.
