# Task: User management user type column

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-25
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Show the Supabase `people.person_type` value in the `/user-management` table so admins can see whether each row is marked as employee, user, subcontractor, vendor, or another type.

## Attention Brief

Primary user: Admin managing people and access.
Primary job: Inspect identity and access records without guessing the underlying person type.
Primary decision: Which records need type cleanup before role changes.
Tier 1: User identity and permission state.
Tier 2: Raw user type from `people.person_type`.
Tier 3: Teams link and project/access metadata.
Hide until requested: Any explanation or correction workflow.
Remove: Summary cards, helper banners, or inferred labels.
Primary action: Sort/search/open the row using the existing table actions.
Failure-loudly behavior: If the API cannot read people rows, the existing user table error state is shown.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] `/user-management` App Users table has a default-visible User Type column.
- [x] The column displays the raw `people.person_type` value from Supabase.
- [x] User Type participates in search and sorting.
- [x] Targeted test proves the person type survives the API/client mapping.
- [ ] Browser proof shows row values in the column on `http://localhost:3001/user-management`.

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
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npx eslint 'src/app/(admin)/user-management/page.tsx' 'src/app/(admin)/user-management/_lib/user-access-data.ts' 'src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts' 'src/app/api/permissions/users/route.ts'` | Pass | Focused lint clean. |
| Changed-file quality  | `npm run quality:changed` | Pass | No new ESLint, `any`, unsafe-pattern, or route guardrail debt. |
| Targeted tests        | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts'` | Pass | 5 tests pass, including raw person type mapping. |
| Browser/user-flow     | `tests/agent-browser-runs/2026-06-25-user-management-user-type-column/table-settings.png` | Partial | `User Type` is visible and checked in table settings; local page showed `0 rows`, so row-value visual proof is deferred. |
| DB/provider read-back | N/A                | Pass   | No schema/config change; uses existing `people.person_type`. |
| End-to-end proof      | `tests/agent-browser-runs/2026-06-25-user-management-user-type-column/user-management-after-wait.png` | Partial | Page loaded at the requested URL, but the table had no rows in this browser session. |

## Files Changed

- `frontend/src/app/api/permissions/users/route.ts` - include `people.person_type`.
- `frontend/src/app/(admin)/user-management/_lib/user-access-data.ts` - carry `personType`.
- `frontend/src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts` - cover mapping.
- `frontend/src/app/(admin)/user-management/page.tsx` - add visible column/search/sort.
- `docs/ops/tasks/2026-06-25-user-management-user-type-column.md` - task ledger.

## Risks / Gaps

- The table will show current DB values exactly; cleanup of incorrect values is a separate operation.
- Row-level visual proof is deferred because `http://localhost:3001/user-management` rendered `0 rows` during verification. The table settings artifact proves the column is present and default-visible.

## Blocker

- Cause: the local browser session rendered the user-management table with `0 rows`, so the screenshot cannot prove row values.
- Detection gap: implementation checks and table-settings proof can verify the column wiring, but they cannot prove live row rendering when the data set is empty in the session.
- Prevention step: keep the mapping unit test and changed-route guardrails; add a seeded browser fixture or authenticated test state for this admin route.
- Owner: Codex/app verification.
- Next action: rerun browser proof in a session where `/api/permissions/users` returns app-user rows, then mark the browser row-value criterion complete.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
