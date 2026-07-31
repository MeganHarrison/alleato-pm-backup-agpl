# Task: Outlook draft feedback priority tabs

Status: Blocked/Deferred
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-770 - https://linear.app/megankharrison/issue/AAI-770/make-outlook-draft-feedback-panel-inline-editable
Related Handoff: N/A

## Objective

Add compact tabs directly under the `/outlook-draft-feedback` title row that filter the shared email dataset by the assistant priority assigned to each email.

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
- [ ] Artifacts link back to source evidence and run logs.
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
| Static/type/lint      | `cd frontend && npx eslint 'src/app/(main)/[projectId]/emails/emails-client.tsx' 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts' 'src/features/emails/project-emails-workspace.tsx' 'src/features/emails/mailbox-priority-tabs.ts'` | Pass with warnings | 0 errors. Existing design-system warnings remain in `frontend/src/features/emails/project-emails-workspace.tsx` for a raw `<button>`, raw date input, and raw search input; this slice did not add them. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath 'src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts' 'src/features/emails/__tests__/project-emails-workspace.test.tsx'` | Pass | 2 suites, 6 tests passed. Coverage guards invalid `priority` fallback, assistant-priority counts, and query-preserving tab href generation. |
| Browser/user-flow     | Not run in this turn | Blocked/Deferred | Exact protected-route proof still depends on a working owner/Brandon auth session for `localhost:3001`, which has been unstable in this workspace. |
| DB/provider read-back | Not applicable     | Pass | No schema, migration, or provider configuration change was required for a route-local filter-tab slice. |
| End-to-end proof      | Same as browser/user-flow | Blocked/Deferred | Cause: no trusted authenticated browser session was available in-turn for the protected route. Detection gap: route-level frontend changes can pass unit checks while exact-surface proof stays blocked behind stale auth. Prevention step: refresh a known-good local owner or Brandon auth fixture before closing the route change as fully verified. |

## Files Changed

- `docs/ops/tasks/2026-06-30-outlook-draft-feedback-priority-tabs.md` - task definition and evidence ledger.
- `frontend/src/app/(main)/[projectId]/emails/emails-client.tsx` - derive mailbox-priority tabs, sync `priority` URL state, and filter the shared email dataset.
- `frontend/src/app/(main)/[projectId]/emails/__tests__/emails-client.test.ts` - guard priority filter normalization, counts, and query-preserving tab links.
- `frontend/src/features/emails/mailbox-priority-tabs.ts` - shared pure helpers for mailbox priority filter tabs.
- `frontend/src/features/emails/project-emails-workspace.tsx` - render the compact tab row beneath the title in mail view.

## Risks / Gaps

- Browser verification may still be blocked by the current protected-route auth issue on `localhost:3001`.
- Existing `project-emails-workspace.tsx` design-system warnings remain unrelated repo debt unless this route gets a broader shared-shell cleanup.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
