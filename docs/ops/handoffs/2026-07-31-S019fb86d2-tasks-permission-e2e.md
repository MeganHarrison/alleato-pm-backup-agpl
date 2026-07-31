# Tasks permission E2E handoff

Session: S019fb86d2
Status: In progress — pre-release regression and authorization evidence pass; production browser proof follows deployment.

## Owned paths

- `frontend/src/app/api/tasks/route.ts`
- `frontend/src/app/api/tasks/__tests__/route.test.ts`
- `docs/ops/tasks/2026-07-31-tasks-permission-e2e.md`
- `docs/ops/evidence/2026-07-31-tasks-permission-e2e/`

## Root cause and repair

Production authenticated `GET /api/tasks?scope=mine` returned HTTP 500 because the route used the RLS-bound request client for the table read. The route already authenticates and applies explicit server-side scope filters. It now uses the canonical server-only `serviceDb` owner, and fails closed if the authenticated email is missing.

## Evidence

- Service owner production readback: 915 `tasks` rows, no error.
- Focused Jest route suite: PASS, 3 tests.
- Independent authorization review: APPROVED.

## Remaining action

Publish the exact owned paths, wait for the production deployment, and capture an authenticated `/tasks` browser result with no API/console error.
