# Task: User Management Role Access

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-29
Linear Issue: Not created - exposed Linear connector only has comment tools in this session.
Related Handoff: N/A

## Objective

Make User Management available to app admins and to users whose role/title is
Senior Project Manager, Project Manager, or Superintendent, without creating a
sidebar-only permission mismatch.

Unauthorized pages must be hidden from the Company sidebar navigation, not shown
as disabled or greyed-out links.

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
- [x] Source adapters or external dependencies return typed, inspectable results.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `./node_modules/.bin/eslint src/components/nav/app-sidebar.tsx src/lib/navigation-config.ts src/lib/auth/user-management-access.ts src/lib/auth/user-management-access.shared.ts src/lib/__tests__/navigation-config.unit.test.ts` | Pass | Focused lint for sidebar, nav config, access helper, and regression tests. |
| Static/type/lint      | `npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted tests        | `npm run test:unit -- --runInBand --runTestsByPath src/lib/__tests__/navigation-config.unit.test.ts` | Pass | 27 passed, including User Management leadership-role visibility and unrelated-role hiding guardrails. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/ && agent-browser snapshot -i` | Blocked | Browser redirected to `/auth/login?callbackUrl=%2F`; authenticated role-specific proof still needed. |
| DB/provider read-back | N/A                | N/A    | No database, provider, env, or migration changes. |
| End-to-end proof      | `curl -I --max-time 10 http://localhost:3001/user-management` | Partial | Returned `307` to `/auth/login?callbackUrl=%2Fuser-management`, proving route auth is active but not role-specific access. |

## Files Changed

- `docs/ops/tasks/2026-06-29-user-management-role-access.md` - Task done gate and evidence ledger.
- `frontend/src/lib/auth/user-management-access.shared.ts` - Shared client/server role/title access policy.
- `frontend/src/lib/auth/user-management-access.ts` - Server-side API guard for User Management access.
- `frontend/src/lib/navigation-config.ts` - Navigation filtering support for role/title based access.
- `frontend/src/components/nav/app-sidebar.tsx` - Company nav passes current profile role/title into the shared filter and hides unauthorized company tools.
- `frontend/src/components/header/site-header.tsx` - Header/overlay navigation renders permission-filtered tools instead of disabled unauthorized links.
- `frontend/src/components/header/header-mobile-menu.tsx` - Mobile header navigation renders permission-filtered tools instead of disabled unauthorized links.
- `frontend/src/app/api/permissions/**` - User Management API guards use the shared access helper.
- `frontend/src/lib/__tests__/navigation-config.unit.test.ts` - Regression coverage for role-enabled User Management nav access.

## Risks / Gaps

- Existing unrelated dirty files are present in the checkout and must not be staged accidentally.
- Browser and end-to-end proof are blocked by the current unauthenticated in-app browser session.
- Next owner action: sign in as an admin, Senior Project Manager, Project Manager, or Superintendent and verify `User Management` appears under Company and `/user-management` loads.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
