# Handoff: 2026-07-18 — Canonical Owner Invoice Billing Period Contract

## Intake Block

1) Session ID: S194
2) Task ID: AAI-1159
Task file: `docs/ops/tasks/2026-07-18-owner-invoice-billing-period-contract.md`
Verification manifest: `docs/ops/tasks/2026-07-18-owner-invoice-billing-period-contract.verification-manifest.json`
Verification result: `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/verification-result.json`
3) Linear issue: AAI-1159
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1159/use-canonical-billing-period-selection-for-owner-invoices
5) Current status: Complete and accepted
6) Files changed (absolute paths): `/tmp/codex-owner-billing-period.jzTLph/frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`; `/tmp/codex-owner-billing-period.jzTLph/frontend/src/app/api/projects/[projectId]/invoicing/owner/atomic/**`; `/tmp/codex-owner-billing-period.jzTLph/frontend/src/lib/invoicing/owner-invoice-billing-period.ts`; focused tests; app-surface description/generated map; task/handoff/learning/report/evidence files.
7) Commands run and outcome (pass/fail counts): focused Jest 8/8 pass; targeted ESLint 0 errors with 5 unrelated existing warnings; verification contract PASS; independent functional/security and visual reviews APPROVED; full typecheck fails only on unrelated repo debt.
8) Evidence artifacts (screenshot/video/report/log paths): `docs/ops/evidence/2026-07-18-owner-invoice-billing-period-contract/**`; `docs/reports/procore-owner-invoice-billing-period-contract.md`.
9) Top 3 findings (frontend-visible issues first): free text is replaced by a canonical selector; open/newest defaulting and due-date behavior are deterministic; the atomic route rejects invalid project-scoped period contracts before writing.
10) Recommended next action (one line): separately repair the saved-session compatibility of `requirePermission`; the canonical billing-period contract is published.
11) Handoff file path: `docs/ops/handoffs/2026-07-18-S194-owner-invoice-billing-period-contract.md`
12) Migration ledger evidence: Not applicable; no schema change is planned.

## Linear Updates

- Kickoff comment: `c9632071-e9f0-4344-ad05-9f891916e615`.
- Milestone/evidence comment: `46dbdec2-a8ed-45a6-b323-9e690961e5de`.
- Screenshot attachment: `b03d1613-bd00-4ba3-ab2c-83b4140f3035`.

## Current Status

- The owner-invoice form uses canonical project billing-period records and fails closed when none can be selected.
- The atomic API validates one project-scoped ID and canonicalizes period dates before writing.
- Focused tests, desktop/mobile browser evidence, verification contract, and independent reviews pass.
- Publication `400b51f52544c5bd133f4730eadfd1e2a589f61f` is on `origin/main`; local/remote equality passed.

## Root Cause and Contract Boundary

- Expected: one project-scoped billing-period record owns the ID and period dates from selection through atomic persistence.
- Observed: the UI submits text-derived dates without an ID, then the server independently guesses an open ID while retaining the submitted dates.
- First failing boundary: canonical billing-period API records to owner-invoice form state and payload.

## Verification Summary

- Shared RHF select defaults to the newest open period, then newest period.
- Due Date follows the selected period and refreshes when its canonical default changes unless the user deliberately overrides it.
- Atomic API requires one UUID, rejects conflicts, scopes by route project, and canonicalizes both stored ranges before its RPC.
- Empty/unavailable states disable creation and provide recovery copy.
- Exact-route desktop/mobile screenshots use project 67 billing-period rows copied from a live read-only database readback; no invoice was persisted.
- The existing saved-session/`requirePermission` mismatch prevents a non-intercepted local endpoint proof. Cause: auth guard session resolution. Detection gap: no harness test binds saved UI auth to this permission guard. Prevention: standardize the guard on the canonical server session helper. Owner: permissions/auth platform.

## Exact Next Step

Track the saved-session/`requirePermission` compatibility as separate auth-platform work; no additional AAI-1159 product change is required.

## Known Pitfalls

- Do not restore fallback guessing in another client or route.
- Do not allow invoice and payment-application payloads to carry different billing-period IDs.
- Do not claim completion without exact-route screenshots and independent approval.
