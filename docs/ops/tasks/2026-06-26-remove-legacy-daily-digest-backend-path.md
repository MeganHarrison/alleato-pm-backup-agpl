# Task: Remove Legacy Daily Digest Backend Path

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-708 - https://linear.app/megankharrison/issue/AAI-708/remove-disabled-legacy-daily-digest-backend-path
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Delete the disabled backend legacy daily digest generation path and
`LEGACY_DAILY_DIGEST_ENABLED` gate after proving the production executive brief
workflow is owned by the AI Ops executive daily brief runner.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove canonical executive daily brief runner and schedule ownership.
- [x] Prove legacy route/service/script references before deletion.
- [x] Prove retained read-only daily recap route is separate from legacy generation.
- [x] Record deletion candidates in evidence before removal.
- [x] Delete only candidates with active-path proof.
- [x] Record retained executive brief/digest paths and why they remain.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Legacy generation route/env gate removed.
- [x] Legacy scheduler job/wrapper/helper references removed.
- [x] Disabled legacy service/script removed or retained with proof.
- [x] Current docs/verifiers no longer point at deleted paths.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Canonical executive daily brief path remains the only generation owner.
- [x] Scheduler/manual route references no longer expose the legacy generation owner.
- [x] Retained read-only routes still compile.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract/docs guardrail updated for public route surface.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted backend tests run.
- [x] Backend compile check run.
- [x] Relevant executive brief/RAG verifier run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-daily-digest-removal-aai-708.md | Complete | Route/scheduler/service/script inventory recorded before deletion and updated with retained paths. |
| Live reference scan | `rg -n "LEGACY_DAILY_DIGEST_ENABLED\|run_daily_digest\|daily_digest.py\|generate_daily_recap.py\|/api/digests/daily/generate\|..."` | Pass | Only intentional architecture "removed surfaces" text remains. |
| Backend compile | `backend/.venv/bin/python -m compileall -q backend/src/api/main.py backend/src/services/scheduler.py backend/tests/test_scheduler_graph_jobs.py` | Pass | No syntax/import compile errors in changed backend files. |
| Focused backend tests | `backend/.venv/bin/python -m pytest backend/tests/test_scheduler_graph_jobs.py backend/tests/test_api_routes.py -q` | Pass | 27 passed. Warnings are existing FastAPI deprecation warnings. |
| Metadata boundary verifier | `npm run rag:verify:metadata-boundary` | Pass | Removed deleted `daily_digest.py` from the verifier scan list. |
| Typecheck | delegated sub-agent: `cd frontend && npm run typecheck:changed` | Pass | No changed-file frontend type errors. |
| Executive brief gateway verifier | `npm run rag:verify:executive-daily-brief-gateway` | Pass | Canonical executive brief gateway guardrail still passes after backend legacy deletion. |
| Chat architecture verifier | `npm run rag:verify:chat-architecture` | Pass | Final assistant/RAG architecture verifier still passes. |

## Files Changed

- `backend/src/api/main.py`
- `backend/src/services/scheduler.py`
- `backend/src/services/daily_digest.py`
- `backend/scripts/generate_daily_recap.py`
- `backend/tests/test_scheduler_graph_jobs.py`
- `backend/API.md`
- `backend/README.md`
- `scripts/verify/verify_rag_document_metadata_boundary.mjs`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-daily-digest-removal-aai-708.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md`

## Risks / Gaps

- `daily_recaps` remains an active table used by the canonical executive brief
  workflow and the read-only backend daily digest route. This slice must not
  delete read-side history access unless a separate proof says it is obsolete.
- The checkout contains unrelated dirty frontend files; this slice must stage
  and publish only AAI-708-owned files.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
