# Task: Company-scoped published trade schedule visibility

Status: Published and deployed; authenticated browser evidence blocked
Owner: Codex
Created: 2026-07-29
Task ID: SCHED-TRADE-COMPANY
Delivery lane: Standard

## Objective

Allow an authenticated trade member to see published schedule activities
assigned to active project members in the same canonical company, without
exposing mutable schedule tasks or activities assigned outside that company.

## Acceptance contract

- [x] The caller's company comes from `people.company_id`.
- [x] Company colleagues must be active people and active members of the same
  project before their published assignments can be returned.
- [x] A person without a canonical company falls back to personal assignments.
- [x] Missing identity or directory-query failures fail closed or fail loudly.
- [x] The UI identifies whether the feed is company- or person-scoped.
- [x] Only published revision snapshots are queried; mutable tasks remain out
  of the trade read surface.
- [x] Focused route, selector, and component tests pass.
- [x] Independent code and React/accessibility reviews approve.
- [x] Scheduling release validation passes.
- [x] Exact owned files publish to `origin/main`.

## Security boundary

The service-role client is used only after `verifyProjectAccess`. The route
derives a project-scoped allowlist by intersecting:

1. active people with the caller's canonical company ID; and
2. active `project_directory_memberships` for the requested project.

The snapshot query and a second in-memory selector both enforce that allowlist.
Unassigned activities and assignments outside the allowlist are omitted.

## Deferred database-dependent alert work

Published activity visibility is company-scoped in this task. Fan-out of a
schedule-change alert to multiple company recipients still requires a
transactional database migration and delivery-deduplication contract. That work
remains in the database phase rather than weakening the existing single-
recipient RPC while migrations are under another active ownership lease.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Focused Jest | Pass | 3 suites, 16 tests cover the published-revision boundary, company/project intersection, personal fallback, fail-loud errors, selector allowlist, loading, empty state, and source links. |
| Targeted ESLint | Pass | Zero warnings or errors in the six TypeScript/TSX files. |
| Changed type debt | Pass | No new `any` type debt. |
| Full TypeScript | Bounded check stopped | `tsc --noEmit --pretty false --incremental false` emitted no diagnostics but was stopped after ten minutes; focused Jest compilation, ESLint, and changed-type validation passed. |
| Code review | Approve | No high/medium authorization, service-role, scoping, or data-integrity findings. |
| React/accessibility review | Approve | Loading and empty states are announced and retain explicit company/person scope. |
| Scheduling release suite | Pass | 72/72 suites and 402/402 tests passed. |
| Publication | Pass | Exact scheduling files published at `45a111fee1f9c29eadb569bcd62cbaafd11b0a7f`; local and `origin/main` readback matched. |
| Canonical deployment | Pass | Vercel deployment `dpl_C9tfWTHswamDnDRKNS47raxLjR65` reached Ready and owns `projects.alleatogroup.com`. |
| Browser evidence | Blocked | The available in-app browser redirects the project schedule to login and no reusable authenticated storage state exists. No live data was changed. |
