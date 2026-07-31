# Task: Budget Rollups SOV FK Read

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Move budget grand-total rollups from legacy commitment SOV `budget_code` text
matching to canonical `project_budget_code_id` matching, while retaining text
fallback for legacy rows.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before touching database-backed code.
- [x] Select `project_budget_code_id` in subcontract SOV rollup queries.
- [x] Select `project_budget_code_id` in purchase-order SOV rollup queries.
- [x] Prefer FK-based mapping in pending cost changes.
- [x] Prefer FK-based mapping in committed costs.
- [x] Keep legacy text fallback for old rows.
- [x] Add targeted unit tests.

## Verification Checklist

- [x] Targeted budget rollup unit tests pass.
- [x] Focused lint/type checks pass or blockers are documented.
- [x] Task-owned diff excludes unrelated dirty worktree files.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| DB types preflight | Pass | Ran `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts`; command succeeded with existing inbucket deprecation warning. |
| Targeted tests | Pass | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/budget/compute-grand-totals.unit.test.ts --runInBand` passed: 21 tests. |
| Focused ESLint | Pass | `cd frontend && ./node_modules/.bin/eslint src/lib/budget/compute-grand-totals.ts src/lib/budget/compute-grand-totals.unit.test.ts` passed. |
| Whitespace check | Pass | `git diff --check -- frontend/src/lib/budget/compute-grand-totals.ts frontend/src/lib/budget/compute-grand-totals.unit.test.ts docs/ops/tasks/2026-07-07-budget-rollups-sov-fk-read.md` passed. |
| Changed type debt | Pass | `cd frontend && npm run typecheck:changed` passed with no new `any` debt. |
| Changed lint debt | Pass | `cd frontend && npm run lint:changed:debt` passed across the dirty checkout. |
| Changed route guardrails | Pass | `cd frontend && npm run guardrails:changed` passed for 5 changed routes. |

## Final Status

- [x] Code changes complete.
- [x] Verification complete.
- [x] Remaining risks documented.

## Behavior Implemented

- Budget grand-total SOV queries now select `project_budget_code_id` for subcontract and purchase-order SOV rows.
- Pending cost changes and committed costs now resolve SOV rows by `project_budget_code_id` first.
- Legacy `budget_code` text matching remains as fallback for old rows and staged/imported data.
- Unit tests cover FK precedence, legacy project-budget-code ID fallback, normalized text fallback, and blank rows.

## Remaining Risks

- Other read surfaces outside grand totals may still display or match on legacy `budget_code` text.
- Existing unrelated dirty files remain in the checkout, including generated DB type drift from remote `app_page_tags`; those are intentionally excluded from this task.
