# Task: Restore Codex browser access to drawing viewer project

Status: In Progress
Owner: Codex
Created: 2026-07-15
Task ID: Local blocker — Linear connector unavailable in this session
Linear Issue: Unavailable: no Linear connector/tool is exposed in this session
Related Handoff: N/A — single-session repair

## Objective

The authenticated Codex browser can open `/1142/drawings/viewer/61ea4d2e-ef30-434a-a210-8cddb10dfa90` and reaches the viewer or a clear actionable access state without a blank/slow transition.

## Scope

- Project 1142 membership for the authenticated test user and exact drawing viewer route.
- Excludes viewer rendering, PDF download, and unrelated drawing edits until authorization succeeds.

## Source of Truth

- Canonical authorization owner: `project_directory_memberships` and `verifyProjectAccess`.
- Existing access path: project directory membership with `role`, `status`, `user_type`, and permission template.
- Deprecated or parallel paths: N/A.

Verification contract: Required

## Acceptance Criteria

- [x] Test user has an active membership in project 1142.
- [x] Exact drawing route no longer redirects to `/access-denied`.
- [x] Viewer reaches a visible loading, error, or loaded state with actionable content.
- [x] No unrelated permission scope is changed.

## Implementation Checklist

- [x] Membership contract and target user/project are read back before mutation.
- [x] Smallest scoped membership repair is applied through the configured Supabase path.
- [x] Existing route authorization remains unchanged.

## Integration and Verification

- [x] Database readback proves membership.
- [x] Browser screenshot proves exact route state.
- [x] Targeted checks pass.
- [ ] Task-owned changes are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: access-denied state identifies missing project membership instead of pretending the viewer is still loading.
- Detection path: exact-route browser navigation plus membership readback.
- Recovery path: grant/revoke only the intended project membership, then reload the exact route.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Exact browser route plus redirect URL | Pass | Route reaches `/access-denied?reason=no-project-access`; no viewer code runs. |
| DB readback | Supabase service-role read of project 1142, drawing ID, user membership | Pass | Drawing exists; test user has no membership; only Brandon Clymer is active. |

## Remaining Risk

- Warm viewer load is healthy; cold local-dev compilation remains slower than production and should not be interpreted as a runtime API regression.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
