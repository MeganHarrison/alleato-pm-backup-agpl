# Task: Training Library Index Redesign

Status: In Progress
Owner: Codex
Created: 2026-07-28
Task ID: local-training-library-index-redesign
Linear Issue: Not required for a single-session Standard task.
Related Handoff: N/A

## Objective

Redesign the production `/training/library` route as a compact, scan-friendly index while preserving its canonical Supabase data access and internal resource-detail routing.

## Scope

- Canonical training library page, filters, resource presentation, and focused tests
- Authenticated desktop and mobile evidence against real training data
- Excludes schema changes, resource ingestion, review workflow, and detail-page content redesign

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(main)/training/library/page.tsx`, `frontend/src/lib/training/server.ts`, and `frontend/src/lib/training/data-access.ts`
- Existing shared primitives/services: `PageShell`, `ResourceFilters`, `ResourceCard`, Supabase training domain types
- Deprecated or parallel paths: standalone `alleato-resource-library.html` is a design prototype only and is not a runtime data owner

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Production Supabase resources remain the only source of library records.
- [x] Every published result links to `/training/resources/[resourceId]`.
- [x] Results use a structured index instead of topic-separated card grids.
- [x] Search and role, track, format, and depth filters remain functional.
- [x] Filtered-empty and unseeded states are distinct and actionable.
- [x] Desktop and mobile browser evidence proves the changed route.

## Implementation Checklist

- [x] Canonical route, adapter, data access, and detail route were inspected before edits.
- [x] Existing domain and interaction owners are reused.
- [x] Errors remain specific and actionable.
- [x] No database, provider, authentication, permission, or schema contract is changed.

## Integration and Verification

- [x] Focused component and route tests pass.
- [x] Authenticated browser flow proves real Supabase data and internal detail navigation.
- [x] Desktop and mobile screenshots are recorded.
- [x] Task-owned files are published and production deployment is verified.

## Failure-Loudly Contract

- Cause surfaced as: either no published resources are available or no records match active retrieval filters.
- Detection path: distinct visible empty-state title and copy at the result boundary.
- Recovery path: the retrieval controls retain one-click clear actions while the result boundary explains the no-match condition; an unseeded library reports that reviewed resources must be published.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: focused route and component tests plus authenticated browser evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Supabase readback | Service-role read of training tables | Pass | 67 published resources, 27 topics, 6 roles, and 270 resource-role links. |
| Production baseline | Authenticated `https://projects.alleatogroup.com/training/library` | Pass | Confirmed 67 real records and internal resource links before editing. |
| Focused regression suite | `pnpm exec jest --runInBand --runTestsByPath ...` | Pass | 4 suites, 21 tests. |
| Targeted lint | `pnpm exec eslint` on the four changed runtime files | Pass | No warnings or errors. |
| Local runtime | Next dev server on port 3107 | Blocked | Server bound the port but never reached Ready; `/training/library` timed out. Production verification remains required after publication. |
| Team Vercel deployment | `dpl_FXBJZ63frUK5jiB47gCxYvzJKEw7` | Pass | Production deployment Ready and aliased to `projects.alleatogroup.com`. |
| Production desktop | `docs/ops/evidence/2026-07-28-training-library-index-desktop.png` | Pass | Authenticated route renders 67 real resources in the structured index. |
| Production mobile | `docs/ops/evidence/2026-07-28-training-library-index-mobile.png` | Pass | Compact search, filter disclosure, and readable resource rows verified at 390px. |
| Detail navigation | `/training/resources/43a47e3e-ee12-48a2-9ae9-f3c8dfc4a4f1` | Pass | First production result opened the Supabase-backed internal lesson page. |
| Legacy personal Vercel deployment | `dpl_DKPnF75WRf6vGso3K6B3MSRTLBAD` | Fail | Duplicate `frontend` project exhausted its 8 GB build container after Turbopack stalled and Webpack was SIGKILLed. It is not the successful team deployment serving the production alias. |

## Remaining Risk

- A duplicate legacy personal Vercel project still fails its full build from repository-wide OOM pressure. The canonical team deployment succeeded and production is live, but the duplicate check keeps the combined GitHub status red.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] No deferred product behavior is hidden.
