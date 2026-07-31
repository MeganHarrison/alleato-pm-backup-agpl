# Task: RAG pipeline reliability

Status: Complete
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-779 - https://linear.app/megankharrison/issue/AAI-779/make-rag-pipeline-reliability-consistently-green
Related Handoff: docs/ops/handoffs/2026-06-30-S103-rag-pipeline-reliability.md

## Objective

Stop treating RAG reliability as a set of one-off repairs. Establish a single
green gate and add the first durable guardrail for the currently failing layer.

## Scope Checklist

- [x] Existing RAG implementation skill reviewed.
- [x] RAG strategy council skill reviewed because prior fixes did not hold.
- [x] Current live health checked before implementation.
- [x] Linear issue created before implementation.
- [x] Existing watchdog/cron surfaces reviewed before adding new behavior.

## Implementation Checklist

- [x] Add AI Gateway credit-floor checking to backend provider health cron.
- [x] Keep existing RAG pipeline architecture; do not add a parallel retrieval path.
- [x] Create RAG reliability council report.
- [x] Create checked-in operating plan for keeping the pipeline green.
- [x] Record runtime provider warning explicitly.

## Verification Checklist

- [x] `npm run rag:verify:source-lifecycle` run.
- [x] `npm run rag:verify:meetings` run.
- [x] `npm run rag:verify:source-specific` run.
- [x] `npm run rag:verify:render-ai` run.
- [x] Targeted backend tests pass.
- [x] Handoff validator passes.
- [x] Linear issue receives progress evidence.

## Acceptance Criteria

- Current failure layer is identified with command evidence.
- Backend provider health cron fails loudly before the AI Gateway balance is
  exhausted.
- Operating plan states exact green gates, alerting behavior, remediation
  sequence, and owner action.
- Task distinguishes provider warnings from hard provider failures.

## Files To Change

- `backend/src/services/health/ai_provider_health.py`
- `backend/tests/test_ai_provider_health.py`
- `docs/ai-plan/councils/2026-06-30-rag-strategy-council-pipeline-reliability.md`
- `docs/ops/plans/2026-06-30-rag-pipeline-green-plan.md`
- `docs/ops/tasks/2026-06-30-rag-pipeline-reliability.md`
- `docs/ops/handoffs/2026-06-30-S103-rag-pipeline-reliability.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Linear issue | AAI-779 | Pass | Created as urgent issue under AAI-774. |
| Source lifecycle | `npm run rag:verify:source-lifecycle` | Pass | Generated at `2026-06-30T17:59:30.066Z`; failures array empty. |
| Meeting vectorization | `npm run rag:verify:meetings` | Pass | 69/69 recent meetings have embedded chunks; provider probe OK. |
| Source-specific RAG | `npm run rag:verify:source-specific` | Pass | Contract verification passed. |
| Render/provider health | `npm run rag:verify:render-ai` | Pass | AI Gateway balance `$4.8289` is below the `$5.00` warning floor, above the `$1.00` hard floor; backend health payload healthy and OpenAI direct is configured. |
| Full RAG gate rerun | `npm run rag:verify:source-lifecycle`; `npm run rag:verify:meetings`; `npm run rag:verify:source-specific`; `npm run rag:verify:render-ai` | Pass | Reran on 2026-06-30 after correcting warning-vs-failure semantics. |
| Provider health unit tests | `PYTHONPATH="$PWD/backend:$PWD/backend/src" backend/.venv/bin/python -m pytest backend/tests/test_ai_provider_health.py -q` | Pass | 5 passed; system Python failed before tests because `python-multipart` is not installed, so project virtualenv was used. |
| Handoff validator | `npm run linear:codex:check -- docs/ops/handoffs/2026-06-30-S103-rag-pipeline-reliability.md` | Pass | Linear Codex handoff check passed. |
| Linear update | AAI-779 comment `25ffc53a-6f06-4c2d-bef2-e018c81c0b22` | Pass | Posted evidence, cause, detection gap, prevention, and next action. |
| Linear correction update | AAI-779 comment `d01d19ca-d31f-48bc-963e-f0355b3b7944` | Pass | Posted corrected warning-vs-failure status and full green-gate evidence. |
| Render env read-back | Render API env-var read-back for service `srv-d8271ohj2pic739klb7g` | Pass | `AI_GATEWAY_MIN_CREDITS_USD=1`; `AI_GATEWAY_WARN_CREDITS_USD=5`. |

## Risks / Gaps

- AI Gateway credits are below the warning floor. This is no longer a hard RAG
  blocker because the backend has usable AI Gateway credits and direct OpenAI is
  configured.
- Existing unrelated local edits are present in frontend email/admin/API files
  and must not be staged with this task.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Runtime provider warning is explicit with cause, detection gap, prevention, owner, and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
