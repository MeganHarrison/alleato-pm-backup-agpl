# Task: Publish the AI Assistant Functionality Reference

Status: Complete
Owner: S20260729-AIDOCS
Created: 2026-07-29
Task ID: AAI-1280-AI-DOCS
Linear Issue: AAI-1280
Related Handoff: N/A — single-session documentation checkpoint

## Objective

Publish one exhaustive functionality catalog and aligned ownership references
that clearly distinguish live Eve behavior, adjacent application AI features,
blocked mutations, RAG ownership, and remaining production work.

## Scope

- `docs/architecture/AI-ASSISTANT-FUNCTIONALITY.md`
- `docs/architecture/AI-ASSISTANT-FUNCTIONALITY-CATALOG.md`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/architecture/RAG-PIPELINE-OWNERSHIP.md`
- `docs/architecture/RAG-PIPELINE-FINAL-REPORT.md`
- No product runtime, schema, provider, or deployment changes

## Source of Truth

- Canonical assistant runtime: `agents/alleato-assistant/**`
- Authenticated bridge: `frontend/src/app/api/ai-assistant/eve/**`
- Tool registry: `frontend/src/lib/ai/eve-runtime/production-tool-registry.ts`
- Durable RAG owner: `frontend/src/lib/rag-pipeline/process-document-workflow.ts`
- Stage execution: `backend/src/services/pipeline/stage_runner.py`
- Retired generator paths: `/api/ai-assistant/chat`,
  `frontend/src/lib/ai/agents/**`, `orchestrator.ts`, and `bot-core.ts`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every assistant surface and capability class is explained.
- [x] Every current read tool is grouped and described.
- [x] Registered writes and external-delivery tools are clearly labeled blocked.
- [x] Eve, ingestion, Workflow, FastAPI, Supabase, and intelligence ownership are explicit.
- [x] Legacy paths and misleading claims are identified.
- [x] Deployed Eve proof and completed Render/RAG production proof are recorded.

## Integration and Verification

- [x] Documentation links resolve to tracked files.
- [x] Stale authentication-failure claims are removed.
- [x] Latest Vercel production deployment is read back as `READY`.
- [x] Markdown and repository diff checks pass.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: a named capability carries an explicit status and owner.
- Detection path: search the catalog for the capability, route, tool, or owner.
- Recovery path: update the catalog and ownership reference in the same change
  as any future runtime/tool-registry change.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: deployment and runtime changes landed after the catalog snapshot.
- Detection gap: the documentation was not refreshed after the deployed Eve
  authentication lifecycle was repaired.
- Prevention: keep deployment evidence and the exhaustive catalog in the same
  closeout checklist for assistant/RAG changes.
- Guardrail evidence: stale claims were found by targeted status-term searches
  and corrected before publication.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Latest deployment | Vercel deployment readback | Pass | `dpl_kF3Cp1hELMMzet6r8cuuzbR8LKyb`, `READY`, canonical commit `17c7b78eac63d81a004ce671da800d898d364f4a` |
| Auth lifecycle | Production lifecycle script evidence | Pass | start `202`, stream `200`, terminal `completed`, cleanup complete |
| Durable RAG run | Workflow inspector | Pass | `wrun_01KYR3MKXQEHC80QFCB56TSD5F`, five ordered stages completed on attempt one |
| Stored vectors | Production RAG readback | Pass | five chunks, embedded status, project `67`, source URL/title retained |
| Scoped retrieval | `search_document_chunks` | Pass | controlled document ranked first at similarity/vector score `1.0` |
| Stale-claim search | `rg` over five architecture documents | Pass | no remaining claim that canonical stage routes or deployment are missing |
| Formatting | `git diff --check` | Pass | no whitespace errors |

## Remaining Risk

- Scheduled source-health gaps remain and are explicitly labeled degraded.
- Eve write and external-delivery tools remain intentionally blocked.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded in this task.
- [x] Deferred work names its owner and next action.
