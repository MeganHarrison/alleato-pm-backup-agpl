# Handoff: Canonical RAG Workflow Production Cutover

Status: In Progress
Session: S20260729-RAGCANON
Task: AAI-1280-RAG-CANON
Date: 2026-07-29

## Ownership

Vercel Workflow is the only durable order/retry owner. FastAPI owns individual
stage execution. Source adapters own acquisition and initial persistence.
Supabase owns records/vectors. Eve consumes retrieval and does not own
ingestion.

## Implemented

- Added authenticated Workflow ingress and enqueue client.
- Added ordered five-stage Workflow.
- Added authenticated FastAPI stage callback and compatibility enqueue route.
- Migrated Fireflies, Graph scheduled downstream processing, URLs, uploads,
  batch scripts, and repair callers.
- Deleted the Python orchestrator, digest, and Fireflies reprocessor.
- Removed hidden vision execution from the Graph embedding stage.
- Moved stale Fireflies replay to the durable Workflow client and recorded
  each returned run ID.
- Added fail-loud ownership, caller-auth, stage-runner, workflow-client, and
  Graph queue-order tests.
- Corrected the source-freshness verifier for the PM/RAG database split and
  made JSON-mode failures return a nonzero process exit.
- Added a server-only enqueue credential fallback: the scoped Workflow secret
  remains preferred, while the already-shared admin key prevents missing
  Render control-plane access from blocking ingestion.
- Corrected vision-stage classification so normalized Outlook/Teams
  communications skip vision while Graph documents still use the explicit
  vision stage.
- Localized Vercel OOM behavior and removed cold-build Webpack cache
  serialization, which had no reuse path because the production wrapper clears
  `.next` before each attempt.
- Repaired dual metadata loading after the live stage probe exposed the RAG
  mirror's `storage_path`/`file_path` schema difference.
- Ran the authenticated source-health recompute: 25 snapshots updated and one
  alert routed. Remaining degradation is explicitly classified as stale
  Teams/Graph acquisition and the known Acumatica GI gap, with no embedding or
  compiler backlog in the recomputed payload.

## Verification

- Node ownership tests: 8 passed.
- Caller authentication tests: 4 passed.
- Focused backend tests: 29 passed, 1 skipped because Windows has no SIGALRM.
- `render.yaml`: valid YAML, 21 services.
- Python compile and `git diff --check`: pass.

## Deployment Evidence

- Canonical publication: pass through exact-file publication receipts.
- Render health and route deployment: pass.
- Render route authentication: pass (`401` without credentials).
- Shared Workflow configuration: pass; scoped secret preferred, authenticated
  server key fallback available, and optional URL drift covered.
- Vercel variables were applied. The first build then exposed a separate
  Workflow/Turbopack conflict: `@ai-sdk/openai` was server-externalized. That
  entry is removed and protected by a source contract.
- Controlled source-to-citation trace: pass for the bounded URL source.
- Live RAG chunk coverage is healthy across email, Teams, meeting transcript,
  meeting segment summary, and meeting summary sources.
- Enhanced build capacity, an 11-GB heap, and disabled cold Webpack cache
  completed exact-source deployment `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb`.

## Failure Evidence

The prior missing Render route is repaired. A missing optional workflow URL
failed loudly before data creation; the tested stable production fallback
repaired the boundary. The replay completed all five Workflow stages and
project-scoped retrieval returned the source at similarity `1.0`.

## Next Actions

1. Repair stale Teams and Graph acquisition owners.
2. Resolve the Acumatica provider GI/endpoint gap.
3. Repeat bounded per-source traces when those acquisition paths change.
5. Verify chunks, retrieval scope, and citation.
6. Run source freshness and close only when the acceptance contract passes.
