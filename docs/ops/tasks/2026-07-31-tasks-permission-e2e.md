# Task: Restore authenticated Tasks list access

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: tasks-permission-e2e
Linear Issue: Not requested; production permission regression
Related Handoff: N/A

## Objective

Allow authenticated users to load their assigned Tasks without granting client-side table access or bypassing the existing scope authorization contract.

## Scope

- `/api/tasks` list-read client selection and focused regression coverage.
- Production authenticated browser proof for `/tasks`.
- Excludes changes to table RLS policies, task schema, task creation, and unrelated Tasks UI work.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/api/tasks/route.ts`
- Existing shared primitives/services: `getApiRouteUser`, `serviceDb`, `createServiceClient`, `withApiGuardrails`
- Deprecated or parallel paths: authenticated user RLS client for this server-side list read

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] An authenticated `scope=mine` request returns a task list or valid empty result, not a database permission error.
- [ ] `scope=mine` remains limited to the authenticated user by durable person ID, email, or name fallback.
- [ ] `scope=all` remains admin-only.
- [ ] The browser runner reports no Tasks list browser errors in production.
- [x] The failure is covered by a focused regression test.
- [x] Independent authorization review finds no `mine` to `all` escalation or client-permission broadening.

## Localized Boundary Evidence

- Browser → API: authenticated production `GET /api/tasks?scope=mine` returned HTTP 500 with `permission denied for table tasks` (request ID `e8c9b77a-2258-4948-b4f6-90a8f8b23592`).
- API → DB: the route selects the RLS-bound server client for `scope=mine`; the same production table read through the service client succeeds (915 rows).
- First divergent boundary: API query-client selection. Authentication and the service-role database connection are both confirmed upstream.

## Failure-Loudly Contract

- Cause surfaced as: typed API error plus browser E2E failure when the Tasks request returns a console error.
- Detection path: `npm run e2e:browser -- --base-url https://projects.alleatogroup.com --route /tasks`.
- Recovery path: inspect `/api/tasks` query-client selection and the documented scope filters before changing database permissions.

## Incident Learning

- Failure fingerprint: `tasks-list-rls-client-mismatch`
- Root cause: `scope=mine` used the RLS-bound server client even though the route had already authenticated the request and implemented its own server-side scope filter. That client lacks `tasks` SELECT access in production.
- Detection gap: Authenticated route proof did not treat console/API errors as a failed browser result.
- Prevention: One-command browser E2E now fails on browser-reported errors; add server-route regression coverage for the service-owned read boundary.
- Guardrail evidence: `frontend/src/app/api/tasks/__tests__/route.test.ts` proves service-owned reads, assignee filtering, fail-closed missing-email behavior, and the admin-only all scope.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Browser reproduction | authenticated `agent-browser` session on `https://projects.alleatogroup.com/tasks` | Fail | DOM toast and console report `/api/tasks` permission error. |
| API response | browser `fetch('/api/tasks?scope=mine')` | Fail | HTTP 500, `INTERNAL_ERROR`, `permission denied for table tasks`. |
| Service DB readback | service-role `tasks` count query | Pass | Read succeeded with 915 rows; no database policy mutation is needed. |
| Focused route regression | `NODE_PATH=/Users/meganharrison/Documents/alleato-pm-backup/frontend/node_modules /Users/meganharrison/Documents/alleato-pm-backup/frontend/node_modules/.bin/jest --runInBand src/app/api/tasks/__tests__/route.test.ts` | Pass | 3 tests passed. |
| Independent review | `/root/tasks_permission_review` | Pass | Server-only access remains scoped in-route; empty-email path fails closed; admin-only all scope is preserved. |
| Pre-release verification contract | `docs/ops/evidence/2026-07-31-tasks-permission-e2e/verification-manifest.json` | Pass | Regression, negative paths, database readback, and independent review support the scoped code release. |

## Remaining Risk

- The service client must remain server-only, and every future list scope must keep explicit filtering/authorization in the route.
- Pre-existing caution: name fallback can overmatch users with the same name when no people/email match is available; not introduced by this fix.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
