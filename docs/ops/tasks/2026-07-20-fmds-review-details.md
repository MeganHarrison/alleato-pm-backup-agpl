# Task: Actionable FMDS Table and Figure Review Details

Status: In Progress
Owner: Codex
Created: 2026-07-20
Task ID: AAI-1213
Linear Issue: [AAI-1213](https://linear.app/megankharrison/issue/AAI-1213/build-actionable-fmds-table-and-figure-review-details)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-aai-1213-review-ux.md`

## Objective

An authenticated ASRS reviewer can open an FMDS table or figure row, compare the staged extraction with its source image, record a review decision, and add notes without activating the corpus.

## Scope

- Compact identifier columns and row navigation on the canonical `/fm-global` tables and figures tabs.
- Canonical detail routes backed only by the dedicated ASRS Supabase project.
- Source evidence, extraction metadata, review status, audit fields, and reviewer notes.
- Excluded: taxonomy editing, deterministic rule-card activation, estimator behavior changes, or corpus activation.
- 2026-07-22 UX refactor: presentation and client-side interaction only. Data fetching, review payloads, API behavior, and persistence contracts are explicitly excluded.

## Attention Brief

- Primary user/job: ASRS reviewer comparing staged FMDS extractions with source evidence.
- Primary decision: approve an exact candidate, request changes, or reject it.
- Tier 1: authoritative source image, candidate extraction, identity, page, and review action.
- Hidden until useful: raw identifiers, storage paths, timestamps, and extraction diagnostics.
- Removal candidates: oversized number columns, passive rows, raw JSON, duplicate helper panels, and summary cards.
- Primary action: save a review decision and precise notes.
- Failure-loudly behavior: approval is disabled client-side and rejected server-side when no structured candidate exists.

## Acceptance Criteria

- [x] The table identifier column fits short values and leaves the majority of width for titles.
- [x] Every table row opens a specific FMDS0834 detail route.
- [x] The table detail route shows the authoritative source beside the candidate extraction.
- [x] The PDF page column and detail action open the exact source PDF page.
- [x] Empty extraction payloads are shown as not ready for review, not as raw diagnostic JSON.
- [x] Selecting Approved is the exact-match confirmation, and approval is blocked when structured evidence is absent.
- [x] Needs-changes/rejected decisions and notes persist through the dedicated ASRS review RPC.
- [ ] Figure rows have the equivalent detail and review workflow.
- [ ] Returning to the list visibly reflects a saved table and figure review status.
- [x] Review decisions use an accessible native radio group with no default selection.
- [x] Notes use progressive disclosure: required for Needs changes and Rejected, replaced by a concise confirmation for Approved.
- [x] Save review uses a non-orange action treatment and explains every disabled state.
- [x] Source and candidate comparison use the available wide layout with balanced source evidence.
- [x] Latest review and extraction diagnostics use deliberate, consistent detail-page treatments.

## Implementation Checklist

- [x] Current adapters, shared table/detail primitives, live ASRS schema, and evidence storage inspected.
- [x] FMDS0834 revision identity is enforced in table and figure list queries and table detail loading.
- [x] Typed table detail adapter, signed evidence URLs, and guarded review API implemented.
- [x] Canonical table config uses compact width, row-click navigation, filters, and PDF-page links.
- [x] Table detail surface uses the shared page shell/detail layout and separates source from candidate.
- [ ] Build the equivalent figure detail route without duplicating page structure.
- [x] Refactor the shared FMDS review form without changing its request payload or submit handler.
- [x] Reuse semantic success, warning, destructive, foreground, muted, and border tokens; add no hardcoded page colors.
- [x] Add a source-image TODO for future structured row-by-row authoritative comparison.
- [x] Establish sentence-case data headers and progressive-disclosure defaults for review surfaces in the design system.

## Integration and Verification

- [x] Focused review-form tests pass.
- [x] Changed-file typecheck and targeted lint pass.
- [x] Authenticated browser proof captured on the canonical table detail route at desktop and mobile widths.
- [x] Noise-gate audit passes for the table detail page and review form.
- [ ] Authenticated browser flow proves saved review -> refreshed list status.
- [ ] Figure detail/review browser proof is captured.
- [ ] Entire AAI-1213 workflow is accepted and closed.
- [ ] Radio keyboard behavior, conditional notes, disabled-save explanation, and responsive stacking are browser-verified.
- [ ] Updated desktop and mobile screenshots are attached to AAI-1213.

## Failure-Loudly Contract

- Cause surfaced as: explicit missing source image, missing structured candidate, wrong FMDS document identity, or failed review write.
- Detection path: server query constraints, API approval guard, focused tests, and authenticated browser proof.
- Recovery path: keep the record pending, request extraction changes, repair the named source/candidate issue, and retry.

## Incident Learning

- Failure fingerprint: the detail route displayed an authoritative image beside raw empty JSON and still implied the record could be approved.
- Root cause: the stored review candidate had no structured rows, while the UI treated technical extraction output as reviewable content.
- Detection gap: earlier verification proved data visibility, not whether a reviewer had two meaningful artifacts to compare.
- Prevention: both the client and API require structured rows or normalized cells before approval.
- Guardrail evidence: focused review-form tests, server-side approval check, and before/after screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live localization | Exact FMDS0834 table ID and ASRS read-back | Pass | Record is FMDS0834 table 2.1.4.5.5; it has an evidence image but no structured rows/cells. |
| Focused tests | `pnpm --dir frontend exec jest --runTestsByPath 'frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/review-form.unit.test.tsx' --runInBand` | Pass | 2/2 tests. |
| Changed-file typecheck | `pnpm --dir frontend run typecheck:changed` | Pass | No new changed-file debt after the JSON shape guard. |
| Targeted lint | ESLint on the FMDS detail, API, adapter, config, and tests | Pass | No errors; nine pre-existing design-system warnings remain in the shared generic table factory outside the touched type-only section. |
| Noise gate | Impeccable surface-complexity audit | Pass | Detail page and review form pass. |
| Review-surface audit | Authenticated browser, desktop and mobile | Pass | ` /tmp/asrs-review-audit-final-desktop.png` and ` /tmp/asrs-review-audit-final-mobile.png`; reviewed state, corrective notes path, sentence-case headers, and compact successful-check treatment inspected. |
| Desktop proof | `docs/ops/evidence/2026-07-20-fmds-review-clarity/after-desktop.png` | Pass | Authoritative source and explicit not-ready candidate state are visible. |
| Mobile proof | `docs/ops/evidence/2026-07-20-fmds-review-clarity/after-mobile-375.png` | Pass | No horizontal page overflow; review controls remain usable. |
| Full frontend typecheck | `cd frontend && npm run typecheck` | Partial | The task-local review API error was fixed; remaining failures are pre-existing or separately owned FMDS RAG/repository debt. |

## Remaining Risk

- The current FMDS0834 table record cannot be approved until the extraction pipeline writes structured rows or cells. It correctly remains pending.
- Figure detail/review parity and an end-to-end persisted review/read-back are still required before AAI-1213 can close.

## Final Status

- [ ] All required checklist items are complete; table review is published as an in-progress vertical slice.
- [x] Evidence is filled in for the table slice.
- [x] Incident learning and prevention are recorded.
- [x] Deferred figure work has a named next action.
