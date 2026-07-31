# Task: Training Resource Admin Link

Status: Complete
Owner: STRAININGADMINLINK
Created: 2026-07-27
Task ID: training-resource-admin-link
Linear Issue: Not created; isolated navigation edit.

## Objective

Add the owner-only Training Resources table to the existing Admin Dashboard
directory.

## Scope

- Add one item to the canonical admin dashboard data source.
- Reuse the existing directory, table, and kanban views without page-local UI.

Delivery lane: Fast

Verification contract: Optional

## Acceptance Criteria

- [x] The Admin Dashboard links directly to
  `/training-data/training_resource`.
- [x] The item identifies its owner-only access contract.
- [x] Targeted lint and changed-scope type checks pass.

## Failure-Loudly Contract

- Cause surfaced as: destination route owner authorization.
- Detection path: the shared route guard redirects unauthorized users.
- Recovery path: sign in with the workspace owner account.

## Evidence

| Check | Result |
| --- | --- |
| Targeted ESLint | Pass |
| `npm run typecheck:changed` | Pass |

## Remaining Risk

None identified for the navigation-only change.
