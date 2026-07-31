# Task: Unified Table Defaults And Permissions Bulk Actions

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-911
Related Handoff: Not applicable

## Objective

Make `UnifiedTablePage` default to the full table capability set unless a page explicitly opts out, and fix `/user-management` so `App Users`, `Project Permission Templates`, and `Company Permission Templates` all expose the expected selection and bulk-delete workflows where deletion is supported.

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
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && ./node_modules/.bin/eslint 'src/components/tables/unified/unified-table-page.tsx' 'src/components/tables/unified/__tests__/unified-table-page.test.ts' 'src/app/(admin)/user-management/page.tsx' 'src/app/(admin)/user-management/__tests__/page-config.test.ts'` | Pass with warnings | No lint errors. Existing warnings remain in `frontend/src/app/(admin)/user-management/page.tsx` for raw page-grid usage. |
| Targeted tests        | `cd frontend && ./node_modules/.bin/jest --runTestsByPath 'src/components/tables/unified/__tests__/unified-table-page.test.ts' 'src/app/(admin)/user-management/__tests__/page-config.test.ts' --runInBand` | Pass | 2 suites, 7 tests passed. |
| Browser/user-flow     | Codex window capture `/tmp/codex-user-management-bulk-delete-check.png` and prior local auth/headless checks | Blocked | Current Codex window capture was not on the requested user-management browser surface. Headless verification remains blocked by local auth / admin allowlist behavior on `localhost:3001`. |
| DB/provider read-back | Not applicable     | Pending | No DB/provider changes planned. |
| End-to-end proof      | Shared default and page wiring verified by source + tests | Partial | Live browser proof of the actual `/user-management` table state still needs a logged-in browser session on the correct route. |

## Files Changed

- `frontend/src/components/tables/unified/unified-table-page.tsx` - shared feature-gating defaults for selection and bulk actions.
- `frontend/src/app/(admin)/user-management/page.tsx` - delete, selection, and bulk-action wiring across permission tabs.
- `frontend/src/components/tables/unified/__tests__/unified-table-page.test.ts` - regression guardrail for default-on row selection.
- `frontend/src/app/(admin)/user-management/__tests__/page-config.test.ts` - regression guardrail for bulk-action wiring on the permissions tabs.

## Risks / Gaps

- Bulk delete can only be default-on for pages that have a real delete owner. Pages without canonical delete handlers still need explicit opt-out or a safe no-op prohibition.
- Browser verification on protected admin pages may still be limited by the local auth / allowlist behavior on `localhost:3001`.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
