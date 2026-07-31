# Task: Align Accounting with the premium dark dashboard style

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1145
Linear Issue: [AAI-1145](https://linear.app/megankharrison/issue/AAI-1145/align-canonical-accounting-dashboard-with-the-premium-dark-ai)
Related Handoff: `docs/ops/handoffs/2026-07-17-S187-accounting-dashboard-dark-style.md`

## Objective

Make the canonical `/accounting` dashboard use the same premium dark, warm-orange visual language and open chart hierarchy as the AI Dashboard workspace without changing its live financial sources or drilldowns.

## Scope

- Owned surface: exact `/accounting` dashboard, its route-scoped admin theme boundary, page hierarchy, and focused contract tests.
- Files/modules planned before edits: `frontend/src/app/(admin)/admin-layout-client.tsx`, `frontend/src/app/(admin)/accounting/page.tsx`, `frontend/src/app/(admin)/accounting/__tests__/accounting-dashboard-theme-contract.test.ts`, and task evidence/control-plane files.
- Explicit exclusion: accounting API aggregation, Acumatica data contracts, child report behavior, permissions, and the separate `/ai-dashboard/accounting` visualization task.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/accounting/page.tsx` and `/api/accounting/dashboard`.
- Existing shared primitives/services: `PageShell`, semantic color tokens, `frontend/src/app/(main)/ai-dashboard-theme.module.css`, existing Accounting navigation, Recharts visualizations, and canonical report links.
- Deprecated or parallel paths: no new Accounting route, page-local color palette, or duplicate visualization contract.

Verification contract: Required

## Attention Brief

- Surface: canonical company Accounting dashboard.
- One purpose: show leadership and accounting operators where financial position or exceptions require action.
- Primary user job: assess cash exposure, receivables/payables, project margin, and financial exceptions.
- Primary action: open the affected ledger, reconciliation view, WIP report, or project report.
- Secondary actions: switch Accounting reports, review recent activity, and inspect source freshness.
- Next action after success: continue into the linked canonical report with the dashboard context preserved.
- Correction path: Accounting navigation and the existing retry/error state.
- Keyboard path: existing semantic links, selects, and buttons remain keyboard accessible.
- Information elsewhere: row-level records stay in canonical reports; the dashboard only summarizes.
- Blessed pattern: AI Dashboard dark/orange route theme plus open sections and localized chart modules.
- Complexity budget: one shared theme reuse point, one hierarchy cleanup, one focused contract test.
- Pass/fail: pass only when authenticated desktop and mobile views visibly match the dashboard language without overflow or loss of real data.

## Noise Gate

- Primary user: company leadership and accounting operators.
- Primary job: understand current financial position and decide what needs review.
- Primary decision: which exposure, margin condition, or exception to act on next.
- Tier 1: source freshness, AR/AP aging, cash movement, and actionable exceptions.
- Tier 2: project margin, cost breakdown, revenue movement, reports, and recent activity.
- Tier 3: row-level ledger details behind drilldowns.
- Hide until requested: row-level details remain in linked reports.
- Remove: duplicated top metric tiles and duplicated bottom ledger-total strip.
- Primary action: open the relevant canonical accounting report.
- Failure-loud behavior: retain the specific API error message and Retry action; never render missing data as healthy zeroes.

## Acceptance Criteria

- [x] Exact `/accounting` and its route chrome use the shared dark carbon canvas and warm orange accent without retheming child reports.
- [x] Live Acumatica-backed charts, source freshness, exceptions, reports, and drilldowns remain intact.
- [x] Duplicate metric/KPI summaries are removed and the financial charts lead the content hierarchy.
- [x] Desktop, tablet, and mobile layouts have deliberate gutters and no horizontal overflow.
- [x] Failure-loudly behavior is defined and retained.
- [x] Relevant existing guardrails are identified before implementation.
- [x] No duplicate theme or route implementation is introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are unchanged.

## Integration and Verification

- [x] Focused contract and changed-file checks pass.
- [x] Authenticated `/accounting` browser readback proves the requested outcome.
- [x] Screenshots at 1440, 1024, 768, 414, and 375 widths are recorded.
- [x] Independent visual review approves the exact canonical route.
- [x] Impeccable complexity audit passes on changed UI files.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and `origin/main` contains the merged revision.

## Failure-Loudly Contract

- Cause surfaced as: the existing API error message from `/api/accounting/dashboard`.
- Detection path: focused theme contract, authenticated browser readback, console/network review, and responsive screenshots.
- Recovery path: Retry the dashboard load, then use the linked canonical reports if the aggregate source remains unavailable.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: focused route-theme regression contract prevents the Accounting route from silently falling back to the global light canvas.
- Guardrail evidence: focused route-isolation contract, current generated project map, and PR guardrails passed.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, attention brief, noise gate, and done gate captured before implementation. |
| Runtime baseline | Authenticated in-app browser `/accounting` snapshot | Pass | Real data and canonical drilldowns observed before edits. |
| Focused contracts | `npm run test:unit -- --runInBand --runTestsByPath ...` | Pass | 2 suites, 5 tests. |
| Changed quality | Targeted ESLint, `typecheck:changed`, `lint:changed:debt`, `check:routes` | Pass | 0 errors; no new lint or `any` debt; no route conflicts. |
| Complexity | Impeccable `audit-surface-complexity.mjs` | Pass | Both changed UI files pass. |
| Browser proof | `docs/ops/evidence/2026-07-17-accounting-dashboard-dark-style/` | Pass | Authenticated desktop/mobile screenshots and no-overflow readback. |
| Independent review | `independent-review.md` | Pass | Hegel approved exact-route correction as safe to publish. |
| Verification contract | `npm run verify:contract -- ...` | Pass | Declared evidence supports PASS. |
| Screenshot comments | Linear AAI-1145 attachments | Pass | Viewable authenticated desktop and mobile screenshots attached. |
| Publication | [PR #46](https://github.com/The-Alleato-Group/project-management/pull/46) | Pass | Squash-merged to `origin/main` at `81bdfe93140e11aa6a1cf13889923120c289295c`. |

## Remaining Risk

- The theme is intentionally isolated to exact `/accounting`; child report modernization remains outside this task. Owner: product/design. Next action: audit each child before any broader dark-theme rollout.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
