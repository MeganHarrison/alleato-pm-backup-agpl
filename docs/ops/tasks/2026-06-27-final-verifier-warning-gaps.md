# Task: Close Final Verifier Warning Gaps

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-753 - https://linear.app/megankharrison/issue/AAI-753/close-airag-final-verifier-warning-gaps-for-mcp-and-microsoft
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Close the remaining AI/RAG final verifier warning gaps so production health
checks report real operational state:

- stale AI SDK MCP architecture warning;
- Microsoft assistant health verifier missing suspended Render cron state.

## Checklist

- [x] Create Linear issue under AAI-636.
- [x] Prove MCP warning source against live implementation.
- [x] Prove Microsoft assistant cron live provider state.
- [x] Resume suspended Microsoft assistant cron through Render API.
- [x] Trigger manual Microsoft assistant cron run through Render API.
- [x] Update chat architecture verifier to check current descriptor MCP policy.
- [x] Update Microsoft assistant health verifier to fail on suspended cron state.
- [x] Verify chat architecture warning clears.
- [x] Verify Microsoft assistant health passes without the suspended-cron gap.
- [x] Run syntax checks for touched verifier scripts.
- [x] Delegate changed-file typecheck/check where applicable.
- [x] Update progress ledger and final deliverables.
- [ ] Publish to `origin/main`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| MCP warning investigation | subagent `019f099b-227e-78c0-815c-fcf87e2241c5` | Pass | Live route already discovers, merges, traces, and closes MCP tools; verifier expected stale `isReadOnlyMcpTool` symbol. |
| Microsoft health baseline | `npm run verify:microsoft-assistant-health -- --json` | Warning | Data-plane checks passed, but Render cron check only warned. |
| Render read-back | `GET /v1/services/crn-d8orvmmrnols73etajrg` | Fail then pass | Initially `suspended`; after `POST /resume`, service read back `not_suspended`. |
| Manual Render run | `POST /v1/cron-jobs/crn-d8orvmmrnols73etajrg/runs` | Pass | Returned run `crn-d8orvmmrnols73etajrg-1782572727`, status `pending`; events showed run started. |
| Verifier syntax | `node --check scripts/verify/verify_ai_chat_architecture.mjs && node --check scripts/verify/verify_microsoft_assistant_health.mjs` | Pass | Touched verifier scripts parse. |
| Chat architecture | `npm run rag:verify:chat-architecture` | Pass | 0 failures, 0 warnings after descriptor-policy verifier update. |
| Microsoft assistant health strict | `npm run verify:microsoft-assistant-health -- --json --require-cron-run --max-cron-age-minutes=10080` | Pass | 0 failures, 0 warnings; `lastSuccessfulRunAt=2026-06-27T15:07:07Z`. |
| Microsoft assistant health default | `npm run verify:microsoft-assistant-health -- --json` | Pass | 0 failures, 0 warnings. |
| Typecheck delegation | N/A | Pass | Touched executable files are `.mjs` verifier scripts; syntax checks are the applicable changed-file check. |

## Files To Change

- `scripts/verify/verify_ai_chat_architecture.mjs`
- `scripts/verify/verify_microsoft_assistant_health.mjs`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/tasks/2026-06-27-final-verifier-warning-gaps.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/final-production-readiness-deliverables-aai-738.md`

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Final response includes what is done, what remains, and recommended next steps.
