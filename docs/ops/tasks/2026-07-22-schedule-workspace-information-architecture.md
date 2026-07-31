# Task: Split schedule workspace from planning reports

Status: Superseded after a concurrent overwrite; see forensic correction below
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1192 follow-on
Linear Issue: [AAI-1192](https://linear.app/megankharrison/issue/AAI-1192/deliver-construction-lookaheads-and-schedule-reporting)
Related Handoff: N/A, single-session scoped change

## Objective

The primary Schedule route is an uncluttered live Gantt workspace. Revision history, baselines, lookaheads, risks, and published trade activity live on a separate Schedule planning route.

## Scope

- Delivery lane: Standard.
- Owned surface: `/<projectId>/schedule` and `/<projectId>/schedule/planning`.
- Reuse existing scheduling controls and reports; do not change their data or authorization contracts.
- Excludes changes to revision, baseline, lookahead, risk, and trade APIs.

## Source of Truth

- Canonical live workspace: `frontend/src/app/(main)/[projectId]/schedule/page.tsx`.
- Shared planning modules: `frontend/src/components/scheduling/schedule-revision-controls.tsx`, `schedule-lookahead.tsx`, `schedule-risk-summary.tsx`, and `trade-schedule-activities.tsx`.
- Existing routing primitive: Next.js project-scoped `[projectId]` route.

Verification contract: Required

## Acceptance Criteria

- [x] `/schedule` presents the task views and editing controls without revision, lookahead, risk, or trade-report sections above them.
- [x] `/schedule/planning` is the canonical home for revision, baseline, lookahead, risk, and trade-report surfaces.
- [x] Navigation between the focused workspace and Planning is explicit.
- [x] The existing published-revision and authorization behavior is retained.

## TDD Contract

- [x] Red: the planning workspace has a focused rendering contract for its four existing planning modules.
- [x] Green: the contract passes after the shared planning workspace is introduced.

## Implementation Checklist

- [x] Confirm the primary Schedule page mixed two incompatible jobs in the rendered browser surface.
- [x] Reuse the existing report modules in a shared planning workspace rather than duplicate their API/data logic.
- [x] Add a project-scoped Planning route and existing page-tab navigation.
- [x] Remove planning/reporting modules from the primary Gantt rendering path.

## Failure-Loudly Contract

- Cause surfaced as: existing module-specific API errors remain visible on Planning.
- Detection path: targeted component test, route check, and authenticated browser evidence on both routes.
- Recovery path: Schedule retains the work surface; Planning exposes the existing retry/error states rather than hiding failed reports.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Design diagnosis | User-supplied Schedule screenshot | Pass | The primary Gantt was displaced by planning/reporting modules. |
| Task setup | This task file | Pass | Route ownership and the TDD contract were recorded before edits. |
| TDD red | `pnpm --dir frontend exec jest src/components/scheduling/__tests__/schedule-planning-workspace.test.tsx --runInBand` | Pass | Before the new owner existed, Jest failed with `Cannot find module '../schedule-planning-workspace'`. |
| TDD green | Same focused Jest command | Pass | The planning workspace contract passes after the shared owner was added. |
| Route guard | `npm run check:routes` | Pass | The nested `[projectId]/schedule/planning` route has no conflict. |
| Design guard | `node .agents/skills/impeccable/scripts/alleato/audit-surface-complexity.mjs ...` | Pass | Both changed UI owners passed the surface complexity audit. |
| Focused regression suite | 5 Jest suites / 8 tests | Pass | Planning, revision controls, lookahead, risk, and trade surfaces passed together. |
| TypeScript | `pnpm --dir frontend exec tsc --noEmit` | Pass | No type errors. |
| Browser proof | `tests/agent-browser-runs/2026-07-22-schedule-workspace-information-architecture/{schedule-workspace-loaded-local,schedule-planning-local,schedule-workspace-mobile-local,schedule-planning-mobile-local}.png` | Pass | Authenticated local browser session opened Schedule, selected Planning, and returned to Schedule. The primary workspace contains only Gantt controls and tasks; Planning contains revision, lookahead, and risk surfaces. Runtime evidence is intentionally not committed. |

## Remaining Risk

- Production deployment for `e62efe03c3a1a5a0f706f0150c69e435e17966f9` is queued in Vercel. Local authenticated browser proof is complete; production alias proof remains deployment-pipeline work.

## Final Status

- [ ] The route split is not present in the current runtime; a later commit overwrote the owner prop and made `/schedule/planning` a duplicate of `/schedule`.
- [x] Evidence is filled in.
- [x] The original task-owned source and task documentation were published to `origin/main`; browser evidence remains in the canonical ignored runtime sink.

## Forensic correction — 2026-07-22

- `e62efe03c` introduced the planning route by passing `workspace="planning"` into the canonical Schedule page.
- `ce83e5510` later replaced that page owner with a version that no longer accepted or read the `workspace` prop while adding resource-capacity work.
- The result was a duplicate route, an orphaned `SchedulePlanningWorkspace`, and a completion record that no longer described production source. The planning route never reached a Ready production deployment because it was also the first change to cross Vercel's generated-route ceiling.
- The durable repair keeps the planning/report modules on the existing canonical `/schedule` owner and deletes the duplicate route and orphan component. Any future split must first establish a shared owner contract that concurrent changes cannot silently replace.
