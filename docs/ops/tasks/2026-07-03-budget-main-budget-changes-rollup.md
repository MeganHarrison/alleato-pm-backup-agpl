# Task: Repair Main Budget Budget-Changes Rollup And Column Labels

Status: In Progress
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-910 - https://linear.app/megankharrison/issue/AAI-910/full-budget-end-to-end-audit-and-repair-loop-excluding-erpintegrations
Related Handoff: None

## Objective

Fix the main Budget tab so the `Budget Mods` column is relabeled to `Budget Changes`, numeric headers align with their numeric columns, and approved budget changes actually appear in the main budget table for the exact project route the user is reviewing.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing main budget table, route, and rollup owners identified.
- [x] Existing budget audit / verification docs reviewed.
- [x] Acceptance criteria written as user-visible outcomes.
- [x] Failure-loudly behavior defined for missing approved budget changes.

## Implementation Checklist

- [x] Main Budget tab column label changed from `Budget Mods` to `Budget Changes`.
- [x] Numeric/currency headers aligned to match right-aligned numeric cells.
- [x] Root cause identified for approved budget changes missing from the main budget table.
- [x] Durable fix applied at the shared owner layer, not via a page-local patch.
- [x] Guardrail test updated or added for the affected label/math path.

## Verification Checklist

- [x] Exact `/876/budget` route checked after the fix.
- [x] Read-back of the main budget route or canonical computation confirms approved budget changes are present.
- [x] Targeted automated test run.
- [x] Targeted lint run.
- [x] Browser-visible outcome verified on the exact budget tab.

## Acceptance Criteria

- [x] The main budget table shows `Budget Changes` instead of `Budget Mods`.
- [x] Currency/numeric headers share the same right edge as their numeric values.
- [x] Approved budget changes are visible in the main budget table on the exact route under review.
- [x] The fix relies on the canonical budget data/rollup path rather than duplicated UI-only logic.

## Attention Brief

Primary user: PM/accounting user reviewing the main budget.
Primary job: Trust the visible budget rollups and quickly scan column totals.
Primary decision: Whether approved budget changes are correctly reflected in the main budget table.
Tier 1: Main budget visible financial truth and scanability.
Tier 2: Column naming/alignment consistency.
Tier 3: Low-signal wording outside the main budget table.
Primary action: Load budget, scan columns, confirm approved changes show.
Failure-loudly behavior: If approved budget changes are still missing, record the exact route, target line, expected budget-change amount, actual displayed value, and canonical route/read-back result.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Prior verification context | `docs/ops/tasks/2026-07-03-budget-modifications-visibility-verification.md` | Pass | Earlier run proved approved changes were visible on `/876/budget` after approval, so current failure indicates drift/regression or a path mismatch. |
| Root-cause diagnosis | `frontend/src/lib/budget/compute-grand-totals.ts` | Pass | Canonical helper zeroed `budgetModifications` whenever `v_budget_lines` fell back to raw `budget_lines`; helper was not querying approved `budget_mod_lines` directly. |
| Guardrail test | `cd frontend && ./node_modules/.bin/jest --runInBand 'src/lib/budget/compute-grand-totals.unit.test.ts'` | Pass | Added aggregation coverage proving approved budget modification totals stay isolated by cost code, type, and sub job. |
| Targeted lint | `cd frontend && ./node_modules/.bin/eslint 'src/lib/budget/compute-grand-totals.ts' 'src/lib/budget/compute-grand-totals.unit.test.ts' 'src/components/budget/budget-table.tsx'` | Pass with warnings | No errors. Existing design-system warnings remain on legacy `budget-table.tsx` raw table primitive usage and hand-rolled empty state. |
| Cross-division cleanup | Authenticated browser `PATCH` void on `BM-0004` | Pass | Old same-division approved test change was voided because approved modifications cannot be deleted through the API; the DELETE route only supports draft modifications. |
| Cross-division create + approve | Authenticated browser `POST` + `PATCH submit` + `PATCH approve` on `BM-0005` | Pass | New approved test change transfers `$321.45` from `01-3120` to `03-3000`, forcing non-zero collapsed division totals. |
| Exact-route API read-back | Authenticated browser `fetch('http://localhost:3001/api/projects/876/budget', { cache: 'no-store', credentials: 'include' })` | Pass | Leaf rows returned `01-3120 = ($321.45)` and `03-3000 = $321.45` in `budgetModifications`. |
| Exact-route browser proof | `.codex-artifacts/budgetmods-cross-division-collapsed.png` | Pass | Collapsed division rows show `01 General Requirements = ($321.45)` and `03 Concrete = $321.45` in the `Budget Changes` column on `/876/budget`. |
| Exact-route DOM extraction | Authenticated browser table row read-back | Pass | Row text confirmed collapsed division totals and revised budgets for divisions `01` and `03` matched the approved cross-division transfer. |

## Risks / Gaps

- The checkout is already dirty in many unrelated files, so any finish/publish flow must stage task-owned files only.
- The visible failure may be caused by route data, shared rollup logic, or a stale local app state; only read-back + browser proof can distinguish them.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
