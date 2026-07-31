# Task: Accounting Direct Costs Table

Status: Blocked/Deferred - Browser proof blocked by admin allowlist access
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-897
Linear URL: https://linear.app/megankharrison/issue/AAI-897/add-accounting-direct-costs-table-grouped-by-operating-area
Related Handoff: N/A

## Objective

Add a first-class accounting direct-cost table in the admin accounting area that reuses the existing Acumatica AP-bill classification path and groups operating spend into scan-friendly business areas such as software, payroll, travel, lodging, flights, executive spend, and office supplies.

## Non-Negotiable Done Rule

This task is not done until every required checklist item below is checked and evidence is filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document cause, detection gap, prevention step, owner, and next action.

## Attention Brief

Primary user: Alleato leadership and accounting operators reviewing non-project operating spend.
Primary job: scan operating direct costs, understand where money is going, and investigate the underlying Acumatica bill quickly.
Primary decision: which operating categories are driving spend and whether a specific bill belongs in that operating bucket.
Tier 1: operating area, vendor/reference, amount, date, status, source link.
Tier 2: month rollup, confidence, classification source, exclusion/needs-review signal.
Tier 3: raw rule maintenance details and broad dashboard context.
Hide until requested: raw exception/debug reasoning for excluded rows.
Remove: duplicate accounting entry points and any page-local spend taxonomy disconnected from the AP-bill classifier.
Primary action: open the bill, filter by area/vendor/date, and review category totals.
Failure-loudly behavior: route/API load failures must show specific error states; unclassified or low-confidence bills must remain visible as review-needed rather than silently folded into a wrong bucket.

## Acceptance Criteria

- [x] Accounting has a discoverable direct-cost route and nav entry.
- [x] Table data is sourced from Acumatica AP bills through the existing accounting classification path, not a parallel spend model.
- [x] Operating-area groupings cover the user-requested examples where source matches exist, including software subscriptions, payroll, travel, hotels, flights, office supplies, and executive/CEO spend.
- [x] The table provides scan-friendly row fields and grouped totals by operating area.
- [x] Project-coded bills, reversals/credits, duplicate closures, and zero-dollar noise remain excluded with explicit reasoning.
- [x] Guardrails remain in place for `view_accounting` and API failure responses.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing accounting nav/page/API patterns reused before adding new primitives.
- [x] Taxonomy change implemented at the shared accounting-classification layer.
- [x] Route discoverability updated in accounting navigation and admin directory.
- [x] No page-local hard-coded one-off grouping logic when a shared classification field can own the taxonomy.
- [x] Failure-loudly behavior preserved for route/API/table loading.

## Planned Files

- `docs/ops/tasks/2026-07-02-accounting-direct-costs-table.md`
- `frontend/src/lib/accounting/finance-spend.ts`
- `frontend/src/app/api/accounting/direct-costs/route.ts`
- `frontend/src/app/(admin)/accounting/direct-costs/page.tsx`
- `frontend/src/components/accounting/accounting-nav.tsx`
- `frontend/src/app/(admin)/admin/page.tsx`
- `frontend/src/app/(admin)/accounting/page.tsx`

## Integration Checklist

- [x] Linear kickoff issue created before code edits.
- [x] Linear kickoff comment recorded.
- [x] Supabase types refresh attempted before considering schema work.
- [x] No migration applied: implementation stayed schema-free after CLI auth blocker proved a DB-backed taxonomy expansion was not currently operable from this checkout.
- [x] Accounting nav/admin directory discoverability updated.
- [x] Focused verification run for changed files/routes.

## Regression Guardrails

- [x] Unclassified or low-confidence rows remain visible as review-needed instead of silently included.
- [x] Shared accounting taxonomy is reusable by future spend pages/reports.
- [x] Noise-gate pass recorded for the new page structure.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear tracking | Linear `AAI-897` | Pass | Issue created before code edits. |
| Linear kickoff comment | Linear comment `f7058688-0ffd-46eb-a5a1-628a3633ec8b` | Pass | Scope and implementation path recorded before edits. |
| Task template gate | `docs/ops/tasks/TASK-TEMPLATE.md` | Process gap | Referenced template path is absent in repo; this file mirrors the current `docs/ops/tasks/*` format. |
| Supabase types refresh | `npx supabase gen types typescript --project-id "lgveqfnpkxvzbnnwuled" --schema public` | Blocked | CLI auth is configured with legacy token format (`LegacyInvalidAccessTokenError`). Because the feature could be implemented without a schema change, the work stayed schema-free and the generated types file was restored from `HEAD` after the failed command clobbered it. |
| Focused ESLint | `cd frontend && npx eslint src/lib/accounting/finance-spend.ts src/app/api/accounting/direct-costs/route.ts src/app/(admin)/accounting/direct-costs/page.tsx src/components/accounting/accounting-nav.tsx src/app/(admin)/admin/page.tsx` | Pass | New direct-cost files and discoverability changes are lint-clean. |
| Changed ESLint debt gate | `cd frontend && npm run lint:changed:debt` | Pass | No new ESLint debt across changed frontend files. |
| Changed type debt gate | `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt in changed files. |
| Route check | `npm run check:routes` | Pass | No route conflicts after adding `/accounting/direct-costs`. |
| Local route boot | `cd frontend && npm run dev` | Pass | Local app booted at `http://localhost:3001`. |
| Browser auth proof | `agent-browser --session accounting-direct-costs ...` | Blocked/Deferred | Test user can sign in and reach `/accounting/direct-costs`, but the page resolves to `/access-denied?reason=admin-dashboard-allowlist` before the accounting table renders. Screenshot: `/tmp/accounting-direct-costs-page.png`. |

## Blocked/Deferred Item

Cause: the available Codex-accessible local test identity authenticates successfully but is still rejected by the admin dashboard allowlist before the accounting page content renders.
Detection gap: auth setup proves standard user authentication, but not admin-allowlisted access for protected accounting routes.
Prevention step: maintain one Codex-usable storage state or test user that is both authenticated and admin-allowlisted for accounting/admin routes.
Owner: Codex/app verification setup.
Next action: rerun browser verification with an admin-allowlisted accounting user and confirm grouped area totals plus row sections render past the access gate.

## Files Changed

- `docs/ops/tasks/2026-07-02-accounting-direct-costs-table.md`
- `frontend/src/lib/accounting/finance-spend.ts`
- `frontend/src/app/api/accounting/direct-costs/route.ts`
- `frontend/src/app/(admin)/accounting/direct-costs/page.tsx`
- `frontend/src/components/accounting/accounting-nav.tsx`
- `frontend/src/app/(admin)/admin/page.tsx`
- `frontend/src/app/(admin)/accounting/page.tsx`
