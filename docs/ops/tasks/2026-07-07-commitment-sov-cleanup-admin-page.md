# Task: Commitment SOV Cleanup Admin Page

Status: Complete
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session.
Related Handoff: None

## Objective

Create a quiet admin table surface for unresolved commitment SOV rows so admins
can triage remaining `project_budget_code_id` gaps by reason, candidate options,
project, commitment, amount, and canonical commitment link.

## Scope Checklist

- [x] Classify as full task process.
- [x] Create task markdown before implementation.
- [x] Regenerate Supabase database types before database-backed code edits.
- [x] Add read-only admin API for unresolved commitment SOV cleanup rows.
- [x] Add `/admin/commitment-sov-cleanup` table page using `UnifiedTablePage`.
- [x] Include filters for table type and unresolved reason.
- [x] Link every row to the canonical commitment page.
- [x] Keep the page read-only; no mutation or bulk selection in this slice.
- [x] Avoid unrelated dirty checkout changes.

## Verification Checklist

- [x] API returns counts reconciling to unresolved DB totals.
- [x] Page renders current unresolved rows from the API.
- [x] Targeted lint/type/test checks pass.
- [x] Browser proof captured for admin page.

## Evidence Log

| Check | Result | Notes |
| ----- | ------ | ----- |
| Supabase types | Pass | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public > frontend/src/types/database.types.ts` completed before DB-backed code edits. |
| DB count reconciliation | Pass | Direct Supabase count: `purchase_order_sov_items=73`, `subcontract_sov_items=233`, total `306` rows where `project_budget_code_id IS NULL`. |
| API/page reconciliation | Pass | `/admin/commitment-sov-cleanup` rendered `306 unresolved`, `128 ambiguous`, `142 missing budget code` from `/api/admin/commitment-sov-cleanup`. |
| Browser proof | Pass | `docs/ops/evidence/2026-07-07-commitment-sov-cleanup-admin-page/admin-commitment-sov-cleanup.png`; verified as allowlisted Megan admin session. |
| Read-only proof | Pass | Final browser snapshot showed no row-selection checkboxes; page exposes filters, export, table settings, and commitment links only. |
| Focused ESLint | Pass | `./node_modules/.bin/eslint 'src/app/(admin)/admin/commitment-sov-cleanup/page.tsx' src/app/api/admin/commitment-sov-cleanup/route.ts src/lib/commitments/sov-cleanup-classification.ts src/lib/commitments/__tests__/sov-cleanup-classification.test.ts`. |
| Unit test | Pass | `npm run test:unit -- --runTestsByPath src/lib/commitments/__tests__/sov-cleanup-classification.test.ts --runInBand`. |
| Changed type guard | Pass | `npm run typecheck:changed`; no new `any` type debt detected. |

## Noise Gate

Primary user: Admin fixing financial data integrity.
Primary job: Triage unresolved commitment SOV rows.
Primary decision: Which rows need manual cost-type selection, budget-code setup, or source repair.
Tier 1: Reason, table type, project, commitment, budget code, amount, candidate labels.
Tier 2: Row description, status, direct commitment link.
Tier 3: raw IDs and machine metadata.
Hide until requested: mutation controls, bulk mapping, raw SQL.
Remove: stat cards, helper panels, decorative badges/icons.
Primary action: Open the canonical commitment page.
Failure-loudly behavior: unresolved reason is explicit and blank/nonzero rows are visibly classified.

## Failure Analysis

Cause: remaining unresolved SOV rows are now known, but reviewing a CSV is not an operational cleanup workflow.

Detection gap: there is no app surface to filter unresolved rows by reason and open the canonical commitment.

Prevention: ship a read-only admin table first; only add mutation after the review/mapping workflow is explicit and auditable.
