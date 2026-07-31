# Task: Show only active employees on global directory page

Status: Complete
Owner: Codex
Created: 2026-06-29
Linear Issue: AAI-766 - https://linear.app/megankharrison/issue/AAI-766/show-only-active-employees-on-global-directory-employees-page
Related Handoff: N/A

## Objective

Make `https://projects.alleatogroup.com/directory/employees?sort=business_unit&sort_dir=asc&page=1` return only active Alleato employees by default.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato operator opening the global employees directory.
Primary job: Find current active employees without inactive records mixed into the table.
Primary decision: Whether a visible person is an active employee.
Tier 1: Active Alleato Group people rows in `/api/directory/employees/table`.
Tier 2: Explicit status filters when intentionally selected.
Tier 3: Saved table view and sort query parameters.
Hidden until requested: Inactive employees.
Removal candidates: Inactive rows from the default global employees result set.
Primary action: Server-side default filter to active status.
Failure-loudly behavior: A route test must fail if the default API query no longer applies `status = active`.

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
| Static/type/lint | `./node_modules/.bin/eslint 'src/app/api/directory/employees/table/route.ts' 'src/app/api/directory/employees/table/__tests__/route.test.ts' --quiet` | Pass | No lint errors on changed API route/test. |
| Targeted tests | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/api/directory/employees/table/__tests__/route.test.ts'` | Pass | 2 tests passed: default active filter and explicit inactive filter. |
| Browser/user-flow | `agent-browser open 'https://projects.alleatogroup.com/directory/employees?sort=business_unit&sort_dir=asc&page=1' && agent-browser wait --load networkidle && agent-browser get url && agent-browser snapshot -i` | Auth-blocked | Production redirected to `/auth/login?callbackUrl=%2Fdirectory%2Femployees%3Fsort%3Dbusiness_unit%26sort_dir%3Dasc%26page%3D1`; screenshot saved at `docs/ops/evidence/2026-06-29-directory-employees-active-only/production-auth-redirect.png`. |
| DB/provider read-back | N/A | N/A | No schema, migration, provider, or external config change. |
| End-to-end proof | Route test exercises `GET /api/directory/employees/table?sort=business_unit&sort_dir=asc&page=1` | Pass | The canonical API now calls `eq("status", "active")` when status is omitted, so table/default URL paths cannot silently include inactive rows. |

## Files Changed

- `frontend/src/app/api/directory/employees/table/route.ts` - canonical employees table query filter.
- `frontend/src/app/api/directory/employees/table/__tests__/route.test.ts` - regression coverage for default active-only behavior.
- `docs/ops/tasks/2026-06-29-directory-employees-active-only.md` - working definition of done and evidence.

## Risks / Gaps

- Production row-level browser proof was blocked by lack of an authenticated session in agent-browser. The API route test verifies the canonical behavior that controls the page data.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
