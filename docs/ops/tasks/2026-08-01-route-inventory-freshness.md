# Task: Make the Route Inventory a Freshness Gate

Status: Complete
Owner: Codex S1301
Created: 2026-08-01
Task ID: LOCAL-2026-08-01-ROUTE-INVENTORY-FRESHNESS
Linear Issue: N/A - bounded deployment guardrail repair

## Objective

Reject a route-budget check when its Page Access route inventory no longer matches `frontend/src/app`, so the list used to decide deletions is current source rather than a stale snapshot.

Delivery lane: Standard

## Acceptance Criteria

- [x] A stale route inventory produces a specific error with its regeneration command.
- [x] The production dynamic-route guard invokes the freshness assertion.
- [x] The guard permits a regenerated inventory.
- [x] The current generated inventory is refreshed and ready to publish with the guard.

## Failure-Loudly Contract

- Cause surfaced as: snapshot and current source route counts are reported together.
- Detection path: `npm run verify:nonprod-routes`.
- Recovery: run `node scripts/verify/route-audit.mjs`, review the list, and commit the generated snapshot.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Focused generator test | Pass | Six route-inventory tests pass, including stale-snapshot rejection and fresh-snapshot acceptance. |
| Route guard | Pass | `node frontend/scripts/build/check-nonprod-routes.mjs` accepts the regenerated 1,138-row inventory and reports 643/654 dynamic source modules (2,009/2,042 estimated generated routes). |
| Publication | Pass | Published five exact task files to `origin/main` at `222016ace74a42d1beb1733bbbb24061db5e4f3c`. |

## Final Status

- [x] The current route list and its stale-snapshot guard are published.
