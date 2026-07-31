# Task: Polish Accounting dashboard hierarchy and project charts

Status: Complete
Owner: Codex
Created: 2026-07-18
Task ID: AAI-1158
Linear Issue: [AAI-1158](https://linear.app/megankharrison/issue/AAI-1158/polish-accounting-dashboard-hierarchy-and-project-charts)
Related Handoff: `docs/ops/handoffs/2026-07-18-S194-accounting-dashboard-hierarchy.md`

## Objective

Make the canonical `/accounting` dashboard faster to scan and more visually engaging by prioritizing project margin, removing empty/noisy content, excluding non-project revenue activity, and making full-width project charts readable at desktop and mobile widths.

## Scope

- Owned surface: `/accounting` section order, Gross Margin and Revenue by Project chart orientation, Revenue by Project project-only data contract, conditional Cost Breakdown visibility, Retainage copy, focused tests, and responsive evidence.
- Files/modules planned before edits: `frontend/src/app/(admin)/accounting/page.tsx`, `frontend/src/app/api/accounting/dashboard/route.ts`, matching focused tests, task/manifest/evidence/handoff files, generated architecture maps required by repository guardrails, and S194 control-plane rows.
- Explicit exclusion: Financial Position cards, accounting synchronization, database schema, monthly revenue semantics, WIP calculation, reports, recent activity, payment guardrails, permissions, and ledger workflows.

## Source of Truth

- Canonical runtime/data owner: `/api/accounting/dashboard`, with `acumatica_projects` determining project membership and shared `buildWipPortfolio` owning project margin.
- Existing shared primitives/services: `PageShell`, `Section`, Recharts, `getProjectDisplayName`, `FinancialPositionLayout`, `RetainageSection`, and existing error/retry flow.
- Deprecated or parallel paths: non-project AR codes are not valid Revenue by Project records; empty cost-dimension sections are not useful dashboard content.

Verification contract: Required

## Surface Gate

- Surface: company Accounting monitoring dashboard.
- One purpose: identify the named project financial condition that needs follow-up.
- Primary user job: compare current project exposure and open the relevant financial report.
- Primary action: open the named project report/list from the chart section.
- Secondary actions: inspect billed, cost, collected, open, margin, and rate values.
- Next action after success: continue into the canonical Accounting project or ledger surface.
- Correction path: correct source project metadata in Acumatica or use the existing retry/error path when the dashboard source fails.
- Keyboard path: links remain native keyboard-focusable; chart meaning remains available through accessible labels and visible text.
- Information that belongs elsewhere: technical project codes, non-project documents, unavailable cost dimensions, and row-level reconciliation.
- Blessed pattern: existing open dashboard sections and quiet Recharts modules; no new component or wrapper.
- Complexity budget: remove at least two visible noise sources, add no card, control, badge, border, icon, or animation.
- Pass/fail: project-only human labels, margin before retainage, no empty Cost Breakdown, horizontal readable charts, dark responsive layout, and zero overflow.

## Noise Gate

- Primary user: accounting operators and leadership.
- Primary job: identify project financial exposure quickly.
- Primary decision: which named project needs follow-up.
- Tier 1: Financial Position, Needs attention, and Gross Margin to Date.
- Tier 2: project revenue/collections and retainage.
- Tier 3: monthly trend and recent activity.
- Hide until requested: unavailable cost dimensions, technical codes, and source-row diagnostics.
- Remove: empty Cost Breakdown, redundant retainage caveat, and non-project Revenue by Project activity.
- Primary action: open All projects or the relevant canonical ledger.
- Failure-loudly behavior: source failures keep the existing explicit retry state; missing dimensions disappear instead of rendering a misleading empty report.

## Acceptance Criteria

- [x] Gross Margin to Date appears immediately after Financial Position and Needs attention.
- [x] Retainage remains available after Gross Margin with reduced explanatory copy.
- [x] Cost Breakdown is absent when both canonical dimension series are empty.
- [x] Revenue by Project excludes non-project activity and does not display `Unnamed project` or code `X` for the known dataset.
- [x] Gross Margin and Revenue by Project use responsive horizontal rankings with readable project names.
- [x] Existing financial totals, links, dark styling, and semantic positive/negative colors remain intact.
- [x] Desktop and mobile evidence prove the exact authenticated route and zero horizontal overflow.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No new component, route, card, control, or parallel data owner is planned.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Existing page/chart primitives own the change.
- [x] Errors and missing-data behavior remain specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are unchanged.

## Integration and Verification

- [x] Focused unit/source-contract and changed-file checks pass.
- [x] Authenticated `/accounting` browser readback proves hierarchy, project-only data, and hidden empty content.
- [x] Desktop and mobile screenshots are recorded and reviewed.
- [x] Independent functional/visual review approves the exact route.
- [x] Impeccable complexity audit passes.
- [x] Evidence artifacts are recorded and attached to Linear.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: dashboard API failure through the existing structured error/retry state, or a legitimate missing human project name through the shared safe fallback.
- Detection path: focused source contracts, live DOM/ARIA readback, exact-route screenshots, and independent review.
- Recovery path: retry the dashboard, correct canonical Acumatica project metadata, or use the linked canonical project/ledger surface.

## Incident Learning

- Failure fingerprint: `accounting.dashboard-margin-owner-drift`
- Root cause: the remaining Revenue by Project chart still accepted invoice groups without canonical project metadata, while page order and empty-state rendering allowed secondary or unavailable content to compete with the primary project decision.
- Detection gap: prior regression coverage fixed margin ownership but did not assert project-only revenue membership, section order, empty-dimension suppression, or mobile label readability.
- Prevention: project-membership filter at the API owner, source-order/noise contracts, horizontal chart accessibility contract, and responsive exact-route review.
- Guardrail evidence: `dashboard-contract.unit.test.ts` behaviorally proves available cost-dimension fallback and collected-plus-open ranking with conflicting invoiced totals; Accounting page/API source contracts prove section order, canonical membership, categorical Y-axis readability, and one accessible Revenue measure; exact-route desktop/mobile readback and independent review prove the rendered outcome.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | PASS | Source owner, approved shape, noise brief, scope, and done gate captured before product edits. |
| Starting state | AAI-1157 final screenshots and browser readback | PASS | Margin is correct; lower Revenue chart still shows `Unnamed project`, Cost Breakdown is empty, and margin is below Retainage. |
| Focused regression | 3 focused Jest suites | PASS | 16 tests cover hierarchy, categorical axes, canonical revenue membership, one ranking measure, and cost-dimension fallback. |
| Changed-file checks | ESLint, typecheck:changed, route checks, route guardrails | PASS | 0 lint errors; 7 existing raw-grid warnings remain unrelated. |
| Responsive browser proof | `browser-readback.json` plus four screenshots | PASS | Authenticated `/accounting`; 1440x1000 and 375x812; zero overflow; dark canvas; no Cost Breakdown, `Unnamed project`, or raw `X`. |
| Independent review | `independent-review.md` | PASS | Helmholtz approved the corrected revision with no P1/P2 findings. |
| Verification contract | `verification-result.json` | PASS | Declared evidence supports all three claims. |
| Publication | Commit `4ef6ace18acab90a369b906f09bf52360bcb291e` | PASS | Explicit push completed and local `HEAD` equaled `origin/main`. |

## Remaining Risk

- Monthly Revenue and Net Margin remains a separate semantic audit; this design slice does not change its calculation.
- Seven existing raw-page-grid lint warnings remain outside this scoped change; no new lint errors or warnings were introduced.

## Final Status

- [x] All required checklist items are complete after publication read-back.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
