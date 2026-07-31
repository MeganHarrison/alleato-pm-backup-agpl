# Task: Invoice Billing Period Guardrails

Status: In Progress
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Fix the Brandon-reported billing-period and invoice-list issues on
`/[projectId]/invoices?tab=subcontractor` and the shared billing-period create
workflow:

- prevent creating a second open billing period,
- require due date for billing periods,
- render subcontractor invoice numbers in normal text color instead of brand
  color.

## Non-Negotiable Done Rule

This task is not done until the create workflow fails loudly in both UI and API
for invalid billing periods, the invoice-number styling is corrected on the
exact invoices page, targeted tests pass, and evidence is recorded below.

## Scope Checklist

- [x] Exact route and current implementation inspected.
- [x] Brandon feedback context checked against repo artifacts/memory.
- [x] Shared guardrail seam identified before editing.
- [x] Failure-loudly behavior defined.
- [ ] Acceptance criteria fully verified with evidence.

## Implementation Checklist

- [x] Add shared billing-period validation helpers.
- [x] Enforce due-date + single-open-period rules in the canonical invoicing
      billing-period POST route.
- [x] Enforce the same rules in the billing-period PATCH route where reopening
      or blanking due date could bypass create validation.
- [x] Surface the same guardrail in the invoices billing-period dialog.
- [x] Surface the same guardrail in the standalone billing-periods page dialog.
- [x] Change subcontractor invoice number styling to normal text color on the
      invoices page.

## Regression Guardrails

- [x] Targeted unit test added for shared billing-period validation.
- [x] Targeted route test added/updated for billing-period API rejection cases.
- [x] Existing tests only adjusted for intentional behavior changes.

## Verification Checklist

- [x] Targeted automated tests run.
- [x] Narrow lint/type verification run for touched files.
- [x] Route/UI behavior inspected after edits.
- [x] Evidence recorded below.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Route audit | `frontend/src/app/(main)/[projectId]/invoices/page.tsx` and `frontend/src/app/api/projects/[projectId]/invoicing/billing-periods/route.ts` | Passed | Confirmed invoice number still uses `text-primary`, due date is optional, and no single-open-period rule exists. |
| Focused Jest | `cd frontend && pnpm exec jest --runTestsByPath 'src/lib/invoicing/__tests__/billing-period-validation.test.ts' 'src/app/api/projects/[projectId]/invoicing/billing-periods/__tests__/route.test.ts' --runInBand` | Passed | 2 suites, 8 tests passed covering required due date, second-open-period rejection, blank due-date PATCH rejection, and reopen conflict rejection. |
| Focused ESLint | `cd frontend && pnpm exec eslint ...touched files...` | Passed with warnings | No errors. Existing page-level design-system warnings remain on both billing-period dialogs (`no-raw-date-input`, `no-raw-page-grid`). |
| UI source verification | `frontend/src/app/(main)/[projectId]/invoices/page.tsx`, `frontend/src/app/(main)/[projectId]/billing-periods/page.tsx` | Passed | Both create entry points now disable when an open period exists, show the blocking message, and validate before mutation. |

## Files Changed

- `docs/ops/tasks/2026-07-07-invoice-billing-period-guardrails.md`
- `frontend/src/app/(main)/[projectId]/invoices/page.tsx`
- `frontend/src/app/(main)/[projectId]/billing-periods/page.tsx`
- `frontend/src/app/api/projects/[projectId]/invoicing/billing-periods/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/billing-periods/[periodId]/route.ts`
- `frontend/src/lib/invoicing/billing-period-validation.ts`
- `frontend/src/lib/invoicing/__tests__/billing-period-validation.test.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/billing-periods/__tests__/route.test.ts`

## Risks / Gaps

- Live production annotation text is auth-blocked in this session, so comment
  pin text cannot be re-read directly from the route yet.
- The worktree already contains unrelated user changes; only task-owned files
  should be touched or staged.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is recorded.
- [x] Final response includes what is done, what remains, and recommended next
      steps.
