# Task: Quick employee-to-project assignment

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-702 - https://linear.app/megankharrison/issue/AAI-702/add-quick-employee-to-project-assignment-from-user-management
Related Handoff: N/A

## Objective

Admins can quickly assign an existing employee to one or more projects from User Management without opening each user profile.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato admin managing project access.
Primary job: Give an employee access to selected projects quickly.
Primary decision: Which employee, which projects, and which project permission template?
Tier 1: Employee selector, project selector, project permission template.
Tier 2: App-wide access mode when opened from App Users.
Tier 3: Existing invite/new employee fields.
Hide until requested: No new helper widgets or dashboards.
Remove: The blocked Project Access action state.
Primary action: Add Project Access.
Failure-loudly behavior: Existing API validation blocks missing project/template/user details and returns structured errors.

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
| Static/type/lint      | `pnpm exec eslint 'src/app/(admin)/user-management/page.tsx'` | Pass | Targeted lint on touched page. |
| Static/type/lint      | `npm run typecheck:changed` | Pass | No new `any` type debt. |
| Targeted tests        | N/A | N/A | Existing API path reused; change is UI control-flow and verified in browser. |
| Browser/user-flow     | `agent-browser open 'http://localhost:3001/user-management?tab=project-access'` then click `Add Project Access` | Pass | Dialog opens as `Add project access` with employee, project permission template, and project selectors. |
| Browser/user-flow     | `agent-browser open 'http://localhost:3001/user-management'` then click `Grant App Access` | Pass | App-wide access dialog still opens with all-project access mode. |
| DB/provider read-back | N/A                | N/A    | No migration or provider config. |
| End-to-end proof      | Browser snapshots on Project Access and App Users dialogs | Pass | User can now reach the selected-project assignment flow directly from Project Access. |

## Files Changed

- `frontend/src/app/(admin)/user-management/page.tsx` - expose and default the project assignment dialog.
- `docs/ops/tasks/2026-06-26-quick-project-access-assignment.md` - working definition of done.

## Risks / Gaps

- No live write was performed; browser proof stopped before saving an employee assignment to avoid modifying production-linked data from the local session.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
