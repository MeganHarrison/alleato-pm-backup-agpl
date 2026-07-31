# Task: AI Assistant Creation Tools Review

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: N/A - review only
Related Handoff: N/A

## Objective

Review whether the AI assistant tools can successfully create records such as
change requests/change events, RFIs, commitments, and related project workflow
objects, using current repo code and targeted checks.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing chat route, tool registry, and action tools reviewed.
- [x] Create-capable tools inventoried with record type and execution mode.
- [x] Runtime wiring checked from assistant request to tool execution.
- [x] Backend write routes checked for create flows named in the tool layer.
- [x] Tests/verification coverage checked for preview and confirmed write paths.
- [x] Gaps, blockers, and recommended next steps recorded.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static code review | `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`, `frontend/src/lib/ai/orchestrator.ts`, `frontend/src/lib/ai/tool-registry.ts`, `frontend/src/lib/ai/tools/action-tools.ts`, change-events/RFI/PCCO routes, DB schema dump | Complete | Live chat passes action tools into `streamText`; registry exposes 24 action tools; confirmed change-event write shape does not match DB/API enum contract. |
| Tool inventory | Local AST-style scan of `action-tools.ts` | Complete | 24 action tools found: 21 project/workflow/directory/internal create/update/delete/generate actions plus 3 delivery actions. |
| Targeted tests | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/ai/__tests__/tool-registry.test.ts src/lib/ai/tools/__tests__/outbound-action-policy.test.ts` | Passed | 3 suites, 39 tests passed. Coverage proves registry/preview and selected confirmed paths, not every confirmed create path. |
| End-to-end proof | Existing task `docs/ops/tasks/2026-06-25-ai-change-request-workflow.md`; current code review | Partial | Existing browser proof shows widget prompt seeding and preview tests, but no current browser/DB proof of confirmed change-request creation. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-assistant-creation-tools-review.md` - task ledger.

## Risks / Gaps

- This is a review task; unless explicitly requested, no production write flow
  will be executed against live project data.
- Confirmed live writes were not executed against production project records in
  this review.
- Highest priority blocker: `createChangeEvent` uses snake_case enum values
  that violate the route and DB constraints for change events.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
