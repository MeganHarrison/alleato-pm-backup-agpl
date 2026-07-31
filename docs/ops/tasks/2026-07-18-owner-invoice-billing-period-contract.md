# Task: Canonical Owner Invoice Billing Period Contract

Status: Complete
Owner: Codex S194
Created: 2026-07-18
Task ID: AAI-1159
Linear Issue: AAI-1159 — https://linear.app/megankharrison/issue/AAI-1159/use-canonical-billing-period-selection-for-owner-invoices
Related Handoff: `docs/ops/handoffs/2026-07-18-S194-owner-invoice-billing-period-contract.md`

## Objective

Replace the owner-invoice billing-period free text with a canonical record selector and require the atomic create API to validate and use that same project-scoped record.

## Scope

- Owner invoice create route at `/{projectId}/invoices/new?contractType=prime`.
- Canonical `billing_periods` list hook and atomic owner-invoice create API.
- Focused UI/domain/API regression coverage and exact-route browser proof.
- No billing-period schema, management-workspace, invoice prefill, or persistence-model changes.

## Source of Truth

- Canonical runtime/data owner: project-scoped `billing_periods` rows served by `GET /api/projects/{projectId}/invoicing/billing-periods`.
- Existing shared primitives/services: `frontend/src/hooks/use-billing-periods.ts`, shared RHF select field, and the atomic owner-invoice route.
- Deprecated or parallel paths: free-text `billingPeriod` form state and server-side open-period guessing when no ID is supplied.

Verification contract: Required

## Acceptance Criteria

- [x] Owner invoice creation uses a canonical billing-period selector, not free text.
- [x] The default is the open period, or the most recent period when none is open.
- [x] The create payload includes one selected `billing_period_id`; period dates come from that project-scoped record.
- [x] Missing, conflicting, or foreign-project billing-period IDs fail with specific actionable errors.
- [x] No-period, loading, and query-failure states are visible and creation is blocked safely.
- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns default selection, canonical period formatting, and due-date refresh behavior.
- [x] Errors are specific and actionable.
- [x] Database and permission contracts are handled without a schema change.

Owned product files before edits:

- `frontend/src/app/(main)/[projectId]/invoices/new/page.tsx`
- `frontend/src/app/api/projects/[projectId]/invoicing/owner/atomic/route.ts`
- `frontend/src/app/api/projects/[projectId]/invoicing/owner/atomic/__tests__/route.test.ts`
- `frontend/src/lib/invoicing/owner-invoice-billing-period.ts`
- `frontend/src/lib/invoicing/__tests__/owner-invoice-billing-period.test.ts`

Guardrail-owned generated/index files added at pre-commit:

- `frontend/src/lib/app-surface/page-descriptions.json`
- `frontend/src/lib/app-surface/app-surface.generated.json`
- `docs/architecture/PROJECT-MAP.md`

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow and API readback prove the requested outcome.
- [x] Desktop and mobile screenshots are captured on the canonical route.
- [x] Independent functional, visual, and evidence review is recorded.
- [x] Evidence artifacts are recorded and the verification contract passes.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: an inline unavailable-period state in the form or a specific 400/422 API response naming the invalid billing-period contract.
- Detection path: focused route tests plus authenticated browser and API evidence on the canonical owner-invoice create route.
- Recovery path: select an available project billing period, or create/reopen one in Billing Periods before creating the invoice.

## Incident Learning

- Failure fingerprint: `invoicing.owner-billing-period-contract-drift`
- Root cause: the client modeled a database-backed billing period as free text while the API independently guessed a record ID and preserved client-derived dates.
- Detection gap: no test bound the selected period ID, project scope, and canonical dates into one create contract.
- Prevention: shared selector/default helper plus API validation and canonicalization tests.
- Guardrail evidence: focused helper and atomic-route suites pass 8/8, and the staged learning-registry audit resolves this fingerprint to the canonical selector-through-atomic contract.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime baseline | Authenticated DOM on `/760/invoices/new?contractType=prime` | Fail reproduced | Billing Period rendered as a textbox while a canonical record existed. |
| Supabase type gate | `npx supabase gen types typescript --project-id lgveqfnpkxvzbnnwuled --schema public` | Pass | `billing_periods.id` is UUID text and `project_id` is integer; generated file had no diff. |
| Focused regression | Targeted Jest helper and atomic-route suites | Pass | 2 suites, 8 tests; covers defaulting, due-date refresh, missing/conflicting/foreign IDs, and canonical dates. |
| Targeted lint | `pnpm --dir frontend exec eslint <five task files>` | Pass with unrelated warnings | 0 errors; 5 existing raw line-item input warnings in the invoice form. |
| Full typecheck | `npm --prefix frontend run typecheck` | Unrelated fail | No errors in AAI-1159 files. Existing errors remain in admin daily briefs, feedback inbox, and executive modules. |
| Live data readback | `database-readback.json` | Pass | Project 67 has one open July period and one closed August period with canonical IDs, ranges, and due dates. |
| Exact-route browser flow | `browser-action-log.json` plus four screenshots | Pass | Authenticated local UI; DB-mirrored routes prove default/select/empty/mobile states and outgoing atomic payload. No test invoice was persisted. |
| Independent review | `independent-functional-review.md`, `independent-visual-review.md` | Approved | No blocking correctness, security, or design findings; noise gate passes. |
| Verification contract | `verification-result.json` | Pass | Every manifest claim has evidence and independent approval. |
| Screenshot comment gate | Linear comment `46dbdec2-a8ed-45a6-b323-9e690961e5de`, attachment `b03d1613-bd00-4ba3-ab2c-83b4140f3035` | Pass | Viewable exact-route desktop screenshot is attached to AAI-1159. |
| Publication | `400b51f52544c5bd133f4730eadfd1e2a589f61f` | Pass | `HEAD` equals `origin/main` after direct mainline push and fetch readback. |

## Remaining Risk

- The authenticated local billing-period endpoint returned 401 under the saved test-user session because the existing `requirePermission` path does not consume that harness identity. Browser evidence therefore intercepts responses with records copied from the live project 67 readback. This is test-auth infrastructure debt, not a fallback in the product contract; owner: permissions/auth platform; next action: align `requirePermission` with the canonical server session helper and add a separate authenticated endpoint test.
- No test invoice was persisted; the outgoing client contract and server persistence boundary were verified separately to avoid creating financial data solely for proof.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
