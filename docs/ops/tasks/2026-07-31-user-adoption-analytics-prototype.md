# Task: User Adoption Analytics Prototype

Status: Published with authenticated visual proof deferred
Owner: Codex Sanalytics
Created: 2026-07-31
Task ID: LOCAL-USER-ANALYTICS-PROTOTYPE
Linear Issue: Not requested
Related Handoff: N/A, single-session Standard task

## Objective

Provide a reviewable admin prototype that makes user-adoption risk, core-workflow activation, and role-specific adoption visible without representing illustrative data as live product telemetry.

## Scope

- New `/analytics/user-adoption-prototype` route using the canonical admin `PageShell`.
- Interactive, illustrative adoption view with period selection, GSAP motion that honors reduced-motion settings, tracking-notes disclosure, and an actionable at-risk-user preview.
- Excluded: edits to the active `/analytics` owner, persistence, live data reads, telemetry schema, and organization-level attribution.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/(admin)/analytics/page.tsx` and `frontend/src/app/api/admin/analytics/route.ts`.
- Existing shared primitives/services: `PageShell`, `SectionRuleHeading`, `Button`, `Sheet`, and `DetailField`.
- Deprecated or parallel paths: the prototype does not replace the live analytics route and must not be treated as production analytics.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] User analytics prototype is available at `/analytics/user-adoption-prototype`.
- [x] The primary decision is explicit: which users need an intervention before usage stalls.
- [x] Illustrative data is labeled and instrumentation gaps have a direct disclosure path.
- [x] Reduced-motion preference disables GSAP transitions.
- [x] At-risk rows open a focused preview rather than implying a nonexistent record mutation.
- [ ] Authenticated desktop and mobile screenshots prove the rendered route.

## Implementation Checklist

- [x] Files/modules were scoped before edits.
- [x] The canonical `PageShell` and shared controls own layout and interaction behavior.
- [x] No dashboard-card grid, decorative panels, or raw detail fields were introduced.
- [x] Failure state is explicit: prototype data cannot be confused with live analytics.
- [x] Current task is isolated from concurrent edits to the live analytics owner.

## Integration and Verification

- [x] Focused ESLint passes.
- [x] Impeccable detector passes.
- [ ] Authenticated user-flow proof is deferred because the local saved session and environment-backed test login both return to the sign-in route.
- [x] No unrelated test failures were introduced by the focused checks.
- [x] Task-owned source is published to `origin/main` at `eb91df147c100f07d14e449864df888d236ef782`.

## Failure-Loudly Contract

- Cause surfaced as: `Prototype, illustrative data` is always visible; tracking notes explain required identity and event coverage.
- Detection path: the tracking-notes control shows the precise event attributes needed before conclusions are trusted.
- Recovery path: implement governed telemetry with user, organization, role, workflow event, and timestamp; present unassigned events separately rather than attributing them.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Focused lint | `pnpm exec eslint src/app/(admin)/analytics/user-adoption-prototype/page.tsx src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No lint errors or warnings. |
| Design scan | `npx impeccable detect src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | Installed CLI does not expose the skill's `noise-gate` command; detector returned success. |
| Local route access | `agent-browser --session-name user-analytics-prototype open http://localhost:3002/analytics/user-adoption-prototype` | Deferred | Redirects to `/auth/login`. Saved local state and environment-backed test credentials did not establish an authenticated admin session. |
| Desktop/mobile screenshot | N/A | Deferred | Login screen is not valid product-route proof. |
| Publication | `npm run codex:finish -- --session Sanalytics --allow-staged ...` | Pass | Published the three exact task-owned files to `origin/main` at `eb91df147c100f07d14e449864df888d236ef782`. |

## Remaining Risk

- Owner: analytics instrumentation. The values are intentionally illustrative until a governed event model includes user, organization, role, milestone, and timestamp.
- Owner: local authentication proof. Refresh or repair an authenticated admin test session, then capture desktop and 375px route screenshots before treating the prototype as visually approved.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred work names the cause, detection gap, prevention step, owner, and next action.
