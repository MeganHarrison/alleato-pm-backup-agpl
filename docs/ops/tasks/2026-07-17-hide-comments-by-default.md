# Task: Hide Comments by Default

Status: In Progress
Owner: Codex
Created: 2026-07-17
Task ID: LOCAL-2026-07-17-hide-comments-by-default
Linear Issue: unavailable, local micro-change tracking
Related Handoff: N/A

## Objective

Start the global comments visibility store hidden on every fresh page load so persisted user state cannot cause homepage comment flicker during hydration.

## Scope

- `frontend/src/lib/stores/comments-visibility-store.ts`
- Browser verification is deferred because the local homepage currently returns an internal server error and redirects to login.

## Source of Truth

- Canonical runtime owner: `useCommentsVisibilityStore`, consumed by `VeltGlobalLayer`.
- Existing shared primitive: Zustand store.
- Deprecated or parallel paths: persisted `comments-visibility` localStorage state removed.

Verification contract: Not applicable

## Acceptance Criteria

- [x] Store initializes with comments hidden.
- [x] Persisted hydration cannot re-enable comments during initial page paint.
- [x] Header controls can still enable comments for the current session.
- [ ] Homepage browser screenshot confirms no flicker.

## Implementation Checklist

- [x] Shared store owns the visibility behavior.
- [x] Changed file is listed before closeout.
- [x] Existing persistence path is removed.

## Integration and Verification

- [x] `cd frontend && npx eslint src/lib/stores/comments-visibility-store.ts`
- [ ] Homepage browser verification and screenshot.
- [ ] Task-owned file published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: local homepage returns `Internal Server Error` and redirects to `/auth/login`.
- Detection path: `agent-browser open http://localhost:3000/`.
- Recovery path: restore local authenticated homepage runtime, then recapture the canonical homepage screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Targeted lint | `cd frontend && npx eslint src/lib/stores/comments-visibility-store.ts` | Pass | No output, exit 0. |
| Homepage browser | `agent-browser open http://localhost:3000/` | Blocked | Redirected to login after local internal server error; screenshot is not valid homepage evidence. |

## Remaining Risk

- Homepage visual behavior remains unverified until the local authenticated runtime is available.

## Final Status

- [x] Code change implemented.
- [x] Targeted static check passed.
- [ ] Screenshot evidence captured from the canonical homepage.
- [ ] Task fully verified.
