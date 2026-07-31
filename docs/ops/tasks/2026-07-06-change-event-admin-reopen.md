# Task: Change event admin reopen after approved downstream lineage

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-977
Related Handoff: docs/ops/handoffs/2026-07-06-S120-change-event-admin-reopen.md

## Objective

Allow admins to move an existing change event back to `Open` and continue editing it on the canonical change-event detail/edit flow even after downstream potential/change-order lineage has reached approved state. Also repair the exact named record so the requested workflow works immediately.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

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
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/change-events/[changeEventId]/__tests__/page.test.tsx'` | Pass | Page file still has a pre-existing design warning outside this task slice. |
| Targeted tests        | `./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(main)/[projectId]/change-events/[changeEventId]/__tests__/page.test.tsx'` | Pass | Reopen action renders for approved change events and dispatches `open`. |
| Browser/user-flow     | `agent-browser --session-name alleato-test-3001 open http://localhost:3001/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` | Blocked | Exact route rendered `Internal Server Error` in both `Approved` and `Open` states. Screenshot: `/tmp/aai977-change-event-open.png` |
| DB/provider read-back | Supabase service-role read/update/read-back on `change_events.id='927f077e-3883-441c-b275-58b55a4f9db9'` | Pass | Final persisted status confirmed as `Open`. |
| End-to-end proof      | Exact route reopen via browser | Blocked | Existing route-level runtime failure prevented clicking through the UI despite code/test and DB status being correct. |

## Files Changed

- `docs/ops/tasks/2026-07-06-change-event-admin-reopen.md` - task ledger
- `docs/ops/handoffs/2026-07-06-S120-change-event-admin-reopen.md` - worker handoff
- `docs/ops/orchestration/session-board.md` - active session claim
- `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx` - canonical reopen action
- `frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/__tests__/page.test.tsx` - regression coverage for status action

## Risks / Gaps

- Exact browser proof is blocked by an existing route-level runtime failure on `/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` that renders `Internal Server Error` even after the record is restored to `Open`.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
