# Task: Notifications Deploy Unblock

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: None
Related Handoff: None

## Objective

Restore the shared notifications/comment-activity helper surface required by `frontend/src/app/(main)/notifications/page.tsx` so the Vercel production build for `alleato-hub` succeeds again.

## Scope Checklist

- [x] Capture the exact failing Vercel deployment error from production logs.
- [x] Confirm the failure owner file(s) and missing import/export contract.
- [x] Apply the minimal shared-helper fix on top of current `origin/main`.
- [ ] Re-run the exact production build command locally against the fixed worktree.
- [ ] Push the fix to `main`.
- [ ] Verify a new Vercel production deployment reaches `READY`.

## Failure Summary

- First failure: missing modules `@/components/notifications/activity-feed` and `@/hooks/use-comment-activity`.
- Current failure after those modules were restored on `main`: `frontend/src/hooks/use-comment-activity.ts` imports `getCommentDiscussionHref` from `frontend/src/lib/collaboration/notification-links.ts`, but `origin/main` does not export that helper yet.

## Evidence

- Failed deployment with budget-change commit: `dpl_6boJLfMg8yvvuKrgBwssY1DhBMfy`
- Failed deployment with notifications restore commit: `dpl_6RbMuWZKER3h5tYn53Bff4yVdtsh`
- Production log excerpt: `Export getCommentDiscussionHref doesn't exist in target module`
- Local validation note: `CI=true pnpm run build:production` in the detached worktree is blocked by Turbopack rejecting the temporary `frontend/node_modules` symlink (`Symlink frontend/node_modules is invalid, it points out of the filesystem root`), so final validation must come from the real Vercel build.
