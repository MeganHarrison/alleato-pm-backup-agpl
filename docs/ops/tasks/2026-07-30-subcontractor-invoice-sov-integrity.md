# Task: Keep Subcontractor Invoice SOV Synchronized

Status: Complete
Owner: Codex SROOT3
Created: 2026-07-30
Task ID: ALL-56
Linear Issue: [ALL-56](https://linear.app/alleato-group/issue/ALL-56/keep-subcontractor-invoice-sov-synchronized-with-commitment-values)
Full Handoff: `docs/ops/handoffs/2026-07-30-SROOT3-subcontractor-invoice-sov-integrity.md`

## Objective

Permanently prevent editable subcontractor invoices from retaining stale commitment values or presenting unexplained differences as approved change orders.

## Scope

- Stable source links from invoice lines to commitment SOV lines and approved commitment change orders.
- Automatic reconciliation for editable, unsynced invoices.
- Database submission guard and truthful invoice-detail presentation.
- One-time repair for existing safe editable mismatches.
- Excludes rewriting submitted, approved, paid, voided, accounting-synced, and retainage-release history.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] New normal invoice lines are valued from their linked commitment SOV or approved change order, not caller-supplied schedule values.
- [x] Draft, Not Invited, Invited, and Revise & Resubmit invoices automatically follow source changes while unsynced.
- [x] Non-change SOV lines always report Change Value as zero.
- [x] The database rejects transition to Under Review when the invoice is missing, duplicating, or disagreeing with a current source line.
- [x] Submitted and accounting-synced invoice history is never automatically rewritten.
- [x] APP-01 is repaired from $21,000 to $15,200 with Change Value $0.

## Owned Files

- `frontend/src/app/(main)/[projectId]/invoicing/subcontractor/new/page.tsx`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/subcontractor/invoices/[invoiceId]/submit/route.ts`
- focused route and integrity tests
- `frontend/src/types/database.types.ts`
- forward-only integrity and repair migrations
- `supabase/tests/subcontractor_invoice_sov_integrity.sql`
- production browser and database evidence

## Failure-Loudly Contract

- Cause surfaced as: a specific reconciliation conflict before invoice review.
- Detection path: database trigger, route regression tests, pgTAP contract, and production readback.
- Recovery path: return the invoice to an editable unsynced state and correct the commitment SOV or approved change order source.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | Invoice 8268 plus source tables | Confirmed | Invoice snapshot $21,000; current SOV $15,200; approved CO $0. |
| Auth preflight | `npm run verify:browser` | Harness blocked | Existing Playwright package duplication; authenticated Chrome remains available for final proof. |
| Production migrations | `20260731022000` through `20260731022400` | Pass | All five versions are recorded in the linked migration ledger. |
| Database contract | `npx supabase db query --linked --file supabase/tests/subcontractor_invoice_sov_integrity.sql` | Pass | 26 pgTAP checks, including rollback-only source sync, submission, reopen, deductive CO, direct-delete, and billed-row preservation paths. |
| Focused application regression | Five focused Jest suites | Pass | 26 tests passed. |
| Targeted lint | ESLint on seven task-owned runtime files | Pass with warnings | 0 errors; seven existing design-system/`any` warnings. |
| Targeted type boundary | Bounded project typecheck filtered to ALL-56 paths | Pass | No errors in task-owned application files; unrelated repository type debt remains. |
| Live data readback | Invoice 8268 and editable-invalid count | Pass | APP-01 is Draft, Schedule/Commitment $15,200, Change $0, validator true; invalid editable unsynced count is 0. |
| Independent review | Code, React, and security reviewers | Approved | No remaining correctness, UI, authorization, race, or data-integrity blockers. |
| Production deployment | Vercel deployment `dpl_7ax2aJnzA8nhB1GXgwozFvU5ikCo` | Pass | Revision from implementation SHA `98cc3ab11345e1019bed2078459c716ca2ffd9b3` reached Ready and received the `projects.alleatogroup.com` production alias. |
| Production browser proof | `tests/agent-browser-runs/2026-07-30-subcontractor-invoice-sov-integrity/app-01-detail-production.png` | Pass | Authenticated APP-01 Detail readback shows Draft with Edit SOV, Commitment $15,200, Change $0, and Schedule $15,200. |
