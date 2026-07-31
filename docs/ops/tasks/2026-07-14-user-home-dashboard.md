# Task: User Home Dashboard

Status: In Progress
Owner: Codex
Created: 2026-07-14
Task ID: AAI-1072
Linear Issue: [AAI-1072](https://linear.app/megankharrison/issue/AAI-1072/prepare-authenticated-user-home-dashboard-from-approved-3b-reference)
Related Handoff: `docs/ops/handoffs/2026-07-14-S149-user-home-dashboard.md`

## Objective

Make the existing held-back `/home` route a testable authenticated user dashboard based on the approved 3b reference, without changing post-login routing.

## Scope

- Own the `/home` UI, its existing project, task, calendar, and approval integrations, and focused verification artifacts.
- Reuse `PageShell`, existing app navigation, and existing data owners.
- Exclude auth callbacks, post-login redirect selection, database schema, and production redirect changes.

## Source of Truth

- Canonical route: `frontend/src/app/(main)/home/page.tsx`
- Existing data contracts: `/api/projects`, `/api/tasks?scope=mine`, `/api/home/outlook-calendar`, collaboration notifications.
- Auth holdback: `frontend/src/lib/auth/post-login-router.ts`

## Acceptance Criteria

- [x] `/home` renders the approved home-dashboard hierarchy inside the existing app shell.
- [x] Existing data failures remain specific and visible with a recovery action.
- [x] No post-login redirect contract is changed.
- [x] Desktop and narrow layouts retain usable hierarchy.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Reuse existing data owners and shared layout primitives.
- [x] Implement the dashboard hierarchy and actionable row links.
- [x] Keep unavailable data states explicit and actionable.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Browser proof confirms `/home` loads in the app shell without redirect changes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: each unavailable source identifies its source and returned error.
- Detection path: visible home-route error/unavailable state and focused browser proof.
- Recovery path: linked canonical task/project surface or a reload action.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: existing source-specific load states remain present during the visual restructure.
- Guardrail evidence: focused tests and browser screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Static check | `pnpm --dir frontend exec eslint 'src/app/(main)/home/page.tsx'` | Pass | No errors or warnings. |
| Focused unit test | `pnpm --dir frontend exec jest --runInBand --runTestsByPath 'src/app/(main)/home/__tests__/home-page.test.tsx'` | Pass | 1 suite, 1 test. |
| Auth redirect guard | `git diff -- frontend/src/lib/auth/post-login-router.ts frontend/src/app/auth/callback/route.ts frontend/src/app/api/auth/post-login-redirect/route.ts` | Pass | No changes. |
| Browser proof | Saved session plus env-backed test-account login in `agent-browser` | Blocked | Saved session redirected to `/auth/login`; test-account form submission was intercepted to `https://vercel.com/login?...` before `/home` could load. |

## Remaining Risk

- Browser proof is blocked by the local auth/browser environment. Owner: local test-auth configuration. Next action: repair the test-account login interception, then capture `/home` at desktop and narrow widths.
- Expense coding, announcements, knowledge-base, and daily-brief contracts are not yet owned by the current home data layer; this slice intentionally does not fabricate them.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
