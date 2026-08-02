# Task: Link Analytics Account KPIs to User Management

Status: Published with authenticated click proof deferred
Owner: Codex Sanalytics3
Created: 2026-07-31
Task ID: LOCAL-LINK-ANALYTICS-KPIS-TO-USER-MANAGEMENT
Linear Issue: Not requested
Related Handoff: N/A, single-session Standard task

## Objective

Make each prototype account-reference KPI open the canonical User Management page so the dashboard summarizes and the management surface owns account actions.

## Scope

- Add the canonical `/user-management` target to employee accounts, subcontractor accounts, and admins through the shared `KpiRow` link contract.
- Excluded: account filters, a new account table, user-management route changes, and live account data wiring.

## Source of Truth

- Canonical account-management route: `frontend/src/app/(admin)/user-management/page.tsx` at `/user-management`.
- Existing shared primitive: `KpiRow` and its `KpiBlock` `href` contract.
- Deprecated or parallel paths: no dashboard-local user-management list is introduced.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] Each of the three account KPI cards links to `/user-management`.
- [x] The shared KPI link contract, rather than a custom click handler, owns navigation.
- [ ] Authenticated browser proof confirms the destination after click.

## Implementation Checklist

- [x] Existing user-management route was located before editing.
- [x] Existing KpiRow link support was reused.
- [x] No local account-management UI was created.

## Integration and Verification

- [x] Focused lint and changed-file checks pass.
- [ ] Authenticated click proof is deferred because the available local auth state redirects to sign-in.

## Failure-Loudly Contract

- Cause surfaced as: the prototype remains visibly marked illustrative and uses the canonical management route for action.
- Detection path: focused lint verifies the shared link owner remains valid; browser proof will verify the destination when auth is available.
- Recovery path: restore authenticated admin browser state, click each metric card, and confirm `/user-management` loads.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: N/A
- Guardrail evidence: N/A

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Shared-owner inspection | `frontend/src/components/ds/kpi.tsx` | Pass | `KpiBlock` renders `href` as a Next `Link`. |
| Focused lint | `pnpm exec eslint src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No lint errors or warnings. |
| Design scan | `npx impeccable detect frontend/src/components/admin/user-adoption-analytics-prototype.tsx` | Pass | No findings returned. |
| Publication checks | `npm run codex:finish -- --session Sanalytics3 ...` | Pass | Changed-file quality gates passed; source was published to `origin/main` at `63e562dd764def35d8fdd5ec1b5238381f25b9f7`. |
| Authenticated click proof | N/A | Deferred | Existing local auth state redirects to login. |

## Remaining Risk

- Owner: browser authentication. Restore an admin test session and capture a click-through screenshot before treating this interaction as visually verified.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly N/A.
- [x] Deferred proof identifies an owner and next action.
