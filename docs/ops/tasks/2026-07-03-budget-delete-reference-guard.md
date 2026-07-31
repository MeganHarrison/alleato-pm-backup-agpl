# Task: Fail Loudly When Budget Line Delete Is Blocked By References

Status: Blocked/Deferred
Owner: Codex
Created: 2026-07-03
Linear Issue: AAI-910 - https://linear.app/megankharrison/issue/AAI-910/full-budget-end-to-end-audit-and-repair-loop-excluding-erpintegrations
Related Handoff: None

## Objective

Make budget-line deletion fail loudly when a supposedly deletable `$0` line is
still referenced by downstream workflow records, instead of letting Postgres
surface a generic internal/foreign-key error.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Root cause captured from live verification evidence.
- [x] Canonical owner route for delete behavior identified.
- [x] Blocking reference source-of-truth identified.
- [x] Failure-loudly behavior defined before edits.

## Implementation Checklist

- [x] Route-level guard added before the destructive delete call.
- [x] Returned error is specific, actionable, and budget-domain aware.
- [x] Shared/central path updated instead of page-local workaround.
- [x] No silent fallback to generic API error for the known blocker path.

## Regression Guardrails

- [x] Focused route test added for referenced budget lines.
- [x] Existing delete rule coverage still passes after the change.
- [x] Verification artifacts updated with the new behavior.

## Verification Checklist

- [x] Targeted automated test run completed.
- [ ] Narrow lint/static check completed.
- [x] Live route re-verified or explicitly deferred with cause.
- [x] Evidence recorded below.

## Attention Brief

Primary user: PM/accounting user maintaining budget structure.
Primary job: Delete only truly safe zero-budget lines and get an exact reason
when a line cannot be removed.
Primary decision: Whether a line is actually deletable or must be handled
through a dependent workflow first.
Tier 1: Prevent destructive ambiguity on live budget rows.
Tier 2: Surface the exact workflow that owns the block.
Primary action: Delete a `$0` line item from the budget grid.
Failure-loudly behavior: If a line is still referenced by change-event records,
the API must return a budget-specific `409` with actionable context before the
database delete executes.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Root cause | `verify-output/budget-functionality/screenshots/budget-zero-line-delete-*.png` + server log | Pass | Live delete on project `760` hit `change_event_line_items_budget_line_id_fkey` and returned a generic `INTERNAL_ERROR`/`Referenced record not found.` |
| Owner route | `frontend/src/app/api/projects/[projectId]/budget/lines/[lineId]/route.ts` | Pass | Canonical delete path identified. |
| Route regression test | `NODE_PATH="$(find node_modules/.pnpm -maxdepth 2 -type d -name node_modules | paste -sd: -)" node node_modules/.pnpm/jest@30.2.0_@types+node@22.19.8_babel-plugin-macros@3.1.0_esbuild-register@3.6.0_esbuild@0.25.12_/node_modules/jest/bin/jest.js --runInBand --runTestsByPath 'src/app/api/projects/[projectId]/budget/lines/[lineId]/__tests__/route.test.ts'` | Pass | 7/7 tests passed, including the new `LINE_HAS_CHANGE_EVENT_REFERENCES` guard. |
| Lint attempt | `NODE_PATH=... node node_modules/.pnpm/eslint@9.39.2_jiti@2.7.0/node_modules/eslint/bin/eslint.js ...` | Blocked | `eslint.config.mjs` could not import `eslint-plugin-storybook` through the stale workspace symlink layout. |
| Live reverify attempt | Authenticated `DELETE /api/projects/760/budget/lines/78ffefab-9705-4e0c-b966-2bd68e238772` | Pass | Live route now returns `409 INVALID_PAYLOAD` with `details.code=LINE_HAS_CHANGE_EVENT_REFERENCES` and reference id `507912f8-ba6b-4f43-8bf2-d74eba4d80ae`. |

## Risks / Gaps

- The verified live blocker came from `change_event_line_items`; additional future blockers may still exist if new references are added without route-level guards.
- Narrow ESLint still cannot complete through the repo config because `eslint-plugin-react-hooks` resolution is broken in this checkout.

## Blocker Record

Cause: The code fix is fully verified functionally, but the repo-local ESLint config still cannot resolve `eslint-plugin-react-hooks`.
Detection gap: Functional verification passed earlier than static verification, so the dependency-resolution issue only surfaced during final closeout.
Prevention step: Repair the frontend ESLint dependency resolution so narrow file-scoped lint can run through the normal repo command path.
Owner: Codex or whoever owns local dependency repair in this checkout.
Next action: Reconcile the frontend ESLint plugin install/resolution and rerun the narrow lint command on the touched budget files.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
