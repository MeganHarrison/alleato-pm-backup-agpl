# Handoff: 2026-07-22 — Acumatica company cleanup

## Intake Block

1) Session ID: S212
2) Task ID: AAI-1245
3) Linear issue: AAI-1245
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1245/purge-unreferenced-non-acumatica-companies-with-relationship-safe-sync
5) Current status: In Progress — production data cleanup and migrations are complete; application guardrail publication/deploy proof remains.
6) Files changed (absolute paths): `/Users/meganharrison/Documents/github/project-management/backend/src/services/acumatica_sync.py`, `/Users/meganharrison/Documents/github/project-management/backend/tests/test_acumatica_company_cleanup.py`, `/Users/meganharrison/Documents/github/project-management/supabase/migrations/20260722054824_purge_unlinked_non_acumatica_companies.sql`, `/Users/meganharrison/Documents/github/project-management/supabase/migrations/20260722054957_restrict_company_cleanup_rpc.sql`, and task-control files.
7) Commands run and outcome (pass/fail counts): Focused Python tests 11 passed; both migration-ledger verifiers passed; syntax and diff checks passed; production first purge deleted 52, second purge deleted 0.
8) Evidence artifacts (screenshot/video/report/log paths): Viewable screenshot attached to Linear AAI-1245; live Supabase pre/post inventory and function-permission readbacks recorded in the Codex task log.
9) Top 3 findings (frontend-visible issues first): Company directory is now reduced by 52 unlinked rows; 35 database relationships protect project-directory, commitment, and other attached companies; service role is the sole cleanup executor.
10) Recommended next action (one line): Publish to main, verify the Render deployment, run the canonical sync, and confirm its `company_cleanup` result.
11) Handoff file path: docs/ops/handoffs/2026-07-22-S212-acumatica-company-cleanup.md
12) Migration ledger evidence: Pending.
13) Verification manifest: docs/ops/evidence/2026-07-22-aai-1245-company-cleanup/verification-manifest.json
14) Verification result: docs/ops/evidence/2026-07-22-aai-1245-company-cleanup/verification-result.json

## Linear Updates

- Kickoff comment: `f4e90164-a94d-472e-b59e-24642c61161f`.
- Milestone comments: `2b0d1e06-43d7-432e-b067-848ae665411c` with screenshot attachment `ea22622e-4a87-4778-a1dd-ac5e777ed269`.
- Completion/blocker comment: Pending.

## Current Status

The migration has been applied, the live cleanup deleted exactly 52 unlinked non-Acumatica companies, and the sync now has a tested, source-projection-gated cleanup seam. Publication/deploy proof remains.

## Exact Next Step

Publish the guarded sync integration and verify its production cleanup result.

## Known Pitfalls

Do not delete by `acumatica_vendor_id` alone: customer-backed rows use `customer_id`, and referenced rows can be silently nulled/cascaded by their foreign key. The function must remain catalog-driven and service-role-only.

## Resume Commands

```bash
node scripts/ops/checkout-session-gate.mjs status
npm run db:migrations:verify-applied -- supabase/migrations/<migration>.sql
```

## Evidence

Live Supabase FK inventory and the task definition of done.
