# Task: Retire Pipeline A Insight Stubs

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-751 - https://linear.app/megankharrison/issue/AAI-751/retire-backend-pipeline-a-insight-stubs-from-rag-chat-and-fireflies
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Remove deprecated Pipeline A insight compatibility stubs from active backend
RAG chat, project detail, and Fireflies ingestion paths. The final production
architecture must not call no-op legacy writers or expose inert legacy response
fields as if they are active workflow output.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with
evidence filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove current import/reference surface before deletion.
- [x] Prove route/API reachability before deletion.
- [x] Prove provider schedule/cron/job ownership before deletion.
- [x] Prove database-write ownership before deletion.
- [x] Delete only candidates with active-path proof.
- [x] Record retained replacement paths before deletion.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Backend chat reply no longer calls legacy insight reader.
- [x] Backend project detail endpoint no longer calls legacy insight reader.
- [x] Fireflies ingestion no longer calls legacy insight writer.
- [x] Deprecated no-op insight helper methods removed from `SupabaseRagStore`.
- [x] Backend tests updated to assert the final contract.
- [x] Public OpenAPI docs updated if response shape changes.
- [x] Progress ledger updated.
- [x] Errors remain specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Canonical insight/intelligence ownership remains `insight_cards`,
      `source_signal_candidates`, and intelligence packets.
- [x] RAG chat remains grounded by chunks, tasks, project context, and financial
      rows; no inert legacy field remains.
- [x] Fireflies ingestion still writes chunks, metadata, tasks, and AI memories.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves deleted helper names no longer exist in active backend
      source except historical/proof docs.
- [x] Focused backend API tests pass.
- [x] Focused Fireflies ingestion tests pass or targeted compile proves the
      ingestion module loads after the call removal.
- [x] Changed-file typecheck/checks are delegated to a subagent where relevant.

## Verification Checklist

- [x] Static/lint check run, or explicitly delegated.
- [x] Targeted backend tests run.
- [x] Relevant AI/RAG verifier run if retrieval behavior is touched.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Initial reference proof | `rg -n "list_insights\\(|insert_insight\\(" backend frontend scripts` | Pass | Active callers found in backend chat/project detail and Fireflies ingestion; tests mock the legacy methods. |
| Linear issue | AAI-751 | Pass | Created under AAI-636. |
| Deleted helper scan | `rg -n "list_insights\\(|insert_insight\\(|#/components/schemas/Insight|\\\"Insight\\\":|^    Insight:" backend frontend/public frontend/src scripts docs/ops/tasks/2026-06-27-retire-pipeline-a-insight-stubs.md || true` | Pass | No active helper/API schema references remain. |
| OpenAPI JSON | `node -e "JSON.parse(require('fs').readFileSync('frontend/public/openapi.json','utf8')); console.log('openapi json ok')"` | Pass | Public JSON spec still parses. |
| Backend compile | `backend/.venv/bin/python -m py_compile backend/src/api/main.py backend/src/services/supabase_helpers.py backend/src/services/ingestion/fireflies_pipeline.py` | Pass | Touched backend modules compile. |
| Focused backend tests | `backend/.venv/bin/python -m pytest backend/tests/test_chat_api.py backend/tests/test_projects_api.py backend/tests/test_api_routes.py backend/tests/test_fireflies_action_items.py -q` | Pass | 59 passed; warnings are existing FastAPI lifecycle / unknown pytest mark warnings. |
| Compact AI/RAG verifier bundle | delegated sub-agent `019f0995-5a75-7e02-a1c4-846ba4ab4d63` | Pass | Chat architecture, source-specific, source-lifecycle, meetings, retrieval-contract, Graph subscriptions, and Microsoft assistant health all passed. |

## Files To Change

- `backend/src/api/main.py`
- `backend/src/services/supabase_helpers.py`
- `backend/src/services/ingestion/fireflies_pipeline.py`
- `backend/tests/test_chat_api.py`
- `backend/tests/test_projects_api.py`
- `backend/tests/test_api_routes.py`
- `frontend/public/openapi.json`
- `frontend/public/openapi.yaml`
- `backend/API.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/tasks/2026-06-27-retire-pipeline-a-insight-stubs.md`

## Risks / Gaps

- The backend `/api/chat` and `/api/projects/{project_id}` endpoints are older
  RAG REST APIs. The production assistant primarily uses the Next.js
  `/api/ai-assistant/chat` route, but these backend endpoints are still
  route-reachable and must not advertise inactive legacy insight output.
- Generated app-expert/help docs still mention broader insight concepts; this
  task only removes the deprecated Pipeline A no-op backend calls.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
