# Task: Group Accounting AR and AP charts by project

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1147
Linear Issue: [AAI-1147](https://linear.app/megankharrison/issue/AAI-1147/group-accounting-ar-and-ap-charts-by-project)
Related Handoff: `docs/ops/handoffs/2026-07-17-S190-accounting-project-balance-charts.md`

## Objective

Make the canonical `/accounting` Accounts Receivable and Accounts Payable bar charts show outstanding balances grouped by project instead of aging-day buckets.

## Scope

- Owned surface: the two Financial Position charts on exact `/accounting`, their focused regression contract, and task evidence.
- Files/modules planned before edits: `frontend/src/app/(admin)/accounting/page.tsx`, a focused test under `frontend/src/app/(admin)/accounting/__tests__/`, and task/evidence/control-plane files.
- Explicit exclusion: dashboard API aggregation, Acumatica synchronization, database schema, permissions, child reports, and the existing aging data used by attention logic.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/accounting/page.tsx` consuming `/api/accounting/dashboard`.
- Existing shared primitives/services: response fields `arByProject`, `apByProject`, `arAging`, `apAging`, Recharts, `TextLink`, and the existing Accounting error/Retry flow.
- Deprecated or parallel paths: no new route, API endpoint, or duplicate project aggregation.

Verification contract: Required

## Surface Gate

- Surface: Financial Position chart pair on `/accounting`.
- One purpose: identify which projects carry outstanding receivable and payable exposure.
- Primary user job: choose the project balance that needs financial follow-up.
- Primary action: open the canonical invoice or bill report.
- Secondary actions: compare project balances and inspect exact project/customer details in the tooltip.
- Next action after success: continue into the linked ledger.
- Correction path: the existing dashboard Retry state and canonical ledger reports.
- Keyboard path: existing semantic links remain keyboard accessible; chart tooltips supplement rather than replace visible axis labels.
- Information that belongs elsewhere: aging-day detail remains in canonical AR/AP reports and existing attention logic.
- Blessed pattern: existing Accounting Recharts module with a single quiet project-balance series.
- Complexity budget: one reusable chart component, six visible project bars, no new controls or containers.
- Pass/fail: both charts use project-group response fields, show explicit unassigned data, preserve totals/links, and remain readable without overflow.

## Noise Gate

- Primary user: company leadership and accounting operators.
- Primary job: identify project-level cash exposure.
- Primary decision: which project needs AR or AP follow-up.
- Tier 1: project code and outstanding balance.
- Tier 2: total outstanding and number of represented projects.
- Tier 3: project description and customer in the tooltip.
- Hide until requested: aging buckets and row-level ledger detail.
- Remove: day-range categories and four-color aging severity encoding from these two charts.
- Primary action: open the relevant canonical ledger.
- Failure-loudly behavior: show a quiet, explicit no-project-balances state; retain the dashboard API error and Retry path.

## Acceptance Criteria

- [x] AR chart reads `arByProject` and AP chart reads `apByProject`.
- [x] Visible axis labels are project codes; exact description/customer/balance remain available in tooltips.
- [x] `(No Project)` is presented as `Unassigned`, not dropped.
- [x] Existing outstanding totals, aging-based attention logic, and ledger links remain intact.
- [x] Desktop, tablet, and mobile layouts remain readable without horizontal overflow.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate route, aggregation, or chart data owner is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns the AR/AP project chart behavior.
- [x] Errors and empty states are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are unchanged.

## Integration and Verification

- [x] Focused regression and changed-file checks pass.
- [x] Authenticated `/accounting` browser readback proves project labels and balances.
- [x] Desktop, tablet, and mobile screenshots are recorded.
- [x] Independent visual review approves the exact route.
- [x] Impeccable complexity audit passes.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and `origin/main` contains the merged revision.

## Failure-Loudly Contract

- Cause surfaced as: no source-backed project balances are available for the chart.
- Detection path: focused component contract plus authenticated DOM and screenshot review.
- Recovery path: open the canonical invoices or bills report; dashboard-level load failures retain Retry.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A, this is a requested visualization change.
- Detection gap: the existing regression test protected theme isolation but not the chart grouping dimension.
- Prevention: focused contract asserts project response fields and rejects aging-bucket chart labels.
- Guardrail evidence: focused source-ownership contract, authenticated responsive readback, shared Financial Position layout, and verification contract PASS.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope, source ownership, attention brief, and done gate captured before implementation. |
| Focused regression | `npm run test:unit -- --runInBand --runTestsByPath ...` | PASS | 2 suites, 6 tests. |
| Targeted lint | ESLint on page, shared layout, and focused contract | PASS | 0 errors; 8 inherited warnings elsewhere in the legacy page. |
| Route guardrail | `npm run check:routes` | PASS | No route conflicts. |
| Complexity audit | `audit-surface-complexity.mjs` on both changed UI files | PASS | Both files pass. |
| Canonical runtime | `browser-readback.json` and responsive screenshots | PASS | AR/AP project labels present, aging titles absent, no horizontal overflow. |
| Independent review | `independent-review.md` | PASS | Plato approved the exact task surface after mobile AP and spacing corrections. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ...` | PASS | Declared evidence supports PASS. |
| Auth isolation | `git diff --exit-code -- frontend/src/lib/auth/admin-dashboard-allowlist.ts` | PASS | Temporary local evidence access was removed; production allowlist unchanged. |
| Publication | `d3e040f0e1f0f9da9ff8454798fb29864dde7d58` | PASS | `HEAD == origin/main` after scoped push. |
| Production deploy | `project-management-agent-eys9ex03i-the-alleato-group.vercel.app` | PASS | Vercel production status Ready with the canonical alias. |

## Remaining Risk

- The chart shows the six largest balances for scanability while the total and project count describe the complete source set. Owner: product/design. Next action: preserve full detail in the canonical ledger and tooltip.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
