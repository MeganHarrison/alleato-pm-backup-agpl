# Task: Plane-Derived RFIs Replacement Surface

Status: Ready for Integration
Owner: S20260731-PLANE-RFIS
Created: 2026-07-31
Task ID: AAI-PLANE-RFIS
Linear Issue: Parent Plane migration program owns external tracking.
Related Handoff: Parent Plane integration task

## Objective

Deliver a new Plane-derived RFIs work surface that reads and mutates the real
Alleato RFI workflow through its existing hooks, APIs, permissions, forms, and
detail routes.

## Scope

- New `frontend/src/features/plane-rfis/**` feature.
- Focused model, source-attribution, and template tests.
- Route wiring to `/[projectId]/plane/rfis` is an integration follow-up because
  the shared dispatcher and surface registry are currently owned by
  `S20260731-PLANE-SUBMITTALS`.
- No edits to `plane-workspace-shell.tsx` or `plane-work-items-page.tsx`.
- No API, schema, database, permission, or production changes.

## Source of Truth

- Canonical frontend data and mutations: `frontend/src/hooks/use-rfis.ts`
- Canonical API: `frontend/src/app/api/projects/[projectId]/rfis/route.ts`
- Canonical validation: `frontend/src/lib/schemas/rfi-schema.ts`
- Canonical records: `public.rfis`
- Canonical create/detail routes:
  `/{projectId}/rfis/new` and `/{projectId}/rfis/{rfiId}`
- Plane source revision:
  `39856932cd6b9bd17eab0920506d628190b47af2`

Delivery lane: Standard

Verification contract: Optional

## Workflow Map

```text
User action: Review, filter, open, change status, create, or delete an RFI
Frontend owner component: PlaneRfisSurface
Shared primitive/component owner: Button, Input, Select, Sheet, AlertDialog
Client state changed: search, status filter, selected RFI
API route(s): GET/POST /api/projects/[projectId]/rfis; PATCH/DELETE .../rfis/[rfiId]
Validation schema(s): rfiDraftSchema, rfiOpenSchema, rfiEditSchema
Service/helper(s): useRfis, useUpdateRfi, useDeleteRfi
Supabase table(s): public.rfis
Live DB assumptions: project_id number; id UUID; status string; number integer
Side effects on render: read-only React Query GET
Bulk/import/template behavior: N/A
Expected success evidence: live rows render; canonical mutations invalidate RFI queries
Expected failure behavior: visible retry state; canonical mutation errors remain specific
```

## Attention Brief

```text
Primary user: Project manager or superintendent
Primary job: Triage project questions and keep responsibility moving
Primary decision: Which RFI needs action, from whom, and by when
Tier 1: Subject, status, due date, ball in court
Tier 2: Assignees and RFI manager
Tier 3: Question and record metadata in the detail sheet
Hide until requested: Full question, location, impacts, references, delete
Remove: KPI cards, analytics, helper panels, duplicate create actions
Primary action: Add RFI
Failure-loudly behavior: Inline load error with a Retry action
```

## Plane Source Mapping

- `apps/web/core/components/issues/header.tsx`
- `apps/web/core/components/issues/issue-layouts/roots/project-layout-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/base-list-root.tsx`
- `apps/web/core/components/issues/issue-layouts/list/default.tsx`
- `apps/web/core/components/issues/issue-layouts/list/block.tsx`
- `apps/web/core/components/issues/issue-layouts/empty-states/project-issues.tsx`

## Acceptance Criteria

- [x] Real project RFIs load through `useRfis`.
- [x] Search and All/Open/Closed filters operate without a parallel API.
- [x] Row selection opens a Plane-style detail sheet.
- [x] Status, create, full-detail, and delete actions delegate to canonical owners.
- [x] Loading, empty, and error states are explicit.
- [x] Mobile layout prioritizes subject/status and does not overflow.
- [x] AGPL attribution and exact Plane source mapping are preserved.

## Implementation Checklist

- [x] Canonical route, hooks, schemas, and record types inspected before edits.
- [x] Exact Plane source templates inspected at the pinned revision.
- [x] Files/modules to change are listed before edits.
- [x] New surface and focused tests are implemented.
- [x] Shared dispatcher integration is documented without overlapping ownership.

## Integration and Verification

- [x] Focused tests pass.
- [x] Targeted lint passes.
- [x] Patch integrity passes.
- [x] Local commit is recorded.
- [ ] Dispatcher integration, authenticated browser proof, and publication are
      completed at the release checkpoint.

## Failure-Loudly Contract

- Cause surfaced as: `RFIs could not load` plus the canonical error detail.
- Detection path: feature error state and focused tests.
- Recovery path: Retry the query; mutation failures use the existing RFI form
  error owner.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A; this is a replacement-template feature, not a bug repair.
- Detection gap: N/A
- Prevention: Source mapping and focused model/template tests prevent visual
  ownership drift.
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, source, workflow, and attention gates captured before product edits. |
| Focused unit tests | `npm --prefix frontend run test:unit -- --runInBand --runTestsByPath src/features/plane-rfis/plane-rfis-model.unit.test.ts src/features/plane-rfis/plane-rfis-source.unit.test.ts src/features/plane-rfis/plane-rfis-template.unit.test.tsx` | Pass | 3 suites, 6 tests. |
| Targeted lint | `frontend/node_modules/.bin/eslint.cmd "src/features/plane-rfis/**/*.{ts,tsx}"` | Pass | Zero warnings and zero errors. |
| Patch integrity | `git diff --check` | Pass | No whitespace errors. |
| Local commit | `Add Plane-derived RFIs work surface` | Pass | Feature slice committed locally; not published. |

## Remaining Risk

- Shared route registration cannot be committed until the Submittals workspace
  releases `plane-surface-dispatcher.tsx`, `plane-surface-access.ts`, and its
  unit test.
- Browser parity and live mutation proof remain part of the batched release
  checkpoint.

## Final Status

- [x] All feature-slice checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred dispatcher integration names `S20260731-PLANE-SUBMITTALS`;
      next action is to register `/[projectId]/plane/rfis` after that workspace
      releases the shared dispatcher and access files.
