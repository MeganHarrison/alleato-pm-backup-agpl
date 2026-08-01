# Task: Employee Analytics Prototype Refinement

Status: Published with authenticated visual proof deferred
Owner: Codex Sanalytics2
Created: 2026-07-31
Task ID: LOCAL-EMPLOYEE-ANALYTICS-PROTOTYPE-REFINEMENT
Linear Issue: Not requested
Related Handoff: N/A, single-session Standard task

## Objective

Refocus the analytics prototype on employee accountability by replacing dropout-oriented language with recent activity and adding the requested shared account-reference KPI cards.

## Scope

- Replace the `Needs attention now` section with a recent employee activity list and activity-context preview.
- Add the canonical design-system KPI row for employee accounts, subcontractor accounts, and admins.
- Excluded: live analytics data, telemetry collection, the existing `/analytics` runtime owner, and account permission changes.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/analytics/page.tsx` and `frontend/src/app/api/admin/analytics/route.ts`.
- Existing shared primitives/services: `KpiRow`, `PageShell`, `SectionRuleHeading`, `Button`, `SidePanel`, and `DetailField`.
- Deprecated or parallel paths: the illustrative prototype does not replace production analytics.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Recent activity replaces all dropout and intervention language in the visible prototype.
- [x] The reference row uses the shared `KpiRow` owner for employee, subcontractor, and admin account counts.
- [x] Activity rows open a focused shared side panel with time and record context.
- [x] Account counts remain clearly labeled illustrative data until a governed account query is wired.
- [ ] Authenticated desktop and mobile screenshots prove the rendered refined route.

## Implementation Checklist

- [x] Changed component and task record were claimed before editing.
- [x] Existing design-system KPI and side-panel primitives are reused.
- [x] The KPI row is explicitly authorized by the user for this monitoring surface.
- [x] The prototype still identifies illustrative data and tracking requirements.

## Integration and Verification

- [x] Focused ESLint passes.
- [x] The no-new-Eslint-debt and unsafe-pattern checks passed during scoped publication.
- [ ] Authenticated visual proof remains deferred: the previous local login attempt returned to the sign-in route, so no invalid login screenshot is counted as evidence.

## Failure-Loudly Contract

- Cause surfaced as: `Prototype, illustrative data` and its tracking-notes disclosure remain visible.
- Detection path: the disclosure requires identity, organization, role, workflow event, and timestamp before production reporting can be trusted.
- Recovery path: wire a governed telemetry projection and expose unknown account classifications as unassigned rather than silently assigning them.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused lint | `pnpm exec eslint src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No lint errors or warnings. |
| Design scan | `npx impeccable detect frontend/src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No findings returned. The installed CLI does not expose the skill's direct `noise-gate` command. |
| Publication checks | `npm run codex:finish -- --session Sanalytics2 ...` | Pass | Changed-file quality gates passed and source was published to `origin/main` at `62abb28618f9fc7262b9b06f6148419603829afa`. |
| Authenticated route proof | Existing local route check | Deferred | Auth remains at `/auth/login`; no claimed screenshot. |

## Remaining Risk

- Owner: analytics instrumentation. All account and activity values are illustrative until backed by a governed account and event projection.
- Owner: browser authentication. Restore an authenticated admin test session, then capture desktop and 375px screenshots of `/analytics/user-adoption-prototype`.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred visual proof names a cause, detection gap, prevention step, owner, and next action.
