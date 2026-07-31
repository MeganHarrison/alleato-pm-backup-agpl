# Task: AI widget action chips

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-685 - https://linear.app/megankharrison/issue/AAI-685/restore-ai-widget-empty-state-action-chips
Related Handoff: N/A

## Objective

Restore persistent empty-state action chips in the floating Alleato AI widget on `/comments`, including Project status report, Create change request, and Tasks overview, with project status seeding a conversation about the selected project/context.

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

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/components/ai-assistant/chat-area.tsx src/lib/ai/assistant-action-catalog.ts src/lib/ai/assistant-suggestion-resolver.ts src/lib/ai/__tests__/assistant-suggestion-resolver.test.ts`; `cd frontend && NODE_OPTIONS=--max_old_space_size=16384 npx tsc --noEmit --pretty false` | Pass |       |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/ai/__tests__/assistant-suggestion-resolver.test.ts` | Pass | 5 tests passed. |
| Browser/user-flow     | `docs/ops/evidence/2026-06-25-ai-widget-action-chips/widget-action-chips.png` | Pass | Active `/comments` widget showed Project status report, Create change request, and Tasks overview chips. |
| DB/provider read-back | N/A                | N/A    | No database/provider changes. |
| End-to-end proof      | `agent-browser click @e11`; `agent-browser get value @e14` | Pass | Project status report seeded: `Start a project status report conversation for the selected project...` |

## Files Changed

- `frontend/src/lib/ai/assistant-action-catalog.ts` - Update canonical widget action labels/prompts.
- `frontend/src/lib/ai/assistant-suggestion-resolver.ts` - Make widget defaults the three requested chips.
- `frontend/src/lib/ai/__tests__/assistant-suggestion-resolver.test.ts` - Guard widget default chip ordering.
- `frontend/src/components/ai-assistant/chat-area.tsx` - Render widget chips in the persistent empty state.
- `docs/ops/tasks/2026-06-25-ai-widget-action-chips.md` - Task ledger and evidence.

## Risks / Gaps

- None for this widget chip slice. Unrelated dirty checkout files were left untouched.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
