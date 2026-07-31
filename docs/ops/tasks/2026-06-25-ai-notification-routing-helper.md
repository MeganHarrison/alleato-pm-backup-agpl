# Task: AI Notification Routing Helper

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-679 - https://linear.app/megankharrison/issue/AAI-679/add-ai-notification-routing-decision-helper
Related Handoff: Not applicable

## Objective

Create a shared, tested notification routing decision helper from the AI
Notification Routing Matrix so AI and workflow events can consistently decide
interruption versus quiet inbox, digest, widget, Teams, Outlook, page activity,
or admin/system queue routing.

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
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `cd frontend && npx eslint src/lib/ai/notification-routing.ts src/lib/ai/__tests__/notification-routing.test.ts`; `cd frontend && npm run typecheck` | Pass | Targeted ESLint clean; bounded typecheck exited 0. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/notification-routing.test.ts` | Pass | 8 tests passed. |
| Browser/user-flow | Not applicable | Pass | Pure helper/test slice; no frontend-visible runtime change. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes. |
| End-to-end proof | `frontend/src/lib/ai/__tests__/notification-routing.test.ts` | Pass | Tests prove interruption, quiet, low-confidence downgrade, preference downgrade, critical Teams override, recipient fallback, delivery-failure override, and page-context widget routing. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-notification-routing-helper.md` - Task evidence.
- `frontend/src/lib/ai/notification-routing.ts` - Shared routing decision helper.
- `frontend/src/lib/ai/__tests__/notification-routing.test.ts` - Routing guardrails.

## Risks / Gaps

- This slice decides channels only. It does not send Teams, Outlook, in-app, or
  widget notifications and does not write a notification ledger yet.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
