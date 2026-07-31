# Task: Plane-Derived Change Events Replacement Surface

Status: Ready for Integration
Owner: S20260731-PLANE-CHANGE-EVENTS
Created: 2026-07-31
Task ID: AAI-PLANE-CHANGE-EVENTS
Linear Issue: Parent Plane migration program owns external tracking.
Related Handoff: Parent Plane integration task

## Objective

Deliver a new Plane-derived Change Events work surface that reads and mutates
the real Alleato change-management workflow through its existing hooks, APIs,
permissions, forms, and detail routes.

## Scope

- New `frontend/src/features/plane-change-events/**` feature.
- Focused model, source-attribution, and template tests.
- Route wiring to `/[projectId]/plane/change-events` is an integration
  follow-up because the shared dispatcher and surface registry have a separate
  active owner.
- No edits to shared Plane dispatcher, access, workspace-shell, or work-items
  files.
- No API, schema, database, permission, or production changes.

## Source of Truth

- Canonical frontend data owner:
  `frontend/src/hooks/use-change-events.ts`
- Canonical list and inline-edit behavior:
  `frontend/src/app/(main)/[projectId]/change-events/page.tsx`
- Canonical API:
  `frontend/src/app/api/projects/[projectId]/change-events/route.ts`
  and `.../[changeEventId]/route.ts`
- Canonical validation:
  `frontend/src/app/api/projects/[projectId]/change-events/validation.ts`
- Canonical records: `public.change_events`
- Canonical create/detail routes:
  `/{projectId}/change-events/new` and
  `/{projectId}/change-events/{changeEventId}`
- Plane source revision:
  `39856932cd6b9bd17eab0920506d628190b47af2`

Delivery lane: Standard

Verification contract: Optional

## Workflow Map

```text
User action: Review, filter, inspect, edit permitted metadata, create, or soft-delete a change event
Frontend owner component: PlaneChangeEventsSurface
Shared primitive/component owner: Button, ExpandableSearch, Select, Sheet, AlertDialog, StatusBadge
Client state changed: search, data tab, selected event, pending field, delete confirmation
API route(s): GET/POST /api/projects/[projectId]/change-events; PATCH/DELETE .../[changeEventId]
Validation schema(s): changeEventQuerySchema, updateChangeEventSchema
Service/helper(s): useProjectChangeEvents, apiFetch
Supabase table(s): public.change_events
Live DB assumptions: project_id number; id UUID/string; number string; status follows canonical lifecycle
Side effects on render: read-only project-scoped API request
Bulk/import/template behavior: N/A
Expected success evidence: live rows render; PATCH/DELETE refetch the canonical project list
Expected failure behavior: visible load retry; specific mutation toast plus console owner context
```

## Attention Brief

```text
Primary user: Project manager or change-management lead
Primary job: Triage potential cost and scope changes and move the right record forward
Primary decision: Which change event needs review, what scope it affects, and its financial exposure
Tier 1: CE number, title, status, scope, cost ROM
Tier 2: Type, reason, origin, RFQ state
Tier 3: Description, linked PCO/commitment values, created date
Hide until requested: Full description, editable metadata, downstream link details, delete
Remove: KPI cards, analytics strips, helper panels, decorative badges, duplicate create actions
Primary action: Add Change Event
Failure-loudly behavior: Inline load error with Retry; mutation failures identify the action
```

## Plane Source Mapping

- `apps/web/core/components/issues/header.tsx`
- `apps/web/core/components/issues/issue-layouts/roots/project-layout-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/base-list-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/default.tsx`
- `apps/web/core/components/issues/issue-layouts/list/block.tsx`
- `apps/web/core/components/issues/issue-layouts/empty-states/project-issues.tsx`

## Acceptance Criteria

- [x] Real project Change Events load through `useProjectChangeEvents`.
- [x] Search and canonical All/Line Items/No Line Items/RFQs tabs work without
      a parallel API.
- [x] Row selection opens a Plane-style detail sheet.
- [x] Editable scope, type, reason, and origin delegate to the canonical PATCH
      route; approval-owned status stays read-only.
- [x] Create, full-detail, edit, and soft-delete actions delegate to canonical
      routes.
- [x] Loading, empty, and error states are explicit.
- [x] Mobile layout prioritizes title/status/scope and does not overflow.
- [x] AGPL attribution and exact Plane source mapping are preserved.

## Implementation Checklist

- [x] Canonical route, hook, schema, mutation, and record types inspected.
- [x] Exact Plane source templates inspected at the pinned revision.
- [x] Files/modules to change are listed before edits.
- [x] New surface and focused tests are implemented.
- [x] Shared dispatcher integration is documented without overlapping
      ownership.

## Integration and Verification

- [x] Focused tests pass.
- [x] Targeted lint passes.
- [x] Patch integrity passes.
- [x] Local commit is recorded.
- [ ] Dispatcher integration, authenticated browser proof, and publication are
      completed at the batched release checkpoint.

## Failure-Loudly Contract

- Cause surfaced as: `Change events could not load` plus canonical error detail.
- Detection path: feature error state and focused tests.
- Recovery path: Retry the list; mutation errors identify the failed field or
  delete action and leave the record selected.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A; this is a replacement-template feature, not a bug repair.
- Detection gap: N/A
- Prevention: Pinned source mapping and focused model/template tests prevent
  visual and data-owner drift.
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, source, workflow, and attention gates captured before product edits. |
| Focused unit tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath src/features/plane-change-events/plane-change-events-model.unit.test.ts src/features/plane-change-events/plane-change-events-source.unit.test.ts src/features/plane-change-events/plane-change-events-template.unit.test.tsx` | Pass | 3 suites, 6 tests. |
| Targeted lint | `frontend/node_modules/.bin/eslint.cmd "src/features/plane-change-events/**/*.{ts,tsx}"` | Pass | Zero warnings and zero errors. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |
| AGPL source offer | `LICENSES/NOTICE-PLANE.md`, `/auth/source`, `/api/source-info` | Pass | Existing corresponding-source path is present; feature pins exact Plane revision and source files. |
| Local commit | `Add Plane-derived Change Events surface` | Pass | Feature slice committed locally; not published. |

## Remaining Risk

- Shared route registration is deferred until
  `S20260731-PLANE-SUBMITTALS` releases the dispatcher/access ownership scope.
- Browser parity and live mutation proof remain part of the batched release
  checkpoint.

## Final Status

- [x] All feature-slice checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred dispatcher integration names its current owner and next action.
