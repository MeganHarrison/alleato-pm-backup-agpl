# Task: User detail project access editing

Status: In Progress
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-712 - https://linear.app/megankharrison/issue/AAI-712/make-user-detail-project-access-editable
Related Handoff: N/A

## Objective

Admins can add and remove a person's project access directly from `/user-management/users/[personId]`.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Attention Brief

Primary user: Alleato admin editing one person's access.
Primary job: Add or remove that person from projects without leaving the detail page.
Primary decision: Which project should this person gain or lose, and which project permission template applies?
Tier 1: Project memberships, add project action, remove action.
Tier 2: Project permission template per membership.
Tier 3: Company access and granular exceptions.
Hide until requested: No dashboards, summaries, or extra helper panels.
Remove: Dead-end project membership display.
Primary action: Add project access.
Failure-loudly behavior: API returns structured validation or upstream failures for missing person, project, template, or write errors.

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
- [ ] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      |                    |        |       |
| Targeted tests        |                    |        |       |
| Browser/user-flow     |                    |        |       |
| DB/provider read-back | N/A                | N/A    | No migration or provider config. |
| End-to-end proof      |                    |        |       |

## Files Changed

- `frontend/src/app/api/permissions/users/[personId]/project-access/route.ts` - admin add/remove existing user project access.
- `frontend/src/app/(admin)/user-management/users/[personId]/page.tsx` - wire add/remove mutations and project options.
- `frontend/src/app/(admin)/user-management/_components/user-access-panel.tsx` - add UI controls for project access.
- `docs/ops/tasks/2026-06-26-user-detail-project-access-editing.md` - working definition of done.

## Risks / Gaps

- Live write verification should use a safe test person/project only.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
