# Task: Expose Scheduling Planning Features

Status: Complete
Owner: Codex (S019FAF5)
Created: 2026-07-29
Task ID: SCHED-UX-EXPOSURE
Linear Issue: Not created; this is a bounded continuation of the active user-owned scheduling task.
Related Handoff: `SCHEDULING-PROJECT-HANDOFF-2026-07-29.md`

## Objective

A schedule user can immediately discover and inspect resource load, cost and
earned value, leveling, revisions, and reporting without mistaking those
features for missing functionality.

## Scope

- Canonical project schedule workspace, shared planning navigation, resource
  availability disclosure, and their focused tests.
- No scheduling calculation, persistence, authorization, or database changes.

## Source of Truth

- Canonical runtime owner:
  `frontend/src/app/(main)/[projectId]/schedule/page.tsx`
- Shared owners:
  `frontend/src/components/scheduling/schedule-planning-workspace.tsx` and
  `frontend/src/components/scheduling/resource-availability-panel.tsx`
- Deprecated or parallel paths: N/A

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The default Schedule workspace clearly identifies where resources, costs,
  leveling, revisions, and reports live.
- [x] Opening the planning workspace exposes its resource/cost/leveling controls
  without another hidden disclosure step.
- [x] The no-published-revision state explains the exact activation sequence.
- [x] Requested behavior is observable end to end in production.
- [x] Failure-loudly behavior is defined.
- [x] Existing shared route, tabs, alert, and resource-panel primitives are reused.
- [x] Legacy or duplicate paths are not introduced.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared owners retain the cross-cutting behavior.
- [x] Empty states are specific and actionable.
- [x] Database, provider, authentication, and permission contracts are unchanged.

## Integration and Verification

- [x] A regression test failed with the planning disclosure collapsed.
- [x] The focused resource-panel suite passes 8/8.
- [x] Focused ESLint reports zero errors; two existing schedule-page warnings remain.
- [x] Navigation and no-revision focused tests pass.
- [x] Authenticated desktop and mobile production screenshots are recorded.
- [x] Task-owned files are published and production readback passes.

## Failure-Loudly Contract

- Cause surfaced as: an explicit setup notice when no published revision exists.
- Detection path: focused component tests plus authenticated production DOM and screenshots.
- Recovery path: open the named planning workspace, snapshot the schedule, open
  Revision history, request review, publish the revision, then add assignments
  and cost facts.

## Incident Learning

- Failure fingerprint: `design.page-composition-contract-drift`
- Root cause: Tier-one scheduling capabilities were placed behind a secondary
  workspace and then behind a second collapsed disclosure.
- Detection gap: Release verification proved each feature directly but did not
  assert discoverability from the default Schedule workspace.
- Prevention: Keep one canonical planning owner, name its full capability in
  navigation, open tier-one tools by default, and retain a production journey
  beginning on the default Schedule route.
- Guardrail evidence: focused disclosure test and final authenticated screenshots.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Runtime localization | Authenticated `/1144/schedule` and `?workspace=planning` DOM comparison | Failed before fix | Default route exposed none of the five capability groups; planning route contained them. |
| Focused regression | `pnpm.cmd --dir frontend exec jest --runInBand --runTestsByPath src/components/scheduling/__tests__/resource-availability-panel.test.tsx` | Passed | 8/8 after the red test proved the collapsed state. |
| Integrated focused suites | `pnpm.cmd --dir frontend exec jest --runInBand --runTestsByPath src/components/scheduling/__tests__/schedule-planning-workspace.test.tsx src/components/scheduling/__tests__/resource-availability-panel.test.tsx` | Passed | 2 suites, 13/13 tests. |
| Focused navigation lint | `pnpm.cmd --dir frontend exec eslint src/components/scheduling/schedule-planning-workspace.tsx src/components/scheduling/__tests__/schedule-planning-workspace.test.tsx` | Passed | Zero warnings or errors. |
| Focused lint | `node node_modules/eslint/bin/eslint.js ...` from `frontend` | Passed with warnings | Zero errors; two unrelated existing schedule-page warnings. |
| Production deployment | Vercel deployment `dpl_E3BBEzKWxYkJac5A2syM6hJBDtNR` from `809944fdc6c2` | Ready | `projects.alleatogroup.com` is assigned to the deployment. |
| Authenticated production readback | `/1144/schedule` to `?workspace=planning` | Passed | The capability-named tab is visible; the resource panel is expanded; cost, leveling, enterprise capacity, revisions, and revision-gated reports are discoverable. |
| Desktop screenshot | `docs/ops/tasks/2026-07-29-schedule-feature-exposure.desktop.png` | Passed | Current production revision, authenticated Nexcom planning workspace. |
| Mobile screenshot | `docs/ops/tasks/2026-07-29-schedule-feature-exposure.mobile.png` | Passed | Current production revision at a 390 by 844 viewport. |

## Remaining Risk

- None for this bounded feature-exposure correction.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] No deferred work remains in this task.
