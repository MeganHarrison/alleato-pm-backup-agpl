# Handoff: Alleato Brain UI

Date: 2026-07-24
Session: SBRAINUI2
Task: ALL-11-BRAIN-UI
Delivery lane: High-risk
Status: Complete

## Acceptance contract

- Canonical top-level Business Area list
- Knowledge, Meetings, Tasks, and Files branch views
- Finance fail-closed behavior
- Branch-stamped knowledge upload
- Search, sorting, pagination, source opening, and responsive behavior
- Failure-loud route, access, and upload states

## Work completed

- Added `/brain` and `/brain/[businessAreaId]` to the canonical company shell.
- Reused the canonical page shell, unified table, signed-in Supabase client,
  upload dialog, and navigation configuration.
- Added server-side branch queries and a read-only mapped-project fallback for
  Meetings and Tasks during the owner-gated parallel run.
- Kept Finance authorization ahead of all restricted content queries.
- Added an active-internal-employee gate before every Brain query.
- Moved Finance denied-state shell ownership to the route.
- Stamped verified `business_area_id` on the initial knowledge metadata insert.
- Removed generated-summary detail noise from the default table view.

## Evidence

- Live Supabase-generated types match the checked-in schema contract.
- Focused Jest: 5 suites, 50 tests, all pass.
- Changed-file quality and route-conflict gates pass.
- The canonical project map and app-surface search index include both Brain
  routes with curated descriptions.
- The canonical system map was reconciled to `origin/main` and reports 358 UI
  routes, including the two Brain routes without restoring retired login
  experiments.
- Internal Operations live counts: Knowledge 77, Meetings 157, Tasks 215,
  Files 30.
- Search, stored-source opening, and branch-aware upload dialog pass.
- Page, title-sort, and page-size controls update the server URL and reload.
- Responsive proof passes at 375, 414, 768, 1024, and 1440 pixels without
  horizontal overflow.
- Existing live rolled-back RLS proof denies a synthetic Finance nonmember.
- Authenticated external-contact browser proof redirects before `/brain`
  renders, and an internal nonmember browser session renders the route-owned
  Finance denial without resource content.
- The hardened live transition verifier also denies a recognized Finance
  fake-project member and mismatched Finance/direct scope.
- Independent high-risk review is APPROVED after the external-principal,
  route-owned denial, catalog reconciliation, and exact-file publication
  checks.
- The system-map receipt was published at `af6be44d`; the complete 43-file Brain
  UI slice was published to `origin/main` at
  `83ea23c6d4ca881795b25956316ab99c286d9452`.

## Known unrelated debt

The full frontend typecheck is already red in non-task admin, daily-brief, AI,
and other modules. No Brain-owned file appears in those errors; the changed-file
quality gate passes.

## Deferred gates

- Phase 2 owner assignments, exact Finance membership, and task disposition
  require owner input and are not invented.
- Phase 5 requires two actual weeks of parallel-run evidence.
- Phase 6 requires a real seven-day stability window and owner signoff.
- The Fireflies runtime deployment revision still needs provider-level
  confirmation before its scheduled interval can be certified.
