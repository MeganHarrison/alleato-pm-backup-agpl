# Task: Executive Brief Stale Operating Readback

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: Not created - production bug follow-up scoped to existing executive brief task

## Objective

Fix `/executive` so regenerated or previously stored Daily Brief packets cannot
hide the new AI Chief of Staff sections when the stored `operatingBrief` object
is stale or missing the newer fields.

## Root Cause Evidence

- Production `daily_recaps` row for `recap_date=2026-06-27` regenerated at
  `2026-06-27T14:35:13.940Z`.
- The stored packet had `operatingBrief` as an object, but `businessHealth=false`
  and `chiefOfStaffInsights=false`.
- `/executive` used `packet.operatingBrief ?? buildExecutiveOperatingBrief(...)`,
  so an old-format `operatingBrief` object blocked the derived new sections.

## Scope Checklist

- [x] Root cause checked against production DB readback.
- [x] Fix defined at shared executive brief contract/read path.
- [x] Stored old-format packets hydrate missing chief-of-staff fields.
- [x] `/executive` uses the hydrated operating brief.
- [x] Recap text render path uses the hydrated operating brief.
- [x] Regression test covers stale stored `operatingBrief` readback.

## Verification Checklist

- [x] Targeted unit test run.
- [x] Focused lint/check run for touched executive files.
- [x] Production publish or explicit blocked status recorded.
- [x] Evidence recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production DB readback | `daily_recaps` query for latest `executive_briefing` packets | Fail reproduced | Latest row generated after deploy but missing new operating brief fields. |
| Regression unit test | `cd frontend && npm run test:unit -- src/lib/executive/__tests__/brandon-daily-update.test.ts --runInBand` | Pass | 26 tests passed, including stale stored operating brief hydration. |
| Focused ESLint | `cd frontend && npx eslint src/lib/executive/brandon-daily-update.ts src/lib/executive/executive-briefing-workflow.ts src/lib/executive/__tests__/brandon-daily-update.test.ts 'src/app/(main)/executive/page.tsx'` | Pass with warnings | 0 errors. Existing design-system warnings remain in executive page raw detail/grid markup. |
| Changed type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |

## Files To Change

- `frontend/src/lib/executive/brandon-daily-update.ts`
- `frontend/src/lib/executive/executive-briefing-workflow.ts`
- `frontend/src/app/(main)/executive/page.tsx`
- `frontend/src/lib/executive/__tests__/brandon-daily-update.test.ts`
- `docs/ops/tasks/2026-06-27-executive-brief-stale-operating-readback.md`
