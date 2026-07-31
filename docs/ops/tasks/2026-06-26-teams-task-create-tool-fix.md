# Task: Teams Task Create Tool Fix

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-716

## Objective

Make Teams task-create requests complete through the real `createGeneratedTask`
tool instead of stalling on a web-only preview/confirmation flow.

## Attention Brief

Primary user: Teams user asking Alleato AI to create or assign a task.
Primary job: turn an inbox/chat item into a real Tasks page record.
Primary decision: whether the created task has the right title, assignee,
context, due date, and source.
Tier 1: confirmed task creation result and Tasks page link.
Tier 2: assignee resolution and source context.
Tier 3: raw tool trace and audit payload.
Hide until requested: internal tool-routing diagnostics.
Remove: web-only preview dependency for Teams.
Primary action: create the task once, idempotently, with audit evidence.
Failure-loudly behavior: if creation cannot write, return a specific tool error
and record an error audit instead of generic Teams failure text.

## Scope Checklist

- [x] Existing bot/task tool routing reviewed.
- [x] Existing task tool DB contract reviewed.
- [x] Root cause identified from production logs and code path.
- [x] Acceptance criteria written as observable behavior.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Teams task-write intents include action tools.
- [x] Teams task-create can write directly with idempotent audit.
- [x] Web preview-first behavior remains unchanged.
- [x] Errors remain specific and actionable.

## Integration Checklist

- [x] `Create the task for Candon` style prompts route to `task_write`.
- [x] Bot task-write prompt uses the correct Teams contract.
- [x] `createGeneratedTask` writes when Teams direct-write mode is active.
- [x] Write replay/idempotency still prevents duplicate task rows.

## Regression Guardrails

- [x] Focused unit test covers Teams task-write tool inclusion.
- [x] Focused unit test covers Teams direct task creation.
- [x] Existing task preview/write tests still pass.

## Verification Checklist

- [x] Targeted lint run.
- [x] Targeted automated test run.
- [x] Changed-file typecheck or equivalent targeted compile check.
- [x] Evidence artifacts recorded below.

## Planned Files

- `frontend/src/lib/ai/bot-core.ts` - classify task-write bot turns and pass task-write mode/platform to tools and prompt.
- `frontend/src/lib/ai/tools/action-tools.ts` - support channel-specific direct task writes for Teams while preserving web preview behavior.
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` - bot routing guardrails.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - direct-write task tool guardrails.
- `docs/ops/tasks/2026-06-26-teams-task-create-tool-fix.md` - task ledger.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Production log | `bot_debug_log` query since `2026-06-26T12:45:00Z` | Pass | Failed turn at `12:52:42Z` had `responseLength=0`; later explanation turn posted successfully. |
| Root cause inspection | `bot-core.ts`, `action-tools.ts`, `strategist.ts` | Pass | Bot path did not use `task_write` routing and task prompt required `confirmed:false` preview even on Teams. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/bot-core-prompt.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/ai/__tests__/intent-router.test.ts --runInBand` | Pass | 3 suites / 76 tests passed. |
| Targeted lint | `cd frontend && npx eslint src/lib/ai/bot-core.ts src/lib/ai/orchestrator.ts src/lib/ai/intent-router.ts src/lib/ai/tools/action-tools.ts src/lib/ai/__tests__/bot-core-prompt.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/ai/__tests__/intent-router.test.ts --quiet` | Pass | Focused lint clean. |
| Changed-file type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |

## Files Changed

- `docs/ops/tasks/2026-06-26-teams-task-create-tool-fix.md` - task ledger and evidence.
- `frontend/src/lib/ai/bot-core.ts` - task-write classification, Teams direct-write prompt, and action-tool wiring.
- `frontend/src/lib/ai/orchestrator.ts` - passes generated task write mode through strategist tool creation.
- `frontend/src/lib/ai/intent-router.ts` - recognizes `Create the task for Candon` as task-write intent.
- `frontend/src/lib/ai/tools/action-tools.ts` - direct generated-task write mode with audit marker and idempotency replay.
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` - Teams task-write routing guardrail.
- `frontend/src/lib/ai/__tests__/intent-router.test.ts` - exact phrase routing guardrail.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - direct generated task write guardrail.

## Risks / Gaps

- Existing checkout has unrelated dirty files; publish must stage only task-owned files.
- Live Teams E2E requires a real Teams retry after deploy.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
