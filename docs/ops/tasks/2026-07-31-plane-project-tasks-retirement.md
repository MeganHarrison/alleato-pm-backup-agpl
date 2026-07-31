# Task: Retire legacy project Tasks composition

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: AAI-1292

Delivery lane: High-risk

## Objective

Retire the superseded project-scoped Tasks composition only after the Plane Work
Items replacement is production-proven, while preserving company-wide Tasks and
existing project-task deep links.

## Acceptance contract

- [x] Plane replacement is production deployed and desktop/mobile verified.
- [x] User explicitly approved retirement after reviewing production proof.
- [x] `/[projectId]/tasks` redirects to `/[projectId]/plane/work-items`.
- [x] Legacy `task` query values translate to canonical `peek` values.
- [x] Compatible view and filter query state survives the redirect.
- [x] `/[projectId]/tasks/kanban` redirects to Plane board view.
- [x] Company-wide `/tasks` remains unchanged.
- [x] The now-unused project-only `TasksInboxClient` wrapper is deleted.
- [x] Focused route, URL-contract, and strict project-ID tests pass: 3 suites,
  23 tests (`work-items-query`, `plane-surface-rewrite`, and
  `plane-surface-access`).
- [ ] Exact AGPL source mirror is published before production deployment.
- [ ] Production redirects and canonical Plane rendering are browser verified.

## Failure-loudly contract

- Invalid project identifiers continue to render the route-level 404.
- Unsupported legacy query values are discarded by the canonical Plane query
  parser instead of silently influencing the replacement view.
- Tests reject restoration of `TasksInboxClient` to the project route.
- Tests pin `task` to `peek` translation and the canonical board destination.

## Production evidence

- Replacement deployment: `dpl_3oyfvYyWwgLmnWjKsZtDhByK98jK`
- Replacement commit: `b38e20e67460661ade84291331299926c6ba0fda`
- Authenticated proof: `tests/agent-browser-runs/2026-07-31-plane-batch2-production-corrected`

## Closeout

- Cause: the project `/tasks` route still retained its pre-Plane composition
  after the replacement route was released.
- Detection gap: replacement verification did not itself remove or reject the
  legacy direct entry point.
- Prevention: canonical compatibility redirects plus URL-contract and source
  guard tests make restoration of the retired composition fail loudly.
