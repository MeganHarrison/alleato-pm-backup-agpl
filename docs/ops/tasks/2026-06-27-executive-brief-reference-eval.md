# Task: Executive Brief Reference Eval

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-740 - https://linear.app/megankharrison/issue/AAI-740/rebuild-executive-daily-brief-as-ai-chief-of-staff-operating-brief

## Objective

Add a durable evaluation guardrail that scores the Executive Daily Brief against
the user-provided June 25/26 reference brief quality bar: multi-project coverage,
cross-meeting synthesis, business-health framing, strategic risks, leadership
watchlist, actionability, and duplicate-topic suppression.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Implementation Checklist

- [x] Define an executable reference-quality rubric for executive brief packets.
- [x] Add regression coverage showing the prior Goodwill / duplicate-$422K style
      packet fails the rubric.
- [x] Add regression coverage showing a June 25/26 reference-shaped operating
      brief passes the rubric.
- [x] Keep the eval packet-level and deterministic so it can run without live AI
      calls or database writes.
- [x] Add a live verifier script that scores the latest stored `daily_recaps`
      packet.
- [x] Fix remaining live failures: one-pattern output and repeated aggregate
      financial-topic surfacing.

## Verification Checklist

- [x] Targeted unit tests pass.
- [x] Focused lint/static check passes.
- [x] Changed-file typecheck passes or failure is documented.
- [x] Evidence below is complete before final response.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Unit regressions | `cd frontend && npm run test:unit -- src/lib/executive/__tests__/executive-brief-reference-eval.test.ts --runInBand` | Pass | 3 tests pass. The prior Goodwill / duplicate-$422K thin packet fails the rubric; a June 25/26 reference-shaped operating brief passes. |
| Generator + eval unit regressions | `cd frontend && npm run test:unit -- src/lib/executive/__tests__/brandon-daily-update.test.ts src/lib/executive/__tests__/executive-brief-reference-eval.test.ts --runInBand` | Pass | 39 tests pass. Adds coverage for fallback Emerging Patterns and keeping aggregate financial topics out of repeated derived sections. |
| Focused lint | `cd frontend && npx eslint --no-warn-ignored scripts/evaluate-executive-brief-reference.ts src/lib/executive/brandon-daily-update.ts src/lib/executive/executive-brief-reference-eval.ts src/lib/executive/__tests__/brandon-daily-update.test.ts src/lib/executive/__tests__/executive-brief-reference-eval.test.ts` | Pass | No errors. |
| Changed type debt | `cd frontend && npm run typecheck:changed` | Pass | No new `any` usage detected. |
| Live regeneration | `cd frontend && AI_PROVIDER_PATH=openai npx tsx scripts/regenerate-executive-briefing.ts` with secure local env sourced for the command only | Pass | Regenerated daily recap `65817931-5259-421e-a3c4-bbb43fcd09aa`; AI Ops run `739d3e9f-15e4-45ea-81db-cadcc46006ad`; 7 items. |
| Live reference eval | `cd frontend && npx tsx scripts/evaluate-executive-brief-reference.ts` | Pass | Latest stored packet scored 100/100: 7 items, 6 project/context labels, 6 meeting-backed items, 2 Emerging Patterns, no repeated `$422K` aggregate topic. |

## Files To Change

- `frontend/src/lib/executive/executive-brief-reference-eval.ts`
- `frontend/src/lib/executive/__tests__/executive-brief-reference-eval.test.ts`
- `frontend/src/lib/executive/brandon-daily-update.ts`
- `frontend/src/lib/executive/__tests__/brandon-daily-update.test.ts`
- `frontend/scripts/evaluate-executive-brief-reference.ts`
- `docs/ops/tasks/2026-06-27-executive-brief-reference-eval.md`

## Risks / Gaps

- A rubric is a guardrail, not a substitute for reading the final brief; it must
  detect structural collapse without overfitting to exact June 25/26 wording.
- Live visual verification remains auth-gated in this Codex session unless a
  valid browser session is available.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
