# Task: Plane Work Items navigation cutover

Status: Complete
Owner: S20260731-PLANE-CUTOVER
Created: 2026-07-31
Task ID: AAI-1292
Linear Issue: AAI-1292
Related Handoff: N/A

## Objective

Send project-scoped Tasks navigation to the Plane Work Items replacement,
honor bookmarked layouts and saved-view filters, and keep inspector navigation
recoverable without changing company-wide Tasks.

## Scope

- Own `frontend/src/lib/navigation-config.ts` and its focused unit test.
- Own `frontend/src/features/plane-work-items/plane-work-items-page.tsx` and its
  focused unit test.
- Include the verified AAI-1288 inspector URL, scroll, and focus seams that are
  owned by the Plane Work Items page.
- Exclude redirects, route deletion, `next.config.ts`, deployment, and changes
  to the company-wide `/tasks` surface. Inspector create and mutation behavior
  is also excluded.

## Source of Truth

- Canonical runtime/data owner: the existing Plane Work Items page and Tasks API.
- Existing shared primitives/services: `buildToolUrl`, `sidebarNavGroups`,
  `headerNavGroups`, and `companyWideHeaderTools`.
- Deprecated or parallel paths: project-scoped `/[projectId]/tasks` remains
  available until the deliberate route-retirement follow-up.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Every project-scoped Project Tasks navigation entry targets
  `plane/work-items`.
- [x] Company-wide Tasks remains `/tasks`.
- [x] `?view=board` initializes the Plane Work Items board layout.
- [x] Missing or unsupported `view` values initialize the list layout.
- [x] Inspector open state is represented by `?peek=<taskId>`.
- [x] Inspector close preserves active view and filter query parameters.
- [x] Inspector close restores the main surface scroll position and originating
  row/card focus.
- [x] Supported initial `status`, `priority`, `due_from`, and `due_to` filters
  are applied from saved-view query parameters.
- [x] Failure-loudly behavior is defined.
- [x] Legacy route retirement is explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared navigation configuration owns the cutover.
- [x] Unsupported layout query values fall back deterministically.
- [x] Database, provider, authentication, permission, and delivery contracts are
  unchanged.

## Integration and Verification

- [x] Focused navigation and Plane Work Items unit tests pass.
- [x] Focused lint passes for the four changed TypeScript files.
- [x] `git diff --check` passes.
- [x] Evidence is recorded below.
- [x] Production publication is deliberately excluded from this local handoff.

## Failure-Loudly Contract

- Cause surfaced as: a focused unit-test failure if project Tasks regresses to
  the legacy route, company Tasks is accidentally changed, or the board bookmark
  no longer initializes the board layout.
- Detection path: focused Jest tests for navigation and Plane Work Items.
- Recovery path: restore the project/company route split or the lazy query-state
  initializer, then rerun the focused checks.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Focused regression tests now own the navigation split and initial
  layout query contract.
- Guardrail evidence: Commands recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Plane Work Items unit | `npx jest --runInBand --runTestsByPath 'src/features/plane-work-items/plane-work-items-page.unit.test.tsx'` | Passed | 10 tests passed, including inspector query preservation, saved-view filters, and scroll/focus restoration. |
| Navigation unit | `npx jest --runInBand --runTestsByPath 'src/lib/__tests__/navigation-config.unit.test.ts'` | Passed | 29 tests passed. |
| Focused lint | `npx eslint <four task-owned TypeScript files> --quiet` | Passed | 0 errors. |
| Whitespace | `git diff --check` | Passed | No whitespace errors. |

## Remaining Risk

- The legacy project Tasks route is intentionally retained until redirect and
  deletion work is separately authorized and verified.
- This workspace is based directly on `personal-production/main` at
  `0cfcb14af75bce6b63370b07de476287d7b9838e`. The divergent `origin/main`
  history was not merged.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred route retirement and production integration are documented.
