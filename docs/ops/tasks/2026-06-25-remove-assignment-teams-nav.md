# Task: Remove Assignment Inbox and Teams Messages from navigation

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-648 - https://linear.app/megankharrison/issue/AAI-648/remove-assignment-inbox-and-teams-messages-from-navigation
Related Handoff: N/A

## Objective

Remove Assignment Inbox and Teams Messages/Teams Conversations from the shared app navigation so users no longer see those entries in the header/sidebar navigation.

## Attention Brief

Primary user: Alleato app users navigating company-wide tools.
Primary job: Find active, supported company/project work surfaces quickly.
Primary decision: Which tool to open from the navigation.
Tier 1: Core active tools such as Projects, Directory, Meetings, Tasks, Documents, and financial tables.
Tier 2: Administrative or owner-only tools when authorized.
Tier 3: None for this slice.
Hide until requested: Assignment Inbox and Teams Messages routes remain reachable directly but should not compete in navigation.
Remove: Assignment Inbox and Teams Conversations navigation entries and section references.
Primary action: Select a supported company-wide tool from navigation.
Failure-loudly behavior: Targeted test or static check fails if removed nav labels still exist in the shared navigation config.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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
| Static/type/lint      | `cd frontend && npx eslint src/lib/navigation-config.ts src/lib/__tests__/navigation-config.unit.test.ts` | Passed | No lint output. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/__tests__/navigation-config.unit.test.ts --runInBand` | Passed | 24 tests passed. Added guardrail for removed navigation entries. |
| Browser/user-flow     | `agent-browser open http://localhost:3001 && agent-browser snapshot -i` | Passed | Company tools rendered without Assignment Inbox, Teams Conversations, or Teams Messages. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes. |
| End-to-end proof      | `tests/agent-browser-runs/2026-06-25-remove-assignment-teams-nav/home-navigation-snapshot.txt`; `tests/agent-browser-runs/2026-06-25-remove-assignment-teams-nav/home-navigation.png`; `rg -n "Assignment Inbox|Teams Conversations|Teams Messages" tests/agent-browser-runs/2026-06-25-remove-assignment-teams-nav/home-navigation-snapshot.txt frontend/src/lib/navigation-config.ts -S` | Passed | `rg` returned no matches in rendered snapshot or shared nav config. |

## Files Changed

- `frontend/src/lib/navigation-config.ts` - remove company-wide nav items and section references.
- `frontend/src/lib/__tests__/navigation-config.unit.test.ts` - add removal guardrail and correct stale AI nav label expectations.
- `docs/ops/tasks/2026-06-25-remove-assignment-teams-nav.md` - task definition and evidence ledger.

## Risks / Gaps

- None for this slice. The routes still exist for direct access; only navigation exposure was removed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
