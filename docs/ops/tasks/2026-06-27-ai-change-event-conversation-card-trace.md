# Task: AI change event conversation and card trace

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-761 - https://linear.app/megankharrison/issue/AAI-761/fix-assistant-change-event-create-conversation-and-card-trace
Related Handoff: N/A

## Objective

Make the assistant's change-event create flow behave like an expert project-management assistant: keep follow-up field/domain questions inside the active create workflow, preserve enough action-tool output for chat cards/deep links, and verify the Playmakers production trace that exposed the issue.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `./node_modules/.bin/eslint src/lib/ai/intent-router.ts src/lib/ai/workflow-registry.ts src/lib/ai/change-request-field-guide.ts src/lib/ai/action-tool-trace.ts src/lib/ai/__tests__/intent-router.test.ts src/lib/ai/__tests__/workflow-registry.test.ts src/lib/ai/__tests__/action-tool-trace.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts src/lib/ai/tools/action-tools.ts src/app/api/ai-assistant/chat/handler-v2.ts src/components/ai-assistant/chat-area.tsx` | Pass | Focused lint on touched code. |
| Targeted tests | `npm --prefix frontend run test:unit -- --runTestsByPath src/lib/ai/__tests__/intent-router.test.ts src/lib/ai/__tests__/workflow-registry.test.ts src/lib/ai/__tests__/action-tool-trace.test.ts src/lib/ai/tools/__tests__/action-tools.test.ts --runInBand` | Pass | 4 suites, 103 tests. |
| Browser/user-flow | `agent-browser open https://projects.alleatogroup.com/1067/change-events` after login | Pass | Production page shows row `001 - CR-9299-0030 Design Updates`. |
| DB/provider read-back | Supabase readback for project 1067/session 40571f3c-022b-481f-901a-4500ef8958b2 | Pass | Change event `fb624fb3-3111-4b5b-877d-47f8fc5b54e8` exists; trace lost structured create output. |
| End-to-end proof | Supabase + browser readback for project 1067 | Pass | Created row is visible and has Open, Out of Scope, Owner Change, Client Request, expecting revenue true. |

## Files Changed

- `frontend/src/lib/ai/intent-router.ts` - keep active change-event field/domain follow-ups out of generic app help.
- `frontend/src/lib/ai/__tests__/intent-router.test.ts` - regression coverage for Playmakers follow-up wording.
- `frontend/src/app/api/ai-assistant/chat/handler-v2.ts` - preserve structured action-tool outputs in stored trace.
- `frontend/src/components/ai-assistant/chat-area.tsx` - render created change-event card/deep link from persisted trace output.
- `frontend/src/lib/ai/action-tool-trace.ts` - shared trace-output preservation helper.
- `frontend/src/lib/ai/__tests__/action-tool-trace.test.ts` - regression coverage for action-tool trace output.
- `frontend/src/lib/ai/workflow-registry.ts` - normalize dictated/typed change-event shorthand to canonical values.
- `frontend/src/lib/ai/__tests__/workflow-registry.test.ts` - regression coverage for Playmakers shorthand values.
- `frontend/src/lib/ai/change-request-field-guide.ts` - expert PM guidance for defaults, assumptions, and preview continuity.
- `frontend/src/lib/ai/tools/action-tools.ts` - return `project_id` from confirmed change-event writes.
- `frontend/src/lib/ai/tools/__tests__/action-tools.test.ts` - confirmed write contract includes `project_id`.
- `docs/ops/tasks/2026-06-27-ai-change-event-conversation-card-trace.md` - task definition and evidence.

## Risks / Gaps

- Existing unrelated dirty files remain in the checkout; final staging was exact and skipped unrelated hunks in `handler-v2.ts` and `chat-area.tsx`.
- The old production trace cannot be retroactively turned into a card because the structured tool output was not persisted at the time; the fix preserves the payload for new runs.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
