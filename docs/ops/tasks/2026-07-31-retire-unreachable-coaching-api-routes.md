# Task: Retire Unreachable Coaching API Routes

Status: Complete
Owner: Codex S1300
Created: 2026-07-31
Task ID: LOCAL-2026-07-31-RETIRED-COACHING-API
Linear Issue: N/A - one bounded source-contract cleanup
Related Handoff: N/A - one-session task

## Objective

Remove the two dynamic Manager Coaching API contracts that have no route consumer or reachable session workspace, reclaiming six generated Vercel routes without changing the live training experience.

## Scope

- Delete the unreachable `GET`/`PUT` session route and `POST` action route under `api/training/coaching/[sessionId]`.
- Regenerate the canonical project and system route inventories.
- Exclude the coaching landing page, collection API, database schema, historical task records, and implementation of the deferred session workspace.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/training/coaching/route.ts` and `frontend/src/features/training/coaching-session-server.ts`
- Existing shared primitives/services: `frontend/src/features/training/coaching-session.ts`
- Deprecated or parallel paths: `frontend/src/app/api/training/coaching/[sessionId]/route.ts` and `frontend/src/app/api/training/coaching/[sessionId]/[action]/route.ts`

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The two unreachable dynamic route modules are absent from source.
- [x] No product source, generated current-route inventory, or API map advertises either deleted path.
- [x] The canonical collection endpoint and launch page remain untouched.
- [x] The dynamic-route budget drops by two modules (six estimated Vercel routes).

## Implementation Checklist

- [x] Delete the two route modules.
- [x] Regenerate the project and system maps.
- [x] Confirm the orphaned-route audit contains no remaining dynamic API candidates.

## Integration and Verification

- [x] Targeted route-budget and route-conflict checks pass.
- [x] Generated inventories contain neither deleted API path.
- [x] Evidence is recorded below.
- [x] Task-owned source files are published to `origin/main` at `653f8fd8c7cf91772c661412b2156a1ef9eca669`.

## Failure-Loudly Contract

- Cause surfaced as: Any attempted use of the retired contract receives Next.js's explicit 404 because no compatibility endpoint remains.
- Detection path: `node scripts/audits/audit-orphaned-api-routes.mjs`, `npm run check:routes`, and generated route-map checks.
- Recovery path: Reintroduce the complete session workspace and its matching API contract together; do not restore standalone endpoints without a caller.

## Incident Learning

- Failure fingerprint: `deployment.vercel-generated-route-limit`
- Root cause: A Manager Coaching API foundation landed before its dynamic session workspace, leaving two Vercel route modules with no caller.
- Detection gap: The route budget guard counted capacity but did not identify dead dynamic API modules by caller reachability.
- Prevention: The orphaned API audit is the deletion gate; session routes must land with their caller in the same change.
- Guardrail evidence: `node scripts/audits/audit-orphaned-api-routes.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Pre-change localization | orphaned API audit plus Training Coaching source search | Pass | Both candidate modules had no product caller; the linked workspace routes do not exist. |
| Dynamic budget | `node frontend/scripts/build/check-nonprod-routes.mjs` | Pass | 642/654 dynamic source modules; estimated 2,006/2,042 generated routes. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Orphan audit | `node scripts/audits/audit-orphaned-api-routes.mjs` | Pass | Zero remaining dynamic API candidates without a source caller. |
| Generated maps | `npm run map:project -- --check-only`; `npm run map:system -- --check-only` | Pass | Removed API contracts are absent and current generated maps validate. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Publication | `npm run codex:finish -- --session S1300 --staged-only --message "Retire unreachable coaching API routes"` | Pass | Published six task-owned files to `origin/main` at `653f8fd8c7cf91772c661412b2156a1ef9eca669`. |

## Remaining Risk

- The hidden coaching launch page still contains deferred workspace links. Its repair or full retirement is intentionally outside this route-budget cleanup.

## Final Status

- [x] All required checklist items are complete after publication.
- [x] Evidence is filled in.
