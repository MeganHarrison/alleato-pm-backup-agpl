# Task: RFI Create Change Event Action

Status: Complete
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-968 - https://linear.app/megankharrison/issue/AAI-968/fix-rfi-detail-create-change-event-action
Related Handoff: N/A

## Objective

Make the top-right `Create Change Event` action on the RFI detail route create a
new change event successfully and navigate directly to the new change-event
detail page.

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
| ----- | ------------------ | ------ | ----- |
| API contract review | `frontend/src/app/api/projects/[projectId]/change-events/{route,validation}.ts` | Pass | POST requires `title`, `type`, and `scope`; accepts optional `origin` and raw `originId`; returns `id` at the top level. |
| Browser/user-flow | `agent-browser click "Create Change Event"` from `http://localhost:3001/876/rfis/fe13bf4e-dbb6-494a-bb50-b8fc821b694e` | Pass | Initial short wait falsely looked like a no-op; server logs confirmed the POST succeeded, and the browser later resolved to `/876/change-events/f5be553f-035a-42da-85bd-d77af919e50b`. |
| Static/type/lint | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/rfis/[rfiId]/rfi-header-actions.tsx' 'src/app/(main)/[projectId]/rfis/[rfiId]/__tests__/rfi-header-actions.test.tsx'` from `frontend/` | Pass | Handler and regression test lint cleanly. |
| Targeted tests | `./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(main)/[projectId]/rfis/[rfiId]/__tests__/rfi-header-actions.test.tsx'` from `frontend/` | Pass | Covers success navigation and fail-loudly missing-id response handling. |
| DB/provider read-back | local dev server request log for `POST /api/projects/876/change-events` | Pass | Canonical API route returned `201` for the button-triggered create request. |
| End-to-end proof | `docs/ops/evidence/2026-07-06-rfi-create-change-event-action/change-event-created-route.png` | Pass | Browser landed on `http://localhost:3001/876/change-events/f5be553f-035a-42da-85bd-d77af919e50b` after create. |

## Files Changed

- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/rfi-header-actions.tsx` - top-right button handler owner.
- `frontend/src/app/(main)/[projectId]/rfis/[rfiId]/__tests__/rfi-header-actions.test.tsx` - regression coverage for create-change-event success and fail-loudly error handling.
- `docs/ops/tasks/2026-07-06-rfi-create-change-event-action.md` - task definition and evidence.

## Risks / Gaps

- The handler itself was already correctly aligned to the API contract in the worktree; the main risk was misreading slow destination compilation as a failed create, so the added regression test is the durable guardrail.
- Local logs still show an unrelated `documents_rfis_links` schema-cache error from `api/entity-links`; it did not block the create-change-event flow.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
