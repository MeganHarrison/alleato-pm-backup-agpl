# Task: Make Site Map tag assignment reachable

Status: Ready to publish, live data assignment deferred
Owner: Codex
Created: 2026-08-01
Task ID: LOCAL-SITEMAP-TAG-ASSIGNMENT-20260801
Linear Issue: Not requested
Related Handoff: N/A, single-session isolated workspace

## Objective

An app admin can select one or more Site Map pages and apply a dashboard tag directly from the table toolbar.

## Scope

- `frontend/src/app/(admin)/site-map/site-map-client.tsx`
- The existing `/api/admin/page-tags` persistence contract and dashboard assignment readback
- Pages-first Site Map tab ordering

## Source of Truth

- Canonical runtime/data owner: `app_page_tag_assignments` through `/api/admin/page-tags`
- Existing shared primitives/services: `UnifiedTablePage`, Site Map selection toolbar, React Query `page-tags`
- Deprecated or parallel paths: nested `Edit → Add tags` bulk-menu path

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Selecting table rows exposes a direct `Apply tags` action.
- [ ] Selecting Brandon's Dashboard persists assignments through the existing tag API. This requires the owner to choose the intended pages.
- [x] Brandon's Dashboard reads the persisted assignment contract after navigation or refresh.
- [x] Page tags remain explicitly recoverable when the tag API save fails.
- [x] Pages is the first Site Map tab.

## Failure-Loudly Contract

- Cause surfaced as: existing toast, `Tags were not added. Try refreshing the page.`
- Detection path: `app_page_tag_assignments` readback for the selected tag.
- Recovery path: retry the direct `Apply tags` action after refreshing the Site Map.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: Brandon's Dashboard had a catalog tag but zero persisted assignments; the only bulk assignment path was nested under `Edit`.
- Detection gap: the dashboard empty state did not distinguish an empty tag from a failed or undiscoverable assignment workflow.
- Prevention: surface the canonical bulk action directly when table rows are selected and verify database readback.
- Guardrail evidence: focused Site Map table lint and live assignment query.

## Evidence

| Check                | Command / artifact                                    | Result   | Notes                                                                              |
| -------------------- | ----------------------------------------------------- | -------- | ---------------------------------------------------------------------------------- |
| Live DB localization | `supabase db query`                                   | Passed   | Brandon tag exists with zero assignments; Megan has 113.                           |
| Source checks        | Focused Prettier, ESLint, Jest                        | Passed   | 12 focused tests passed.                                                           |
| Dashboard contract   | Tagged dashboard Jest test                            | Passed   | The dashboard filters routes by persisted tag assignment.                          |
| User-flow proof      | Authenticated Site Map action and assignment readback | Deferred | No intended Brandon pages were specified, so no production assignment was created. |

## Remaining Risk

- The live Brandon tag currently has zero assignments. The dashboard will remain empty until the owner applies it to chosen pages through the published table action.
- Screenshot proof is blocked because the in-app browser annotation session cannot be controlled by the verification tools.
