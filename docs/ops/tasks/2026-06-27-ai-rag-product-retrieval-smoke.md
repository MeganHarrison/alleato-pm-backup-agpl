# Task: AI/RAG Product Retrieval Smoke Proof

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-739 - https://linear.app/megankharrison/issue/AAI-739/run-user-visible-airag-retrieval-smoke-proof
Parent: AAI-636

## Objective

Run a final user-visible assistant/RAG retrieval smoke proof after backend
production-readiness verifiers passed. This slice must prove the product-facing
assistant path can answer with finalized retrieval/source metadata, not just
that backend tables and cron health checks pass.

## Scope Checklist

- [x] Linear issue created.
- [x] Task file created before execution.
- [x] Existing product/assistant smoke path identified.
- [x] Smoke proof executed.
- [x] Evidence artifact created.
- [x] Final deliverables updated with the smoke proof result.

## Acceptance Criteria

- [x] The smoke uses a product-facing assistant route or eval harness that calls the live assistant route.
- [x] The response proves finalized retrieval/source behavior through metadata, tool trace, source references, or persisted assistant evidence.
- [x] The result is documented with command, route, status, and evidence.
- [x] Failures are recorded as blockers instead of hidden.

## Verification

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Code path map | subagent `019f0927-3e3d-7613-8336-e5e32f14a99e` | PASS | Identified eval-suite case runner as best product-facing smoke path. |
| Outlook source lookup smoke | `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- realworld-last-five-emails` | PASS | HTTP 200, persisted message, `consultMicrosoftExecutiveAssistant`, nested read_live_outlook_inbox, `source=microsoft_graph_live`, count 5. |
| Teams source lookup smoke | `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- source-lookup-teams` | PASS with caveat | Product route and metadata passed, but final answer fell back to packet/context because direct Teams rows were unavailable for the prompt. |
| Meeting source lookup smoke | `AI_EVAL_BASE_URL=https://projects.alleatogroup.com AI_EVAL_CASE_TIMEOUT_MS=180000 AI_EVAL_JUDGE_ENABLED=false npm run rag:verify:eval-suite:case -- source-lookup-meetings` | FAIL latency | HTTP 200 and persisted retrieval metadata, but 153819ms exceeded 75000ms max budget. Tracked as follow-up risk. |
| Evidence artifact | `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/product-retrieval-smoke-aai-739.md` | PASS | Commands, route, status, session IDs, tool traces, and caveats recorded. |

## Files To Change

- `docs/ops/tasks/2026-06-27-ai-rag-product-retrieval-smoke.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/product-retrieval-smoke-aai-739.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/final-production-readiness-deliverables-aai-738.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`

## Risks / Gaps

- Live browser/auth state may be unavailable. If so, use the closest existing
  authenticated API/eval harness and document the auth boundary.
- The checkout contains unrelated dirty files; stage only AAI-739-owned docs.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next steps.
