# Handoff: Meeting lineage temporary page

## Intake Block

1) Session ID: S117
2) Task ID: AAI-971
3) Linear issue: AAI-971
4) Linear URL: https://linear.app/megankharrison/issue/AAI-971/temporary-meeting-lineage-page-for-one-transcript
5) Current status: In Progress
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-07-06-meeting-lineage-temporary-page.md`, `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S117-meeting-lineage-temporary-page.md`, `/Users/meganharrison/Documents/alleato-pm/docs/ops/orchestration/session-board.md`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/meetings/lineage.ts`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/lib/meetings/__tests__/lineage.test.ts`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/[projectId]/meetings/[meetingId]/lineage/page.tsx`
7) Commands run and outcome (pass/fail counts): repo/memory/task reads pass; Linear issue creation pass; live service-role lineage queries pass; `npm run test:unit -- --runInBand --runTestsByPath src/lib/meetings/__tests__/lineage.test.ts src/lib/meetings/__tests__/server.test.ts` pass (2 suites / 14 tests); `./node_modules/.bin/eslint src/lib/meetings/lineage.ts src/lib/meetings/__tests__/lineage.test.ts 'src/app/(main)/[projectId]/meetings/[meetingId]/lineage/page.tsx'` pass; `npm run typecheck:changed` pass; `agent-browser` route open reached `/access-denied?reason=no-project-access` for project 90
8) Evidence artifacts (screenshot/video/report/log paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-meeting-lineage-page-access-denied.png`
9) Top 3 findings (frontend-visible issues first): there was no dedicated frontend surface showing meeting lineage table-by-table; the named meeting fans out heavily into `insight_card_evidence` and `insight_cards` while leaving `meeting_segments` and `meeting_preps` empty; browser proof for the exact project route is blocked for the shared test account because project 90 access is denied
10) Recommended next action (one line): verify the new route with a project-90-capable account or add a company-scoped lineage route if this page needs to be usable without project membership
11) Handoff file path: `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-07-06-S117-meeting-lineage-temporary-page.md`
12) Migration ledger evidence: not applicable

## Linear Updates

- Kickoff comment: posted to AAI-971
- Milestone comments:
- Completion/blocker comment:

## Current Status

The temporary page is implemented at `/${projectId}/meetings/${meetingId}/lineage` and loads live lineage data from the exact meeting/document owner tables. Tests, eslint, and changed-file type checks pass.

## Exact Next Step

Verify the route with an account that has access to project 90, or create a company-scoped companion route if the page needs to be reachable without project membership.

## Known Pitfalls

Meeting lineage crosses `document_metadata`, `meetings`, `meeting_segments`,
`meeting_preps`, `insight_cards`, and `insight_card_evidence`, and not every
row is linked the same way.

The shared `test1@mail.com` browser account cannot currently open project 90, so exact-route browser verification lands on `/access-denied?reason=no-project-access` even when the page code is correct.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
git status --short
rg -n "meeting|insight_card|meeting_preps|meeting_segments" frontend/src backend/src supabase
cd frontend
npm run test:unit -- --runInBand --runTestsByPath src/lib/meetings/__tests__/lineage.test.ts src/lib/meetings/__tests__/server.test.ts
./node_modules/.bin/eslint src/lib/meetings/lineage.ts src/lib/meetings/__tests__/lineage.test.ts 'src/app/(main)/[projectId]/meetings/[meetingId]/lineage/page.tsx'
```

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-07-06-meeting-lineage-page-access-denied.png`
