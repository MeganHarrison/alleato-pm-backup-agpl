# SROOT: AAI-1213 ASRS Review UX Refactor

Status: In Progress
Linear: AAI-1213 — https://linear.app/megankharrison/issue/AAI-1213/build-actionable-fmds-table-and-figure-review-details

## Intake

- Scope: redesign the single-record FMDS table review experience using semantic status colors, native radio decisions, conditional notes, balanced source/candidate comparison, visible disabled-save reasons, and deliberate latest-review/diagnostics treatments.
- Canonical route: `/asrs/tables/[tableId]`, currently verified against table `95fec116-9f3c-4ee0-8eae-1a7b65003017`.
- Canonical owners: `FmdsTableDetailView`, shared `FmdsVisualReviewForm`, `DetailLayout`, and `StatusBadge`.
- Explicit exclusions: no data-query, request-payload, review API, Supabase, or backend behavior changes.
- User-directed sequencing: complete the annotation/design pass before running verification.

## Implemented Files

- `frontend/src/app/(main)/fm-global/fm_global_tables/[tableId]/page.tsx`
- `frontend/src/app/(main)/asrs/figures/[figureId]/page.tsx`
- `frontend/src/components/fmds/fmds-visual-review-form.tsx`
- `frontend/src/components/ds/status-badge.tsx`
- `frontend/src/components/ds/InfoAlert.tsx`
- `frontend/src/components/layout/detail-layout.tsx`
- `frontend/src/components/ui/button.tsx`
- `frontend/src/app/globals.css`
- `frontend/tailwind.config.ts`
- Focused review/status tests
- This handoff and the AAI-1213 task file

## Commands and Evidence

| Command / artifact | Result | Notes |
| --- | --- | --- |
| User annotation pass | In progress | Verification intentionally deferred until design annotations are complete. |
| UX implementation | Implemented, unverified | Native radio cards, conditional notes, explicit Save blockers, semantic status/action tokens, balanced source evidence, latest-review card, and diagnostics control are in source. |
| Review-surface audit | Pass | Browser evidence: `/tmp/asrs-review-audit-final-desktop.png`, `/tmp/asrs-review-audit-final-mobile.png`; the correction path was also inspected at `/tmp/asrs-review-audit-needs-changes.png`. |

## Migration Ledger Evidence

- No database migration is in scope.

## Risks and Next Step

- Risk: the shared review form also serves figure reviews; preserve behavior parity while changing presentation.
- Next: continue the user annotation pass. Focused tests remain pending; browser review was run because the user explicitly requested a comprehensive review of the identified UI issues.
