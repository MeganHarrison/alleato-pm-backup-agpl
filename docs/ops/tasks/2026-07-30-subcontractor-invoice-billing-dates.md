# Task: Prefill Subcontractor Invoice Billing Dates

Status: Blocked/Deferred
Owner: S019fb56c
Created: 2026-07-30
Task ID: 2026-07-30-subcontractor-invoice-billing-dates
Linear Issue: Not required for a single-session Standard task.
Related Handoff: N/A

## Objective

When a user opens the subcontractor invoice create form, Period Start, Period
End, and Billing Date are prefilled from the project's open billing period.

## Scope

- Subcontractor invoice create-page billing-period defaults.
- Focused regression coverage for the form-state boundary.
- No billing-period schema, management, or owner-invoice behavior changes.

## Source of Truth

- Canonical runtime/data owner: `billing_periods` through
  `/api/projects/[projectId]/invoicing/billing-periods?is_closed=false`.
- Existing shared primitives/services:
  `frontend/src/hooks/use-billing-periods.ts` and
  `frontend/src/lib/invoicing/billing-period-selection.ts`.
- Deprecated or parallel paths: The compatibility-only
  `/api/projects/[projectId]/billing-periods` reader is not used.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] All three date fields initialize from the open billing period.
- [x] Billing Date matches the current backend contract: the billing-period end date.
- [x] Loading failures are surfaced without discarding manual-entry recovery.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate billing-period query path is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing billing-period hook and selection helper own cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] No database, provider, authentication, permission, or delivery contract changes are required.

## Integration and Verification

- [x] Focused regression test passes.
- [ ] Authenticated final-route screenshot proves populated fields.
- [ ] Live network readback proves the canonical billing-period request.
- [x] Task-owned files are published and match `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: An actionable toast with the query cause, or a specific no-open-period state.
- Detection path: Focused page test plus authenticated browser network/DOM readback.
- Recovery path: Refresh the page or enter the dates manually.

## Incident Learning

- Failure fingerprint: `invoicing.subcontractor-billing-period-prefill-drift` (local first occurrence; no recurring-registry entry)
- Root cause: The subcontractor create page initialized empty date fields and never loaded billing-period data.
- Detection gap: The page had no regression test covering billing-period-to-form-state defaults.
- Prevention: A page-level regression test now asserts the canonical hook call and all three displayed values.
- Guardrail evidence: Focused Jest test and final authenticated screenshot.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | Authenticated production DOM and network trace | Failed before fix | Start was manually populated, end/billing were blank, and no billing-period request occurred. |
| Regression | `npm.cmd run test:unit -- --runInBand --runTestsByPath ...page.test.tsx ...owner-invoice-billing-period.test.ts` | Pass | 2 suites, 9 tests, including manual-date preservation. |
| Scoped lint | `npx.cmd eslint <four task-owned TypeScript files> --no-cache` | Pass with pre-existing warnings | 0 errors; four existing warnings in the create page outside changed lines. |
| Independent review | Standards and spec review agents | Pass after fixes | Added empty-state cause/recovery, neutralized shared selector ownership, and removed the unnecessary billing-period ID payload. |
| Production data | Linked Supabase read-only query | Pass | Project 1149 has the open 2026-07-01 through 2026-07-31 period and commitment `1ab839e9-a3bc-4b81-a72f-197aa6cd66b5`. |
| Publication | `remote-main-publish.mjs` plus task-file diff against `origin/main` | Pass | Five exact files published at `7bd17628ffce4999ccd9ddda2c38baf2e43b6a4f`. |
| Deployment | Vercel deployment `project-management-agent-6mvduf123-the-alleato-group.vercel.app` | Blocked | Commit `7bd1762` failed before build: production `DATABASE_URL` uses the direct Supabase host instead of the required pooler host. |
| Screenshot | `https://projects.alleatogroup.com/1149/invoicing/subcontractor/new?commitmentType=subcontract&commitmentId=1ab839e9-a3bc-4b81-a72f-197aa6cd66b5` | Blocked | Artifact directory: `tests/agent-browser-runs/2026-07-30-subcontractor-invoice-billing-dates/`. The published revision did not deploy, so a screenshot of the older production revision would be invalid. |

## Remaining Risk

- Cause: production `DATABASE_URL` still uses `db.<project-ref>.supabase.co`,
  which the production configuration gate rejects.
- Detection gap: Vercel accepted the secret 18 days ago, but the pooler-host
  validation was not applied to that stored value until deployment.
- Prevention: validate provider environment values during configuration changes
  and retain a recoverable secure source for the pooler credential.
- Owner: Vercel production configuration for `project-management-agent`.
- Smallest next action: update the encrypted production `DATABASE_URL` with the
  existing Supabase pooler connection string, redeploy commit `7bd1762`, then
  capture the authenticated route and `/invoicing/billing-periods?is_closed=false`
  network response. The linked pooler host is known, but its password is not
  readable through the available Vercel or Supabase CLI sessions; resetting the
  shared database password is outside this task and unsafe.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning has a local first-occurrence fingerprint.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
