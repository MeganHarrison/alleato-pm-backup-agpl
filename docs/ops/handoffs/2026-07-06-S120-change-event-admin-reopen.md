# Handoff: 2026-07-06 — Change event admin reopen

## Intake Block

1) Session ID: S120
2) Task ID: AAI-977
3) Linear issue: AAI-977
4) Linear URL: https://linear.app/megankharrison/issue/AAI-977/admin-change-event-reopen-after-approved-downstream-pcoco-lineage
5) Current status: Blocked/Deferred
6) Files changed (absolute paths): /Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-change-event-admin-reopen.md; /Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S120-change-event-admin-reopen.md; /Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md; /Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx; /Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/__tests__/page.test.tsx
7) Commands run and outcome (pass/fail counts): 1 focused Jest pass; 1 focused ESLint pass on test file; Supabase read/update/read-back pass; browser route verification blocked by exact-route `Internal Server Error`
8) Evidence artifacts (screenshot/video/report/log paths): /tmp/aai977-change-event-approved.png; /tmp/aai977-change-event-open.png
9) Top 3 findings (frontend-visible issues first):
- Canonical change-event detail menu lacks a path back to `Open` after `Approved` or `Closed`.
- The PATCH route already accepts status updates with change-order write permission.
- The named record likely needs an immediate data update in addition to the durable UI fix.
10) Recommended next action (one line): Add the reopen action, verify the named record state, then run targeted UI and API proof.
11) Handoff file path: docs/ops/handoffs/2026-07-06-S120-change-event-admin-reopen.md
12) Migration ledger evidence: N/A

## Linear Updates

- Kickoff comment: posted
- Milestone comments: pending
- Completion/blocker comment: pending

## Current Status

Task created, Linear issue created, route and API ownership reviewed, canonical detail menu patched with a `Reopen` action that dispatches `open`, focused regression test added and passing, and the named change-event row read back as `Open` after service-role update. Live route proof is blocked because the exact page currently renders `Internal Server Error` in browser even when the row is already `Open`.

## Exact Next Step

Trace the existing route-level `Internal Server Error` on `/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9` so live browser proof can be completed.

## Known Pitfalls

Status labels are a mix of normalized UI values and persisted title-case DB values. Any reopen action must write the server-accepted `Open` value and not introduce a second status alias. Separate that from the current route-level runtime failure, which reproduces even when the DB row is already `Open`.

## Resume Commands

```bash
sed -n '360,560p' 'frontend/src/app/(main)/[projectId]/change-events/[changeEventId]/page.tsx'
sed -n '200,320p' 'frontend/src/hooks/use-change-event-detail.ts'
./node_modules/.bin/jest --runInBand --runTestsByPath 'src/app/(main)/[projectId]/change-events/[changeEventId]/__tests__/page.test.tsx'
agent-browser --session-name alleato-test-3001 open http://localhost:3001/876/change-events/927f077e-3883-441c-b275-58b55a4f9db9
```

## Evidence

Links to logs/tests/screenshots.
