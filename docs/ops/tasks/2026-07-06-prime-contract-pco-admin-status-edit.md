# Task: Admin prime-contract PCO status edit

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-975 - https://linear.app/megankharrison/issue/AAI-975/admins-can-edit-prime-contract-pco-status-from-detail-page
Related Handoff: Not created yet

## Objective

Allow project admins to edit an active prime-contract potential change order, including changing its status, from the canonical detail workflow.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `./node_modules/.bin/eslint 'src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx' 'src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/prime-contract-pco-header-actions.tsx' 'src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/__tests__/prime-contract-pco-header-actions.test.tsx'` | Pass | No ESLint findings on touched UI files. |
| Targeted tests        | `./node_modules/.bin/jest --runTestsByPath 'src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/__tests__/prime-contract-pco-header-actions.test.tsx' 'src/app/api/projects/[projectId]/prime-contract-pcos/[pcoId]/__tests__/route.test.ts' --runInBand` | Pass | Confirms the detail header exposes a visible Edit action and PATCH still allows active PCO status edits while void PCOs stay immutable. |
| Browser/user-flow     | `agent-browser --session-name alleato-test-3001 open 'http://localhost:3001/876/prime-contracts/6d90f64a-d9e2-4cb7-9aee-389dda0c9f4f/change-orders/pcos/04e484af-457e-4e39-ad59-8515da5e3dde' && agent-browser snapshot -i` | Blocked | Localhost session redirected to `/auth/login`; manual sign-in attempt stayed on the login form in `Signing in...`, so the exact route could not be re-snapshotted after the UI patch from this automation session. |
| DB/provider read-back | N/A                | N/A    | No migration or provider config change expected. |
| End-to-end proof      | Same as browser/user-flow | Blocked | Exact requested route could not be exercised because production auth state is expired/stale in this session. |

## Files Changed

- `docs/ops/tasks/2026-07-06-prime-contract-pco-admin-status-edit.md` - task ledger
- `frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/page.tsx` - add an explicit header-level edit entry point for the canonical PCO detail route
- `frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/prime-contract-pco-header-actions.tsx` - isolate visible detail actions for edit/promote/overflow behavior
- `frontend/src/app/(main)/[projectId]/prime-contract-pcos/[pcoId]/__tests__/prime-contract-pco-header-actions.test.tsx` - regression coverage for visible edit affordance on editable PCOs
- `frontend/src/app/api/projects/[projectId]/prime-contract-pcos/[pcoId]/route.ts` - align prime-contract PCO detail mutations with verified project access and explicit permissions
- `frontend/src/app/api/projects/[projectId]/prime-contract-pcos/[pcoId]/__tests__/route.test.ts` - regression coverage for admin status edits and void immutability

## Risks / Gaps

- Browser verification is still incomplete because the localhost sign-in flow did not return control to the PCO route in the automation session.
- The route now uses verified project access plus explicit `change_orders:write/admin` enforcement; if the intended business rule is admin-only mutation rather than write-level mutation, the PATCH permission level should be tightened in a follow-up after confirming the role matrix.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
