# Task: Change Event SOV FK Matching

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Make change-event budget-code auto-fill from commitment SOV lines prefer
`project_budget_code_id` instead of legacy `budget_code` text.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Load FK audit guidance.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Add `project_budget_code_id` to the shared change-event SOV line type.
- [x] Resolve single-SOV budget codes by FK first.
- [x] Preserve legacy `budget_code` fallback for old rows.
- [x] Fail loudly when SOV lines point at multiple FK-backed budget codes.
- [x] Add targeted unit tests.

## Verification Checklist

- [x] Targeted change-event budget-code matching tests pass.
- [x] Focused lint/type checks pass or blockers are documented.
- [x] Task-owned diff excludes unrelated dirty worktree files.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| FK audit skill | Pass | Loaded `.claude/skills/fk-audit/SKILL.md`; change-event SOV matching maps commitment SOV values to FK-backed budget-code selectors. |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. |
| Targeted tests | Pass | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/change-events/__tests__/budget-code-match.unit.test.ts --runInBand` passed: 8 tests. |
| Focused ESLint | Pass | `cd frontend && ./node_modules/.bin/eslint src/lib/change-events/budget-code-match.ts src/lib/change-events/__tests__/budget-code-match.unit.test.ts src/components/domain/change-events/change-event-form/types.ts` passed. |
| Whitespace check | Pass | `git diff --check -- frontend/src/lib/change-events/budget-code-match.ts frontend/src/lib/change-events/__tests__/budget-code-match.unit.test.ts frontend/src/components/domain/change-events/change-event-form/types.ts docs/ops/tasks/2026-07-07-change-event-sov-fk-matching.md` passed. |
| Changed type debt | Pass | `cd frontend && npm run typecheck:changed` passed with no new `any` debt. |
| Changed lint debt | Pass | `cd frontend && npm run lint:changed:debt` passed across the dirty checkout. |
| Changed route guardrails | Pass | `cd frontend && npm run guardrails:changed` passed for 5 changed routes. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- Change-event commitment SOV auto-fill now resolves by `project_budget_code_id` first.
- Stale or differently formatted legacy `budget_code` text can no longer override the canonical FK.
- Multiple FK-backed SOV budget codes fail with `multiple_codes`, forcing explicit user selection.
- Legacy text matching remains for old SOV rows without `project_budget_code_id`.

## Remaining Risks

- SOV display/export surfaces still show legacy `budget_code` text by design; this task only changes change-event budget-code matching.
- Existing unrelated dirty files remain in the checkout, including generated DB type drift from remote `app_page_tags`; those are intentionally excluded from this task.
