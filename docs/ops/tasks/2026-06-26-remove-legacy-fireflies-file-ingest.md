# Task: Remove Legacy Fireflies File Ingest

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-706 - https://linear.app/megankharrison/issue/AAI-706/remove-disabled-legacy-fireflies-file-ingest-route
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Delete the disabled legacy file-based Fireflies ingest route and its
`ENABLE_LEGACY_FIREFLIES_FILE_INGEST` escape hatch after proving the production
Fireflies path is the canonical `/api/ingest/fireflies/recent` sync pipeline.

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

- [x] Prove canonical production Fireflies sync path and schedule.
- [x] Prove legacy route references are limited to route/tests/docs/spec.
- [x] Prove `ingest_file` has no remaining callers outside the legacy route.
- [x] Record all deletion candidates in evidence before removal.
- [x] Delete only candidates with active-path proof.
- [x] Record all retained Fireflies ingestion paths and why they remain.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Legacy route, env flag, and unused service method removed.
- [x] Tests updated to assert canonical recent-sync route and removed legacy route.
- [x] Public API/docs no longer advertise the deleted route/env flag.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All Fireflies trigger entry points use the canonical recent-sync runtime.
- [x] Scheduler/manual route references point at the same pipeline owner.
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
- [x] RAG/meeting verifier run for Fireflies path sanity.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-fireflies-file-ingest-removal-aai-706.md | Complete | Route/caller inventory recorded before deletion and updated with retained paths. |
| Live reference scan | `rg -n 'ENABLE_LEGACY_FIREFLIES_FILE_INGEST\|ingest_file\\(\|class IngestRequest\|@app\\.post\\("/api/ingest/fireflies"\|...` excluding `docs/ops/**` | Pass | No live code/current-doc references remain for the legacy env flag, request model, route decorator, or `ingest_file`. |
| OpenAPI JSON validity | `node -e "JSON.parse(require('fs').readFileSync('frontend/public/openapi.json','utf8')); console.log('openapi json ok')"` | Pass | Public JSON spec parses after removing the stale route entry. |
| Backend compile | `backend/.venv/bin/python -m compileall -q backend/src/api/main.py backend/src/services/ingestion/fireflies_pipeline.py backend/tests/conftest.py backend/tests/test_api_routes.py backend/tests/test_ingestion.py` | Pass | No syntax/import compile errors in changed backend files. |
| Focused backend tests | `backend/.venv/bin/python -m pytest backend/tests/test_api_routes.py backend/tests/test_ingestion.py -q` | Pass | 19 passed. Warnings are existing pytest mark/deprecation warnings. |
| Typecheck | delegated sub-agent: `cd frontend && npm run typecheck:changed` | Pass | No frontend type errors from current changed-file gate. |
| Meeting vectorization verifier | `npm run rag:verify:meetings` | Pass with warning | 75/75 recent meetings have embedded chunks; warning is known direct OpenAI quota, AI Gateway provider probe is OK. |
| Chat architecture verifier | `npm run rag:verify:chat-architecture` | Pass | Final assistant/RAG architecture verifier still passes. |

## Files Changed

- `backend/src/api/main.py`
- `backend/src/services/ingestion/fireflies_pipeline.py`
- `backend/tests/conftest.py`
- `backend/tests/test_api_routes.py`
- `backend/tests/test_ingestion.py`
- `backend/API.md`
- `docs/reference/ENV-VARS.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-fireflies-file-ingest-removal-aai-706.md`
- `frontend/public/openapi.json`
- `frontend/public/openapi.yaml`

## Risks / Gaps

- The checkout contains unrelated dirty frontend files; this slice must stage
  and publish only AAI-706-owned files.
- The broad `docs/` tree is ignored by Git; task/evidence files must be
  force-added when publishing.
- The meeting verifier still warns that direct OpenAI embeddings return quota
  errors. This is not an AAI-706 blocker because AI Gateway is the working
  provider path and the verifier passed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
