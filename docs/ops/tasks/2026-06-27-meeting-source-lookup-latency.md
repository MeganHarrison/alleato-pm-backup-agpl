# Task: Meeting Source Lookup Latency

Status: In Progress
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-749 - https://linear.app/megankharrison/issue/AAI-749/reduce-meeting-source-lookup-latency-below-eval-budget
Parent: AAI-636

## Objective

Reduce the product-facing meeting source lookup path below the eval max budget.
The current production route returns and persists retrieval metadata, but the
`source-lookup-meetings` eval took `153819ms`, exceeding the `75000ms` max
budget.

## Scope Checklist

- [x] Linear issue created.
- [x] Task file created before implementation.
- [x] Persisted eval trace analyzed.
- [x] Slow route/tool cause identified with file references.
- [x] Durable fix implemented or exact blocker documented.
- [x] Verification passes or blocker is recorded honestly.
- [x] Final deliverables/progress docs updated.

## Acceptance Criteria

- [x] Meeting source lookup avoids unrelated slow tools for exact meeting-source questions.
- [x] Product eval `source-lookup-meetings` passes under the max budget, or local equivalent proves the route fix before deploy.
- [x] No silent fallback is added.
- [x] Changed-file typecheck is delegated after code changes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Baseline product smoke | `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- source-lookup-meetings` | FAIL | `153819ms`, HTTP 200, persisted metadata, failed max budget `75000ms`. |
| Persisted trace analysis | Retired local eval artifact | PASS | `sourceSpecificRagRetrieval` took `1463ms`; latency came from later broad tool loop: 30 `searchMeetingsByTopic` completions over about `128.552s` plus off-path MCP/CHRO/memory/document tools. |
| Source-specific contract | `npm run rag:verify:source-specific` | PASS | Confirms source-specific prefetch and direct source-specific fast path contract. |
| Focused unit tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/__tests__/intent-router.test.ts --runInBand` | PASS | 110/110. Includes exact meeting prompt regression and app-help false-positive guard. |
| Delegated changed-file typecheck | `cd frontend && npm run typecheck:changed -- src/app/api/ai-assistant/chat/handler-v2.ts src/lib/ai/retrieval/__tests__/planner.test.ts src/lib/ai/intent-router.ts src/lib/ai/__tests__/intent-router.test.ts ../scripts/verify/verify_ai_source_specific_rag_contract.mjs` | PASS | Subagent reported no new `any` type debt. |
| Eval contract cleanup | `npm run rag:verify:source-specific`; `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts --runInBand`; `node --check scripts/verify/verify_ai_assistant_eval_suite.mjs`; delegated `cd frontend && npm run typecheck:changed -- src/lib/ai/retrieval/source-specific-rag.ts ../scripts/verify/verify_ai_assistant_eval_suite.mjs` | PASS | Removed user-facing `RAG index` wording and aligned the tracked eval runner with the direct `sourceSpecificRagRetrieval` contract. |
| Deployment readback | `vercel inspect https://alleato-5fr4hxc7e-meganharrisons-projects.vercel.app --scope team_lZighRY9Xpkb6qZBqDApczKZ` | PASS | Deployment `dpl_GeJhJvxRNw9ncjTr1uN8J97bTRNF` is `Ready` and aliased to `projects.alleatogroup.com`. |
| Production product eval | `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- source-lookup-meetings` | PASS | `5141ms`, 1/1 passing, 0 failures, 0 warnings. The local artifact was retired after recording this result. |
| Evidence artifact | `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meeting-source-lookup-latency-aai-749.md` | PASS | Root cause, fix, verification, and post-deploy production recheck command recorded. |

## Files To Change

- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- `frontend/src/lib/ai/retrieval/__tests__/planner.test.ts`
- `frontend/src/lib/ai/intent-router.ts`
- `frontend/src/lib/ai/__tests__/intent-router.test.ts`
- `scripts/verify/verify_ai_source_specific_rag_contract.mjs`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meeting-source-lookup-latency-aai-749.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`

## Risks / Gaps

- The live route is production-facing; any fix must preserve source-grounded
  answers and avoid hiding slow/failed tools.
- The checkout contains unrelated dirty files; stage only AAI-749-owned files.
- Production `source-lookup-meetings` eval now passes after deploy; remaining
  risk is limited to broader eval-suite coverage outside this latency slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Remaining blockers are documented.
- [x] Final response includes what is done, what remains, and recommended next steps.
