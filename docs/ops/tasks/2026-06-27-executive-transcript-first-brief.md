# Task: Executive Transcript-First Brief

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-740 - https://linear.app/megankharrison/issue/AAI-740/rebuild-executive-daily-brief-as-ai-chief-of-staff-operating-brief

## Objective

Correct the Executive Daily Brief generator so recent meeting transcripts drive
the executive synthesis first, with project, finance, email, Teams, and document
signals layered as supporting context. The target behavior is the user-provided
June 25/26 reference brief: business meaning, cross-meeting patterns, project
health, strategic risks, and a leadership watchlist.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Implementation Checklist

- [x] Identify the live generation files and preserve existing dirty work.
- [x] Add a transcript-first synthesis layer or equivalent generator contract.
- [x] Ensure cross-meeting patterns and project-health output are derived from
      meeting transcript coverage, not only card/item ranking.
- [x] Add fail-loudly/degraded behavior when high source coverage collapses into
      thin final content.
- [x] Keep existing `/executive` rendering compatible with the packet contract.
- [x] Add regression tests for the June 25/26 failure mode.

## Verification Checklist

- [x] Targeted unit tests pass.
- [x] Focused lint/static check passes.
- [x] Changed-file typecheck passes or failure is documented.
- [x] Live or no-write generation preview confirms transcript-first sections are
      populated.
- [x] Evidence below is complete before final response.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Dirty worktree preservation | `git diff > /tmp/alleato-0587-existing-executive-dirty.patch`; `git stash push -u ...` | Pass | Preserved detached-worktree changes before moving to `origin/main`. |
| Unit regressions | `cd frontend && npm run test:unit -- src/lib/executive/__tests__/brandon-daily-update.test.ts src/lib/executive/__tests__/executive-briefing-spacing.test.ts --runInBand` | Pass | 38 tests pass. Covers transcript-first candidate cap, rich-source/thin-brief warning, project label normalization, finance misclassification, and `440 W` renderer preservation. |
| Focused lint | `cd frontend && npx eslint src/lib/executive/brandon-daily-update.ts src/lib/executive/executive-briefing-render.ts src/lib/executive/__tests__/brandon-daily-update.test.ts src/lib/executive/__tests__/executive-briefing-spacing.test.ts` | Pass | No errors. |
| Changed type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| No-write preview | `cd frontend && AI_PROVIDER_PATH=openai npx tsx scripts/preview-daily-brief-text.ts 3` with existing secure local env sourced for the command only | Pass | No DB write. Output included transcript-backed Business Development, 440 W, Port Collective, Company insurance, Internal Ops, and financial CO sections; final visible issue `440 W` renderer stripping was fixed and covered by test. |

## Files To Change

- `frontend/src/lib/executive/brandon-daily-update.ts`
- `frontend/src/lib/executive/__tests__/brandon-daily-update.test.ts`
- `docs/ops/tasks/2026-06-27-executive-transcript-first-brief.md`

## Risks / Gaps

- This must improve the generator, not merely make the page display more
  sections.
- Existing source coverage counts can remain misleading unless the final packet
  records degraded/thin-content warnings.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
