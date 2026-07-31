# Task: Replace AI Dashboard Preview Data With Live Content

Status: Complete
Owner: Codex
Created: 2026-07-16
Task ID: AAI-1139
Linear Issue: [AAI-1139](https://linear.app/megankharrison/issue/AAI-1139/replace-ai-dashboard-preview-data-with-live-executive-content)
Related Handoff: `docs/ops/handoffs/2026-07-16-S180-ai-dashboard-live-content.md`

## Objective

Make the AI Dashboard workspace safe to share with Brandon by replacing fabricated preview content with canonical live data, persistent navigation, and decision-useful charts.

## Scope

- Overview: Daily Brief, portfolio coverage, executive attention, system health, and accounting trends.
- Projects: current project operating state updated in the last 14 days.
- Decisions: canonical Executive Attention records.
- Accounting and accounting detail pages: canonical dashboard, WIP, and reconciliation responses.
- RAG Pipeline: live document lifecycle response.
- Preserve the existing Architecture and Architecture Change Log content.
- Excluded: new database tables, new executive-state writers, new accounting calculations, and changes to canonical API ownership.

## Source of Truth

- Canonical executive readers: `/api/executive/daily-brief/widget`, `/api/executive/portfolio-state`, `/api/executive/attention`, and `/api/executive/system-health`.
- Canonical financial readers: `/api/accounting/dashboard` and `/api/accounting/wip`.
- Canonical RAG lifecycle reader: `/api/documents/status?type=meeting&source=fireflies`.
- Existing shared primitives: AI Dashboard workspace shell, workspace primitives, `apiFetch`, React Query, and shared chart components.
- Deprecated or parallel paths: `workspace-preview-data.ts` and all preview labels, fabricated values, and static signal arrays.

Verification contract: Required

## Acceptance Criteria

- [x] The Overview page uses only live API values and retains navigation to every child page.
- [x] The Overview page includes at least two meaningful charts backed by canonical live data.
- [x] Projects, Decisions, Accounting, accounting details, and RAG Pipeline no longer import preview arrays.
- [x] Every actionable item links to its canonical page or record.
- [x] Source-specific loading, empty, permission, and error states are visible and actionable.
- [x] Preview labels and known fabricated metrics are absent from the DOM.
- [x] Desktop and mobile layouts remain overflow-safe.

## Implementation Checklist

- [x] AAI-1139 and S180 define scope before implementation.
- [x] A shared live-data contract owns API querying and response types.
- [x] Existing shared chart and workspace primitives are reused.
- [x] The obsolete preview-data module is removed.
- [x] Focused tests cover live values, links, charts, and failure states.
- [x] Database, provider, authentication, permission, and delivery ownership remain unchanged.

## Integration and Verification

- [x] Focused static and unit checks pass.
- [x] Authenticated API readback proves each source is live.
- [x] Authenticated desktop and mobile browser proof is captured and reviewed.
- [x] Independent design review approves the result.
- [x] Impeccable surface and noise-gate checks pass.
- [x] Verification contract passes with `--require-pass`.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the failed source name, API message, and affected dashboard section.
- Detection path: focused query tests, authenticated browser readback, and exact-route screenshot review.
- Recovery path: retry the failed source or open its canonical operational page without hiding healthy sections.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the AI Dashboard pages were intentionally launched as visual previews and retained hard-coded arrays after the shareable workspace requirement changed.
- Detection gap: tests asserted preview copy and links instead of rejecting fabricated values or requiring live source ownership.
- Prevention: shared query contracts plus focused assertions that reject preview labels and fabricated metrics.
- Guardrail evidence: focused error-state test, source-specific recovery copy, and `verification.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live source inventory | Authenticated API readback | Pass | Executive, accounting, WIP, and document lifecycle endpoints returned current data. |
| Task setup | AAI-1139 and S180 | Pass | Scope and done gate captured before implementation. |
| Focused unit tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath ...` | Pass | 2 suites, 10 tests. |
| Targeted lint | ESLint on changed AI Dashboard source and tests | Pass | No findings. |
| Changed type debt | `npm --prefix frontend run typecheck:changed -- --files 'src/app/(main)/ai-dashboard'` | Pass | No new `any` debt. |
| Full typecheck | `npm --prefix frontend run typecheck` | Unrelated fail | No AI Dashboard errors; existing repo-wide type debt remains outside scope. |
| Impeccable audit | `audit-surface-complexity.mjs` on seven changed UI surfaces | Pass | All surfaces passed. |
| Desktop evidence | `overview-desktop.png`, `projects-desktop.png`, `decisions-desktop.png`, `accounting-desktop.png`, `rag-pipeline-desktop.png` | Pass | Exact authenticated routes reviewed. |
| Mobile evidence | `overview-mobile.png` | Pass | Navigation affordance, hierarchy, and overflow reviewed at 390x844. |
| Independent review | `independent-review.md` | Pass | Bohr approved the corrected Decisions, RAG, and mobile navigation surfaces. |
| Verification contract | `npm run verify:contract -- --manifest ... --result ... --require-pass` | Pass | Declared evidence supports the live overview, child routes, failure honesty, and responsive quality claims. |
| Publication | `npm run codex:finish -- --staged-only --verification-manifest ... --verification-result ...` | Pass | Implementation published at `307f7f429`; final evidence published at `e0a51e50b`; remote equality verified by the finish flow. |
| Linear closeout | AAI-1139 completion comment and state | Pass | Comment `8ef2c4cc-4092-414f-9bba-4b92216c3331`; issue moved to Done. |

## Remaining Risk

- The current portfolio-state response has limited project coverage. The page exposes the missing projection and packet-evidence owners; no project activity is inferred.
- The document lifecycle endpoint reports 1,888 total records but returns the latest 100. The page explicitly distinguishes the source total from the sampled chart.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
