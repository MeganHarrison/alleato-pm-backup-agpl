# Handoff: 2026-07-13 — Drawing Comments Persistence and Sidebar Linkage

## Intake Block

1) Session ID: S136
2) Task ID: DRAWING-COMMENTS-2026-07-13
3) Linear issue: Unavailable, connector reauthentication required
4) Linear URL: Unavailable
5) Current status: Published to `origin/main` in `466b9032d`
6) Files changed (absolute paths): task/handoff plus drawing viewer, shared Velt layer, header feedback button, drawing comments, `comment-scope.ts`, `comment-scope-store.ts`, and contract tests
7) Commands run and outcome (pass/fail counts): contract tests 6/6 pass; targeted ESLint pass; changed type guard pass; exact-route reload, pin, embedded sidebar, and thread navigation pass; Linear lookup blocked by OAuth reauthentication
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-13-drawing-comments/`
9) Top 3 findings (frontend-visible issues first): the reported comment persisted under the route document while the sidebar queried an entity document; the inline-comments primitive cannot act as a document-wide sidebar; site feedback and drawing discussion both claimed the route document
10) Recommended next action (one line): Monitor the Vercel deployment for commit `466b9032d`, then repeat the reload/sidebar check on production.
11) Handoff file path: `docs/ops/handoffs/2026-07-13-S136-drawing-comments-persistence-sidebar-linkage.md`
12) Migration ledger evidence: N/A, no database migration planned

## Linear Updates

- Kickoff comment: Blocked because the Linear connector returned `oauth_token_invalid_grant` and requires reauthentication.
- Milestone comments: Pending
- Completion/blocker comment: Pending

## Current Status

The reported Velt annotation was confirmed in provider data, then verified after reload as both a drawing pin and one matching embedded-sidebar thread on the exact project 1142 route. Future drawing comments now carry the route document ID explicitly; site feedback uses a separate namespaced document.

## Exact Next Step

Confirm the Vercel production deployment contains commit `466b9032d`, then repeat the reload/sidebar check on production.

## Known Pitfalls

- The global header feedback button intentionally owns a different comment channel.
- A rendered Velt composer does not prove that the drawing annotation and sidebar share a thread.
- Existing unrelated dirty files under `frontend/src/app/(main)/[projectId]/home/**` belong to another session and must not be staged.

## Resume Commands

```bash
git status --short
rg -n "drawingCommentDocumentId|openDrawingComments|VeltInlineCommentsSection" frontend/src
```

## Evidence

- `docs/ops/tasks/2026-07-13-drawing-comments-persistence-sidebar-linkage.md`
- `docs/ops/evidence/2026-07-13-drawing-comments/reload-pin-and-sidebar-linked.png`
