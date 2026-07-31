# Task: Plane-derived Projects workspace

Status: Ready for Integration
Owner: S20260731-PLANE-PROJECTS
Created: 2026-07-31
Task ID: AAI-PLANE-PROJECTS
Linear Issue: Program scope is tracked by the parent Plane-to-Alleato implementation task; no new sub-issue requested.
Related Handoff: Parent task conversation and isolated-workspace publication receipt.

## Objective

Create a new Plane-derived Projects workspace surface that uses Alleato's real
project list, create, and detail boundaries without changing the existing
Projects route or shared navigation during this construction slice.

## Scope

- Own `frontend/src/features/plane-projects/**` as a replacement-ready template.
- Provide Plane-derived grid and compact list presentations, search, active /
  archived filtering, sorting, loading, empty, and actionable error states.
- Link project creation to `/create-project` and project selection to
  `/{projectId}/home`.
- Defer shared route and sidebar wiring, authenticated parity screenshots,
  production publication, and retirement of the old Projects page to the batch
  integration checkpoint.
- Do not add mock projects, page-local API contracts, or an unpersisted
  project-favorites feature.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/hooks/use-projects.ts` calling the
  membership-scoped `GET /api/projects` implementation in
  `frontend/src/app/api/projects/route.ts`.
- Existing create owner: `frontend/src/app/(main)/create-project/page.tsx`,
  backed by authenticated `POST /api/projects`.
- Existing detail owner: `frontend/src/app/(main)/[projectId]/home/page.tsx`.
- Existing shared primitives/services: `frontend/src/components/ui/button.tsx`,
  `frontend/src/components/ui/input.tsx`, and `frontend/src/lib/utils.ts`.
- Deprecated or parallel paths: the current
  `frontend/src/app/(tables)/projects/page.tsx` remains intact until the new
  template passes the batch parity and release gate.

Delivery lane: Standard

Verification contract: Optional

## Plane Source Mapping

The replacement starts from Plane revision
`39856932cd6b9bd17eab0920506d628190b47af2` and directly adapts these
AGPL-3.0-only templates:

- `apps/web/core/components/projects/page.tsx`
- `apps/web/core/components/projects/mobile-header.tsx`
- `apps/web/core/components/project/root.tsx`
- `apps/web/core/components/project/header.tsx`
- `apps/web/core/components/project/search-projects.tsx`
- `apps/web/core/components/project/filters.tsx`
- `apps/web/core/components/project/card-list.tsx`
- `apps/web/core/components/project/card.tsx`
- `apps/web/core/components/project/empty-state.tsx`

Copied and adapted feature files retain Plane copyright and SPDX headers. The
repository's source-offer entry point is `/auth/source`, backed by
`/api/source-info` and `LICENSES/NOTICE-PLANE.md`. The shared notice must add
this mapping during route integration because it is outside this slice's path
ownership.

## Reuse Gate

- Canonical project query owner inspected: `useProjects`.
- Canonical create and detail routes inspected and reused by URL.
- Existing `favorites-context.tsx` persists generic navigation favorites only
  in browser local storage. No Supabase-backed project-favorite owner exists,
  so Plane's project-star mutation is intentionally omitted.
- Exact incompatibility with Plane's MobX stores: Alleato owns project
  visibility, authentication, and mutation guardrails in `/api/projects`.
  The template adapts Plane's composition to that existing hook/API boundary
  instead of copying Plane's store layer.

## Attention Brief

- Primary user: an authenticated Alleato workspace member selecting a project.
- Primary job: find, open, or create a project quickly.
- Primary decision: which live project to enter.
- Tier 1 content: project name/number, state or phase, archived status, search,
  status filter, view switch, and one Create Project action.
- Hidden until requested: advanced portfolio metrics, financial summaries,
  member management, settings, and destructive project actions.
- Removal candidates: duplicate counts, stat cards, onboarding helpers,
  decorative badges, and a non-persisted favorites control.
- Failure loudly: the surface displays the canonical API error and a Retry
  action; it never silently converts a failed request into an empty portfolio.

## Acceptance Criteria

- [x] The surface reads only real membership-scoped projects through
  `useProjects`.
- [x] Search, status filter, sort, grid, and list modes operate on fetched data.
- [x] Create and detail links use the canonical Alleato routes.
- [x] Loading, no-project, no-match, and API-error states are distinct.
- [x] The layout is constructed mobile-first without fixed page width or
  horizontal page overflow.
- [x] No project favorites control is shown without a real persisted owner.
- [x] Plane provenance and the deferred shared source-notice update are explicit.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, provider, authentication, permission, or delivery contracts are
  reused rather than changed in this slice.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] Batch route integration and authenticated desktop/mobile parity proof are
  recorded by the parent release checkpoint.
- [x] Construction evidence is recorded.
- [ ] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are locally committed; publication is intentionally
  deferred to parent integration.

## Failure-Loudly Contract

- Cause surfaced as: the canonical `useProjects` error message in a visible
  `role="alert"` state.
- Detection path: focused model/source tests plus the batch authenticated route
  walkthrough.
- Recovery path: Retry invokes `useProjects.refetch`; authentication failures
  continue through the existing API/client auth handling.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, reuse gate, Plane source mapping, and batch-verification boundary captured before product edits. |
| Model and provenance unit tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath src/features/plane-projects/__tests__/plane-projects-model.test.ts src/features/plane-projects/__tests__/plane-projects-source.test.ts` | Pass | 2 suites, 6 tests. |
| Focused lint | `frontend/node_modules/.bin/eslint.cmd src/features/plane-projects/**/*.{ts,tsx}` from `frontend` | Pass with 7 warnings | No errors. Remaining warnings are the semantic record-card shape and Plane's exact 118px cover height / viewport-centered empty states; no nested cards or page wrapper card was introduced. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |

## Remaining Risk

- The template is not routable in this isolated slice. Parent integration owns
  the route/sidebar seam, shared `LICENSES/NOTICE-PLANE.md` mapping, authenticated
  Plane side-by-side screenshots, production verification, and old-route
  retirement decision.

## Final Status

- [x] All construction-slice checklist items are complete; batch integration
  and publication remain explicitly deferred.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names its owner and next action.
