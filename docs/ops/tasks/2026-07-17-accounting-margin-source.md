# Task: Use canonical WIP margin data in Accounting

Status: Complete
Owner: Codex
Created: 2026-07-17
Task ID: AAI-1157
Linear Issue: [AAI-1157](https://linear.app/megankharrison/issue/AAI-1157/use-canonical-wip-margin-data-in-accounting-dashboard)
Related Handoff: `docs/ops/handoffs/2026-07-17-S193-accounting-margin-source.md`

## Objective

Make the canonical `/accounting` project-margin chart show internally consistent margin-to-date values for real named projects, without non-project code `X` or redundant explanatory copy.

## Scope

- Owned surface: Accounting dashboard project-margin API projection, chart heading/copy, focused regression tests, and exact-route responsive evidence.
- Files/modules planned before edits: `frontend/src/app/api/accounting/dashboard/route.ts`, `frontend/src/lib/accounting/wip-portfolio.ts` only if its existing contract needs reinforcement, `frontend/src/app/(admin)/accounting/page.tsx`, focused tests under the matching owners, task/evidence/control-plane files, and generated architecture artifacts required by repository guardrails.
- Explicit exclusion: source Acumatica records, database schema, AR/AP balance charts, monthly revenue visualization, synchronization, permissions, and ledger workflows.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/lib/accounting/wip-portfolio.ts` for signed billed-to-date and costs-to-date project margin.
- Existing shared primitives/services: `buildWipPortfolio`, the existing Accounting Recharts module, project display-name contract, and route-level `GuardrailError` handling.
- Deprecated or parallel paths: the dashboard route's manual unsigned AR amount minus open AP bill aggregation.

Verification contract: Required

## Surface Gate

- Surface: Project margin visualization on `/accounting`.
- One purpose: identify which named projects carry the largest margin-to-date impact.
- Primary user job: compare project financial performance and choose a project for follow-up.
- Primary action: open All projects.
- Secondary action: inspect billed, cost-to-date, margin, and rate in the tooltip.
- Correction path: source financial/project data is corrected in Acumatica; loader failures remain visible through the existing Accounting error state.
- Information that belongs elsewhere: technical project codes, non-project document codes, and row-level reconciliation.
- Blessed pattern: existing quiet Accounting chart consuming the canonical WIP portfolio service.
- Complexity budget: remove one subtitle; add no card, control, badge, border, or section.
- Pass/fail: no `Unnamed project` or `X` artifact, named projects use one consistent WIP basis, dark layout remains responsive.

## Noise Gate

- Primary user: accounting operators and leadership.
- Primary job: compare named project margin to date.
- Primary decision: which project warrants financial follow-up.
- Tier 1: project name and margin.
- Tier 2: billed and cost-to-date values.
- Tier 3: customer and rate in the tooltip.
- Hide until requested: technical codes, non-project documents, and source-row diagnostics.
- Remove: the redundant chart-description sentence and the invalid non-project bar.
- Primary action: open All projects.
- Failure-loudly behavior: canonical WIP loader errors throw a labeled guardrail response; legitimate missing metadata keeps a visible human fallback rather than exposing an ID.

## Acceptance Criteria

- [x] The project-margin chart is sourced from the canonical WIP portfolio owner.
- [x] Margin uses signed billed-to-date and costs-to-date on one internally consistent basis.
- [x] Non-project code `X` does not enter the project-margin chart.
- [x] Visible bars use human project names and no invalid `Unnamed project` bar remains for the known `X` data.
- [x] The redundant project-margin description is removed.
- [x] Tooltip labels accurately describe billed, cost-to-date, margin, and rate.
- [x] Desktop and mobile evidence prove the exact authenticated route, dark styling, and zero horizontal overflow.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] The parallel dashboard margin calculation is removed.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared WIP abstraction owns the margin calculation.
- [x] Errors remain specific and actionable.
- [x] Database, provider, authentication, permission, and delivery contracts are unchanged.

## Integration and Verification

- [x] Focused unit/source-contract and changed-file checks pass.
- [x] Authenticated `/accounting` browser readback proves the corrected named-project chart.
- [x] Desktop and mobile screenshots are recorded and reviewed.
- [x] Independent functional/visual review approves the exact route.
- [x] Impeccable complexity audit passes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: canonical WIP source query failure or a legitimate project record without usable descriptive metadata.
- Detection path: `GuardrailError` route response, focused ownership regression, live data readback, authenticated DOM inspection, and responsive screenshots.
- Recovery path: fix the named canonical source/query; preserve the existing Accounting retry state and human-safe missing-name fallback.

## Incident Learning

- Failure fingerprint: `accounting.dashboard-margin-owner-drift`
- Root cause: the Accounting dashboard bypassed its documented canonical WIP owner and independently subtracted only open AP bills from unsigned AR amounts, admitting non-project code `X` and inflating credit memos.
- Detection gap: project-name presentation tests did not assert financial owner, sign convention, project-only filtering, or margin-basis consistency.
- Prevention: route ownership contract plus canonical WIP reuse and exact-route data/visual verification.
- Guardrail evidence: `frontend/src/app/api/accounting/dashboard/__tests__/accounting-margin-source.test.ts` and `docs/ops/evidence/2026-07-17-accounting-margin-source/summary.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | PASS | Source owner, attention brief, scope, and done gate captured before product edits. |
| Runtime localization | User browser screenshot plus live Supabase readback | PASS | Non-project `X` contributed $84.47M of unsigned AR amount and had no project metadata; route used only open AP bills as cost. |
| Focused tests | Two Jest suites, eight tests | PASS | Canonical owner, margin basis, copy, and no-parallel-owner contracts pass. |
| Changed-file checks | Targeted ESLint, changed type guard, route checks | PASS | Zero lint errors; eight inherited page-grid warnings only. |
| Complexity audit | Impeccable surface audit | PASS | Accounting page passes. |
| Browser proof | `browser-readback.json` and responsive screenshots | PASS | Eight named projects, redundant subtitle absent, dark styling, zero overflow. |
| Independent review | `independent-review.md` | PASS | Feynman approved correctness and desktop/mobile visual quality. |
| Verification contract | `verification-result.json` | PASS | Declared evidence supports all required claims. |
| Auth isolation | `git diff --exit-code -- frontend/src/lib/auth/admin-dashboard-allowlist.ts` | PASS | Temporary local test access removed. |
| Project/system maps | `npm run map:project`; `NODE_PATH=... npm run map:system` | PASS | Generated owners remain current; no generated diff. |

## Remaining Risk

- The separate monthly revenue/margin visualization has different semantics and remains outside this correction; evaluate it independently rather than expanding this source-owner repair.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
