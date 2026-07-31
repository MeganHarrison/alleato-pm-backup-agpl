# SROOT-ALL-51 Automatic Billing Periods

Status: Complete
Owner: Codex
Linear: ALL-51

## Scope and ownership

- `frontend/src/features/invoicing/BillingPeriodsWorkspace.tsx`
- `frontend/src/lib/invoicing/billing-period-recurrence.ts`
- `frontend/src/lib/invoicing/__tests__/billing-period-recurrence.test.ts`
- `supabase/migrations/20260730000000_automatic_billing_first_period.sql`
- `supabase/tests/billing_period_automatic_schedule.sql`
- Task and evidence files for ALL-51

## Current finding

The first divergence is the database RPC boundary. A direct linked-database call reproduces SQLSTATE `23514` before settings are persisted because `configure_automatic_billing_periods` explicitly requires an existing billing period. Nexcom project 1144 currently has zero periods and no invoicing settings row.

## Acceptance contract

See `docs/ops/tasks/2026-07-29-automatic-billing-periods.md`.

## Verification

- PASS: 3 focused suites, 11 tests.
- PASS: targeted ESLint and `git diff --check`.
- PASS: linked migration ledger and live function/ACL/cron readback.
- PASS: independent code and database reviews.
- PASS: production deployment `84b03cbbb4a6` is Ready on `projects.alleatogroup.com`.
- PASS: authenticated save showed `Automatic billing schedule saved`; reload retained Monthly and one BP-001.
- PASS: final linked readback found cursor `1` and exactly one open BP-001 for July 1-31, due July 28.
- PASS: desktop 1440x1000 and mobile 390x844 screenshots; the corrected mobile dialog remained inside the viewport.
