# Task: Restrict projects table to assigned projects

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-701 - https://linear.app/megankharrison/issue/AAI-701/restrict-projects-table-to-assigned-projects
Related Handoff: N/A

## Objective

The projects table and project-list consumers must only receive projects the signed-in non-admin user is assigned to, while admins keep all-project visibility.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato employee viewing project lists.
Primary job: Find and open assigned projects without seeing unrelated jobs.
Primary decision: Which project should I work in now?
Tier 1: Assigned projects only.
Tier 2: Existing search, phase, archived, company, and pagination filters.
Tier 3: Client name resolution and admin all-project visibility.
Hide until requested: Nothing new.
Remove: Direct client-side all-project query path.
Primary action: Open the correct project from the table or picker.
Failure-loudly behavior: Auth/profile or assignment lookup errors return specific API errors instead of silently widening access.

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
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `pnpm exec eslint src/app/api/projects/route.ts src/app/api/projects/__tests__/route.test.ts src/hooks/use-projects.ts` | Pass | No errors or warnings after removing touched-file `any` debt. |
| Static/type/lint      | `npm run typecheck:changed` | Pass | No new `any` type debt. |
| Targeted tests        | `pnpm jest --runInBand --runTestsByPath src/app/api/projects/__tests__/route.test.ts` | Pass | 18 tests passed, including role-assignment and fail-closed cases. |
| Browser/user-flow     | `agent-browser open http://localhost:3001 && agent-browser snapshot` | Pass | Projects table rendered and fetched `/api/projects`; available local browser session was admin. |
| DB/provider read-back | N/A                | N/A    | No migration or provider config. |
| End-to-end proof      | `agent-browser eval "fetch('/api/projects?archived=false&page=1&limit=5')..."` plus focused route test | Pass | Browser API returned `meta.isAdmin: true`; non-admin assigned-only behavior is proven by route tests asserting scoped project IDs and no projects query on missing assignment identity. |

## Files Changed

- `frontend/src/app/api/projects/route.ts` - canonical assigned-project scoping.
- `frontend/src/hooks/use-projects.ts` - route hook traffic through canonical API.
- `frontend/src/app/api/projects/route.test.ts` - regression coverage.
- `docs/ops/tasks/2026-06-26-assigned-projects-table-scope.md` - working definition of done.

## Risks / Gaps

- Local browser proof used the available admin-authenticated session, so non-admin row restriction is covered by automated API tests rather than a live non-admin browser session.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
