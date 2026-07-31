# Task: Automatic Billing Period First-Cycle Creation

Status: Completed
Owner: Codex
Created: 2026-07-29
Task ID: ALL-51
Linear Issue: [ALL-51](https://linear.app/alleato-group/issue/ALL-51/automatic-billing-schedules-should-create-the-first-period-and-honor)
Related Handoff: `docs/ops/handoffs/2026-07-29-SROOT-ALL-51-automatic-billing-periods.md`

## Objective

Saving an automatic billing schedule creates all periods due as of the save date, including the first period on an empty project, and monthly schedules can explicitly anchor From to the first day and To to the last day of each calendar month.

## Scope

- Automatic billing configuration/generation database functions, calendar-boundary UI, focused tests, live readback, and authenticated route proof.
- Excludes changes to owner/subcontractor invoice amounts, payment calculations, and existing linked billing-period history.

## Source of Truth

- Canonical runtime/data owner: `public.invoicing_settings`, `public.billing_periods`, and their atomic RPCs.
- Existing shared primitives/services: `frontend/src/features/invoicing/BillingPeriodsWorkspace.tsx`, shared `DateField`, `Checkbox`, and billing-period hooks.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] An empty project can save a monthly automatic schedule without manually creating a period first.
- [x] Every occurrence due as of the schedule save date is created immediately and idempotently.
- [x] Monthly From can be anchored to the first calendar day and To to the final calendar day.
- [x] February, leap February, 30-day months, and 31-day months do not drift.
- [x] Conflicting existing ranges fail loudly and roll back the schedule change.
- [x] Historical catch-up cannot replace a newer open period.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared database generation owns both immediate creation and the daily cron path.
- [x] Errors are specific and actionable.
- [x] Database grants, function signatures, and cron compatibility are verified.

## Integration and Verification

- [x] Focused unit/API tests pass; the SQL contract is committed and independently reviewed, and the linked database readback passes.
- [x] Live migration ledger and database readback prove the new function contract.
- [x] Authenticated production save/reload and final-route desktop/mobile screenshots prove the UI.
- [x] Independent code/database review passes.
- [x] Task-owned files are published to `origin/main`; remote deployment `84b03cbbb4a6` is Ready.

## Failure-Loudly Contract

- Cause surfaced as: the exact database conflict/validation message returned by the existing settings API and toast.
- Detection path: focused SQL rollback contract plus authenticated automatic-schedule save.
- Recovery path: correct conflicting dates or disable/reconfigure the schedule; the prior schedule remains unchanged on failure.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: A database prerequisite required a manually created first period even though automatic generation already owned period creation.
- Detection gap: Existing tests covered manual creation and catch-up but not configuring an empty project.
- Prevention: A transactional SQL contract now begins from a project with zero periods and requires immediate first-period creation.
- Guardrail evidence: `supabase/tests/billing_period_automatic_schedule.sql`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live reproduction | `supabase db query --linked` direct call to `configure_automatic_billing_periods` for project 1144 | Failed as expected | SQLSTATE `23514`; live project had zero periods and no settings. |
| Focused recurrence test | `npm.cmd run test:unit -- --runInBand ...` | Pass | Calendar boundaries, validation, and conflict mapping passed in the focused run. |
| Focused frontend tests | 3 suites, 11 tests | Pass | Calendar boundaries, validation, and conflict HTTP mapping. |
| Targeted lint | ESLint on touched frontend paths | Pass | No diagnostics. |
| Linked migration | Version `20260730000000` and live function/ACL/cron readback | Pass | Nexcom remained unchanged before the user-facing save. |
| Authenticated production save | `https://projects.alleatogroup.com/1144/invoices?tab=billing-periods` | Pass | Success toast read `Automatic billing schedule saved`; reload retained Monthly and one BP-001. |
| Final database readback | Linked query after browser save/reload | Pass | Project 1144 has one monthly settings row, cursor `1`, and exactly one open BP-001 for 2026-07-01 through 2026-07-31, due 2026-07-28. |
| Final visual proof | `2026-07-29-automatic-billing-periods.desktop.png` and `.mobile.png` | Pass | Desktop 1440x1000; mobile 390x844. Mobile dialog bounds were top 8px, bottom 836px. |
| Production deployment | Vercel deployment `dpl_jmGE5oNfG9fWLYBELPWprvXwCQAe` / commit `84b03cbbb4a6` | Pass | Ready and aliased to `projects.alleatogroup.com`. |
| Independent review | Code reviewer and database reviewer | Pass | Final re-reviews found no remaining findings. |
| Bounded full typecheck | `node scripts/run-typecheck-bounded.mjs` | Blocked | Existing full-program check timed out after 300 seconds without diagnostics; focused compilation and lint passed. |

## Remaining Risk

- The repository-wide bounded typecheck timed out without diagnostics, and the disposable SQL contract was not executed because Docker was unavailable. Focused tests, production build, linked migration/readback, authenticated save/reload, and independent reviews passed.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
