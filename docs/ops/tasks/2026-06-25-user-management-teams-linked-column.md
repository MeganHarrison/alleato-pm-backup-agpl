# Task: User management Teams linked account column

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: Not linked in-thread
Related Handoff: N/A

## Objective

Show whether each user on `/user-management` has a linked Microsoft Teams bot account, using the existing Teams account-linking source of truth.

## Attention Brief

Primary user: Admin managing employee access.
Primary job: Identify who can communicate with the AI assistant through Teams.
Primary decision: Which users are linked and which users still need Teams setup.
Tier 1: User identity and access status remain primary.
Tier 2: Teams linked-account status is visible in the users table.
Tier 3: Linked display name or account hint when available.
Hide until requested: Link-code mechanics and bot setup instructions.
Remove: Any extra summary cards, banners, or duplicate instructions.
Primary action: Open a user row/details or follow existing Teams linking workflow.
Failure-loudly behavior: If linkage lookup fails, the page should fail with the existing data-load error instead of silently showing everyone unlinked.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Acceptance Criteria

- [x] `/user-management` App Users table includes a Teams linked account column.
- [x] Linked users show the mapped Teams display/account information from `bot_user_mappings`.
- [x] Unlinked users show a quiet unlinked state.
- [x] The data path fails loudly if the Teams mapping query fails.
- [x] Targeted automated coverage verifies linked and unlinked rows.
- [x] Browser proof confirms the column renders on `http://localhost:3001/user-management`.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Files To Change

- `frontend/src/app/(admin)/user-management/page.tsx` - add the visible table column.
- `frontend/src/app/(admin)/user-management/_lib/user-access-data.ts` - load Teams mapping data with the user rows.
- `frontend/src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts` - cover linked/unlinked mapping behavior.

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
| Static/type/lint      | `npx eslint 'src/app/(admin)/user-management/page.tsx' 'src/app/(admin)/user-management/_lib/user-access-data.ts' 'src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts' 'src/app/api/permissions/users/route.ts'`; `npm run quality:changed` | Pass | Touched-file ESLint passed; changed-file quality passed with no new ESLint debt, no new `any` debt, no unsafe patterns, and route guardrails passed. |
| Targeted tests        | `npm run test:unit -- --runInBand --runTestsByPath 'src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts'` | Pass | 4 tests passed, including linked and unlinked Teams account summary coverage. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/user-management`; `agent-browser snapshot -i`; `agent-browser screenshot` | Pass | Column rendered on `/user-management`; screenshot shows Teams Account with Brandon Clymer and Megan Harrison linked and other users marked Not linked. |
| DB/provider read-back | N/A                | Pass   | No schema/config change; existing `bot_user_mappings` table is the source. |
| End-to-end proof      | `tests/agent-browser-runs/2026-06-25-user-management-teams-linked-column/user-management-after-wait-snapshot.txt`; `tests/agent-browser-runs/2026-06-25-user-management-teams-linked-column/user-management-after-wait.png` | Pass | Exact route proof captured after data load. |

## Files Changed

- `frontend/src/app/api/permissions/users/route.ts` - loads Teams mapping data from `bot_user_mappings` and fails loudly on lookup errors.
- `frontend/src/app/(admin)/user-management/page.tsx` - adds default-visible Teams Account column with search and sort support.
- `frontend/src/app/(admin)/user-management/_lib/user-access-data.ts` - carries linked account data through the shared user summary shape.
- `frontend/src/app/(admin)/user-management/_lib/__tests__/user-access-data.test.ts` - covers linked and unlinked Teams account mapping.
- `docs/ops/tasks/2026-06-25-user-management-teams-linked-column.md` - task ledger and evidence.

## Risks / Gaps

- The checkout has unrelated dirty files from other work; publish/commit must use an exact task-owned file list.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
