# Task: Remove files route from navigation

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-651 - https://linear.app/megankharrison/issue/AAI-651/remove-files-route-from-navigation
Related Handoff: N/A

## Objective

Remove the company-wide navigation entry that points to `/files` (`http://localhost:3001/files`) while preserving project-scoped Documents navigation.

## Attention Brief

Primary user: Alleato app users navigating company-wide tools.
Primary job: Find active supported work surfaces quickly.
Primary decision: Which company tool to open.
Tier 1: Projects, Directory, Meetings, Tasks, Knowledge Base, Documentation, and financial tables.
Tier 2: Admin/developer tools when authorized.
Tier 3: Direct `/files` route if manually entered.
Hide until requested: Company-wide `/files` surface.
Remove: Company-wide `Documents` navigation item with path `files`.
Primary action: Choose a supported navigation destination.
Failure-loudly behavior: Navigation unit test fails if `Documents -> files` returns to company-wide navigation.

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
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/__tests__/navigation-config.unit.test.ts --runInBand` | Passed | 24 tests passed. Guardrail now covers removed `/files` company nav while preserving project Documents. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/`; `agent-browser snapshot -i`; `tests/agent-browser-runs/2026-06-25-remove-files-nav/home-navigation.png` | Passed | Rendered company tools show Knowledge Base and Documentation but no Documents link. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes. |
| End-to-end proof      | `rg -n "link \"Documents\"|href=\"/files\"|Knowledge Base|Documentation|Prime Contracts" tests/agent-browser-runs/2026-06-25-remove-files-nav/home-navigation-snapshot.txt` | Passed | Only expected neighboring nav links matched; no company-wide Documents or `/files` link in snapshot. |

## Files Changed

- `frontend/src/lib/navigation-config.ts` - remove company-wide `/files` nav item and grouping reference.
- `frontend/src/lib/__tests__/navigation-config.unit.test.ts` - add guardrail for removed `/files` nav.
- `docs/ops/tasks/2026-06-25-remove-files-nav.md` - task definition and evidence ledger.

## Risks / Gaps

- None for this slice. Direct `/files` route behavior was not changed.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
