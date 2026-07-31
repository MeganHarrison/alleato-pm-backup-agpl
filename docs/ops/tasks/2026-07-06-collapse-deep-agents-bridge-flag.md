# Collapse Deep Agents Bridge Flag

Date: 2026-07-06
Linear: AAI-947
Status: Complete

## Objective

Remove the duplicate frontend Deep Agents bridge enablement flag and make AI
Assistant routing respect backend-owned capability state. Broad portfolio or
executive prompts must not fall back to a random single-project RAG answer when
the backend Deep Agent is unavailable.

## Scope

- Remove task-owned runtime use of `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED`.
- Keep backend service flags as the owner of backend agent availability.
- Make frontend bridge attempts fail with actionable disabled/backend detail.
- Block broad company/portfolio health prompts from direct single-project
  briefing fallback when no project is selected.
- Update focused tests and evidence.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Inspect current bridge gating, backend endpoint flags, and fallback path.
- [x] Remove frontend bridge enablement flag from task-owned code/tests.
- [x] Add backend-derived capability/error handling with persisted debug detail.
- [x] Add guardrail preventing broad portfolio prompts from single-project fallback.
- [x] Run focused tests/checks and record evidence.
- [x] Post Linear closeout comment.
- [x] Verify backend research endpoint live after deploy.

## Evidence

- Linear issue: `AAI-947`.
- Linear closeout comment: `3194c70e-4d2f-480a-a95d-4079f87cbf9c`.
- Removed active frontend flag references:
  - `frontend/src/lib/ai/deep-agent-bridge.ts`
  - `frontend/src/lib/ai/__tests__/deep-agent-bridge.test.ts`
  - `scripts/verify/verify_deep_agents_nonprod_readiness.mjs`
  - `docs/architecture/_audit/frontend-orchestration-inventory.md`
  - `docs/architecture/AI-RAG-ARCHITECTURE.md`
- Routing guardrails:
  - `frontend/src/lib/ai/retrieval/planner.ts` now routes active/all/portfolio project-health prompts to the broad executive path.
  - `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` blocks broad portfolio health prompts from direct single-project briefing fallback when no project is selected.
  - Failed executive bridge traces now include elapsed duration and structured guardrail diagnostic detail.
- Backend/provider:
  - Render active backend service verified as `srv-d8271ohj2pic739klb7g`.
  - Render env read-back for `DEEP_AGENTS_RESEARCH_ENABLED` returned `true`.
  - First deploy after env update, `dep-d95iqttckfvc73bdc2s0`, failed with `nonZeroExit=1`.
  - Render logs showed backend startup failure: `ModuleNotFoundError: No module named 'mcp.server'`.
  - `backend/src/services/mcp/alleato_system.py` now lazy-loads MCP and reports unavailable instead of crashing the backend import.
  - Published fix to `origin/main` at `ada247b096`.
  - Render deploy `dep-d95iuebtqb8s73espcdg` reached `live` on `2026-07-06T04:30:52.309008Z`.
  - Backend `GET /health` returned `200`.
  - Backend `POST /api/intelligence/research` returned `200` with `mode: deep_agents`, proving the backend-owned flag is active.
  - Research endpoint still reported internal portfolio database evidence unavailable because the Deep Agent DB tool hit `psycopg2.OperationalError` / `Network is unreachable`; this is separate source-access work.
- Checks:
  - `cd frontend && npx jest src/lib/ai/__tests__/deep-agent-bridge.test.ts src/lib/ai/retrieval/__tests__/planner.test.ts --runInBand` passed: 61 tests.
  - `cd frontend && npx eslint 'src/lib/ai/deep-agent-bridge.ts' 'src/lib/ai/__tests__/deep-agent-bridge.test.ts' 'src/lib/ai/retrieval/planner.ts' 'src/lib/ai/retrieval/__tests__/planner.test.ts' 'src/app/api/ai-assistant/chat/handler-v2.ts'` passed.
  - `PYTHONPATH=backend:backend/src python3 -m py_compile backend/src/services/mcp/alleato_system.py` passed.
  - `cd frontend && npm run typecheck:changed` passed with no new `any` debt.
  - `npm run check:routes` passed.
  - `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-collapse-deep-agents-bridge-flag.md` passed.
  - Active search for `AI_ASSISTANT_DEEP_AGENT_BRIDGE_ENABLED` across frontend source, active env, scripts, architecture docs, and task docs returned no matches.

## Remaining Risk

The duplicate frontend flag is removed and the backend research endpoint is
live, but portfolio-quality answers still depend on fixing the Deep Agent
internal database tool. The endpoint currently fails loudly when internal
portfolio evidence is unreachable instead of silently falling back to a
single-project RAG answer.

## Failure Contract

- Cause: frontend bridge flag could say enabled while backend endpoint was disabled.
- Detection gap: debug metadata collapsed disabled backend detail into a generic
  retry-policy label.
- Prevention: backend endpoint availability controls whether the path can run,
  and broad prompts cannot silently degrade into single-project RAG.
