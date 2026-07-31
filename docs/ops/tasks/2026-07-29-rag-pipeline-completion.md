# Task: Complete and Production-Verify the Eve RAG Pipeline

Status: In Progress
Owner: S20260729-RAGDEPLOY
Created: 2026-07-29
Task ID: AAI-1280
Linear Issue: [AAI-1280](https://linear.app/megankharrison/issue/AAI-1280/complete-and-production-verify-the-eve-rag-pipeline)
Related Handoff: `docs/ops/handoffs/2026-07-29-S20260729-RAGFINAL-rag-pipeline-completion.md`

## Objective

Make the Eve-only RAG system operational and verifiably better than the retired
assistant pipeline, with live proof from source acquisition through retrieval
and citations.

## Scope

- Source acquisition health for Fireflies, Outlook/SharePoint, and Teams.
- Vercel Workflow durable document ordering and FastAPI stage adapters.
- AI Gateway provider health, chunk/vector integrity, project authorization,
  retrieval quality, citations, and Eve consumption.
- Secret-safe Render cron audit/reconciliation and migrated verification
  guardrails.
- Final architecture/report documentation with an exact file tree.
- Excludes ASRS FMDS retrieval, which remains a deliberately separate runtime
  and corpus.

## Source of Truth

- Canonical runtime/data owners:
  - Eve: `agents/alleato-assistant/**`
  - Durable ordering/retry: `frontend/src/lib/rag-pipeline/process-document-workflow.ts`
  - Stage execution: `backend/src/services/pipeline/**`
  - Retrieval: `frontend/src/lib/ai/tools/read/rag-search-tools.ts`
  - Source schedules: live Render services, compared with `render.yaml`
  - Operational/vector state: PM Supabase plus RAG Supabase
- Existing shared primitives/services:
  `frontend/src/lib/ai/tools/guardrails.ts`,
  `scripts/verify/verify_source_control_plane_health.mjs`,
  `scripts/verify/verify_rag_chunk_integrity.mjs`
- Deprecated or parallel paths:
  deleted Next.js generation runtime, stale verifier references to the
  pre-split `operational.ts` implementation, and dormant database-trigger
  compatibility ingress.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Eve is the sole assistant generation owner and the guardrail passes.
- [ ] Live source acquisition owners are present, configured, unsuspended, and
      have a recent successful run.
- [x] One real source item completes canonical processing and produces readable
      embedded chunks.
- [x] Retrieval returns authorized, source-attributed evidence with citations.
- [x] Permission filters cover project, Business Area, communication, and
      leadership restrictions after the Eve migration.
- [x] AI Gateway is configured and a provider probe succeeds without exposing
      credentials.
- [x] Failures name the owner, stage, and actionable recovery.
- [x] Legacy or duplicate paths are removed or explicitly documented as
      compatibility-only.
- [x] Final report contains the implementation tree, improvements, benefits,
      verification evidence, and remaining limitations.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Provider, authentication, permission, and deployment contracts are
      handled without printing secrets.

Owned files:

- `scripts/verify/verify_rag_retrieval_contract.mjs`
- `scripts/verify/verify_render_rag_cron_health.mjs`
- `scripts/ops/reconcile-render-rag-crons.mjs`
- `.github/workflows/rag-pipeline-ops.yml`
- `package.json`
- `docs/architecture/RAG-PIPELINE-OWNERSHIP.md`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/architecture/AI-ASSISTANT-FUNCTIONALITY.md`
- `backend/src/services/agents/app_expert/runtime/help/articles/*.mdx`
- `backend/src/services/agents/app_expert/runtime/generated/*.json`
- `frontend/src/lib/rag-pipeline/**`
- `frontend/src/app/api/rag-pipeline/process/route.ts`
- `backend/src/api/main.py`
- `backend/src/services/pipeline/{stage_runner,workflow_client}.py`
- `scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs`
- this task, its handoff, and the final report

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Independent review is recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: source-family and stage-specific status, Render
  suspension/configuration mismatch, provider error classification, or
  retrieval authorization failure.
- Detection path: `rag:verify:render-crons`, `rag:verify:control-plane`,
  `rag:verify:retrieval-contract`, `rag:verify:chunk-integrity`, and the
  production Eve flow.
- Recovery path: reconcile only the named Render source cron, replay the named
  document through canonical workflow ingress, or correct the named retrieval
  permission boundary.

## Incident Learning

- Failure fingerprint: `operations.provider-runtime-drift`
- Root cause: Source acquisition has no live cron-state verifier in the normal
  RAG verification chain, and the retrieval contract remained coupled to a
  module path that changed during the Eve migration.
- Detection gap: Staleness was visible in data, but the verifier could not say
  whether the owning Render cron was suspended; retrieval verification checked
  source text in the wrong module.
- Prevention: Add live Render owner verification/reconciliation and bind the
  retrieval guardrail to the canonical split retrieval module plus behavioral
  tests.
- Guardrail evidence: `scripts/verify/verify_render_rag_cron_health.mjs`,
  `scripts/ops/reconcile-render-rag-crons.mjs`,
  `scripts/verify/__tests__/rag-workflow-ownership-contract.test.mjs`, and the
  real-record traces recorded in this task.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Eve sole owner | `npm run verify:eve-only-runtime` | Pass | Canonical Eve runtime only. |
| Chunk integrity | `npm run rag:verify:chunk-integrity` | Pass | Zero missing embeddings across all counted source families. |
| Source control plane | recent run ledger plus bounded source syncs | Partial | Fireflies, Microsoft Graph reconciliation, Teams DM export, and Graph downstream recorded successful runs on 2026-07-29. Authenticated Render suspension/configuration readback remains unavailable. |
| Retrieval contract | `npm run rag:verify:retrieval-contract` | Pass | Project-scoped and source-filtered retrieval returned eight results with metadata references; verifier now targets `read/rag-search-tools.ts`. |
| Render AI health | `npm run rag:verify:render-ai` | Partial | Backend healthy and AI Gateway configured; local balance probe lacks secure token. |
| Eve and capability documentation | `docs/architecture/AI-ASSISTANT-FUNCTIONALITY.md` registry comparison | Pass | All 131 canonical tools are documented; 79 current reads and 52 unavailable write/delivery functions are distinguished. |
| App Expert artifacts | `node scripts/docs/generate-app-expert-artifacts.mjs` | Pass | 364 routes/features regenerated; no deleted `frontend/src/app/(main)/ai-assistant` route remains. |
| Eve-only runtime regression | `npm run verify:eve-only-runtime` | Pass | One canonical generation owner; no retired runtime owners or registry scaffolding. |
| Workflow ownership regression | `npm run test:rag:workflow-ownership` | Pass | Seven focused assertions cover exact stage order, durable start/run ID, ingress/stage authentication, retry classification, compatibility delegation, and source-specific one-stage execution. |
| Compatibility ingress security | `backend/src/api/main.py` | Pass in repository | `/api/pipeline/process` now requires `ADMIN_API_KEY`, delegates only to Workflow, and no longer claims to execute stages in-process. |
| Incremental source acquisition | local `run_graph_sync(..., run_embedding=False, run_ocr=False)` | Pass | 21 Outlook plus 33 Teams-DM records, 54 total, zero errors in 133.9 seconds; document processing remained disabled during acquisition. |
| New Outlook stage trace | document source `outlook_email`, project 178 | Pass | Persisted Graph alias recognized; parse and extract skipped, vision returned `not a PDF`, Gateway embed produced one appropriate chunk for 1,810 characters. |
| SharePoint stage-purity trace | project 34 SharePoint PDF | Pass | Workflow-owned vision analyzed 7 pages; isolated embed completed in 3.34 seconds and persisted 3 text plus 7 vision-page chunks without invoking vision internally. |
| New-record retrieval | `npm run rag:verify:retrieval-contract` | Pass | The newly acquired Outlook record was the top project-178 result; 8 results, 8 source-filtered, 7 metadata references, permission guards passed. |
| Independent documentation review | separate Codex reviewer, 2026-07-29 | Pass after rework | Reviewer rejected three inaccurate tree paths; corrected report passed an exact path-existence sweep and was approved for publication. |
| Obsolete AI docs verifier | `npm run docs:verify:ai-agent-tools` | Unrelated failure | Expects deleted/missing `docs/alleato-os-docs/developer-docs/agent-tools/agent_tools.md` and `docs/alleato-os-docs/docs.json`; it does not validate the App Expert runtime help corpus. |

## Remaining Risk

- Live Render cron state and safe resume decision still require the GitHub-held
  `RENDER_API_KEY`.
- The canonical production repository and live deployments do not yet contain
  this backup repository's Eve/Workflow cutover.
- All audited operator callers now send `ADMIN_API_KEY`; focused caller-auth
  regression coverage passes.
- The source-to-scoped-retrieval trace now passes locally against live data;
  deployed Vercel Workflow and visible Eve citation proof remain open.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and
      next action.
