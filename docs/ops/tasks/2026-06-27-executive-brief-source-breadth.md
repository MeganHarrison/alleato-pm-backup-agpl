# Task: Executive Brief Source Breadth

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: Not created - production quality regression on existing Executive Brief work

## Objective

Fix the Executive Daily Brief quality failure where production source coverage
shows hundreds of recent records but the final brief collapses to Goodwill plus
one Acumatica aggregate.

## Root Cause Evidence

- `daily_recaps` for `2026-06-27` has source coverage of 234 emails, 78 Teams
  messages, 23 meetings, and 1 document.
- The stored packet has only 2 surfaced items across 2 project labels.
- `ai_work_run_sources` for the run contains only 3 refs: two Goodwill operating
  records and one Acumatica aggregate.
- Derived sections repeat the same `$422K pending COs` aggregate across multiple
  sections, making the brief feel broken even when technically source-backed.

## Scope Checklist

- [x] Production packet/source refs inspected.
- [x] Add a source-breadth guard so low-count synthesis output is supplemented from the seeded candidate set.
- [x] Keep added breadth capped and source-backed.
- [x] Reduce finance aggregate duplication in derived operating sections.
- [x] Add regression coverage for low-count synthesis/source-breadth behavior.

## Verification Checklist

- [x] Targeted unit test run.
- [x] Focused lint/check run for touched executive files.
- [x] Publish or explicitly record blocked status.
- [x] Evidence recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Production packet readback | `daily_recaps` query for `2026-06-27` | Fail reproduced | 2 final items despite broad source coverage. |
| AI Ops source refs | `ai_work_run_sources` query for run `5f0c2913-451f-4b8d-8c0e-425a0b56a068` | Fail reproduced | Only 3 refs: two Goodwill records and one Acumatica aggregate. |
| Regression unit test | `cd frontend && npm run test:unit -- src/lib/executive/__tests__/brandon-daily-update.test.ts --runInBand` | Pass | 29 tests passed, including source breadth and finance aggregate duplication coverage. |
| Focused ESLint | `cd frontend && npx eslint src/lib/executive/brandon-daily-update.ts src/lib/executive/__tests__/brandon-daily-update.test.ts` | Pass | 0 errors. |
| Changed type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
