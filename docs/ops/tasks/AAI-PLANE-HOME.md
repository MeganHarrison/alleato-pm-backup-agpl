# Task: Plane-derived Project Home replacement

Status: Ready for integration
Owner: S20260731-plane-home
Created: 2026-07-31
Task ID: AAI-PLANE-HOME
Linear Issue: Program tracked under AAI-1286; no dedicated sub-issue requested.
Related Handoff: N/A for this isolated Standard slice.

## Objective

Provide a Plane-derived Project Home template that reads live Alleato project,
task, meeting, and daily-log records and keeps the existing Home route intact
until shared-shell integration and parity verification.

## Scope

- Owned surface: `frontend/src/features/plane-home/**`
- Owned task record: `docs/ops/tasks/AAI-PLANE-HOME.md`
- Explicit exclusion: shared dispatcher, route, sidebar, access, and production
  wiring; retirement of the current Home page; database or API mutations.

## Source of Truth

- Canonical project owner: `GET /api/projects/[projectId]`
- Canonical task owner: `GET /api/tasks?project_id=<id>&scope=all`
- Canonical activity owner:
  `GET /api/projects/[projectId]/home/tab-data?kind=meetings|daily-logs`
- Existing shared services:
  `frontend/src/lib/api-client.ts`,
  `frontend/src/features/tasks/task-utils.ts`
- Plane visual source mapping:
  `frontend/src/features/plane-home/PLANE-SOURCE.md`
- Deprecated or parallel paths: current
  `frontend/src/app/(main)/[projectId]/home/**` remains intentionally untouched
  until the replacement is routed, visually verified, and released.

Delivery lane: Standard

Verification contract: Optional

## Attention Brief and Noise Gate

- Primary user: project manager.
- Primary job: see what needs attention and continue project work.
- Primary decision: which open task or recent source record to open next.
- Tier 1: actionable open project tasks.
- Tier 2: recent meeting and daily-log activity with canonical record links.
- Tier 3: compact project context.
- Hidden or removed: advanced metadata, configurable widgets, aggregate KPI
  tiles, Stickies, tutorials, helper panels, duplicate calls to action, and
  decorative empty-state art.
- Primary action: Add task, leading to the existing functional Plane work-item
  surface.
- Failure-loudly behavior: project failure blocks with the exact API message and
  retry; tasks and activity fail independently with named section errors and
  retry.

## Acceptance Criteria

- [x] New template loads only real project-scoped data from canonical APIs.
- [x] Open tasks and recent activity link to existing functional record owners.
- [x] No mock data or decorative KPI-card row is present.
- [x] Failure-loudly behavior is defined per data section.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Plane copyright, SPDX header, source mapping, and `/auth/source` path are
  preserved.
- [x] Legacy Home is explicitly deferred until replacement verification.

## Implementation Checklist

- [x] Files/modules to change were listed before edits.
- [x] Existing project, task, meeting, and daily-log APIs remain the data owners.
- [x] Errors are specific and actionable.
- [x] No database, provider, authentication, or permission contract was changed.

## Integration and Verification

- [x] Targeted static and unit checks pass.
- [ ] Shared Plane shell adds Home to its typed surface/navigation contract.
- [ ] Route integration supplies `projectId` and renders this feature.
- [ ] Desktop and mobile screenshots are compared side by side with Plane Home.
- [ ] Production deployment and source-offer readback are verified.
- [ ] Superseded Home route is retired only after the replacement is accepted.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: named project, task, meeting, or daily-log API error.
- Detection path: blocking Home alert or section-local alert/status message.
- Recovery path: Retry reloads only the affected owner, while canonical links
  let the user continue in the underlying tool.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope, reuse gate, and done gate captured before implementation. |
| Canonical owner inspection | Project, Tasks, Home tab-data routes | Pass | Existing guarded data owners reused with no API duplication. |
| Plane provenance | `frontend/src/features/plane-home/PLANE-SOURCE.md` | Pass | Exact upstream templates and Alleato modifications mapped. |
| Focused unit test | `npm run test:unit -- --runInBand --runTestsByPath src/features/plane-home/plane-home-model.unit.test.ts` | Pass | 3 tests cover actionable ordering, record links, and title fallback. |
| Focused lint | `npx eslint src/features/plane-home/plane-home-page.tsx src/features/plane-home/plane-home-data.ts src/features/plane-home/plane-home-model.ts src/features/plane-home/plane-home-model.unit.test.ts` | Pass | No errors or warnings. |
| Surface complexity audit | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs frontend/src/features/plane-home/plane-home-page.tsx` | Pass | No product-noise or container-budget violations. |
| Browser parity | Deferred to integration | Deferred | No route or shared-shell edits are owned by this slice. |

## Remaining Risk

- Integration owner must add `home` to the shared Plane surface/sidebar and
  dispatcher, route the feature, then capture desktop/mobile parity proof.
- `LICENSES/NOTICE-PLANE.md` should receive this feature mapping in the coherent
  integration commit; the feature-level mapping and source headers are already
  present.
- The activity API intentionally enforces separate Documents and Schedule
  permissions. Users lacking one permission see a partial-data warning rather
  than a silent omission.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names its owner and next action.
