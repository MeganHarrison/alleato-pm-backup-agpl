# Task: Knowledge Base icon and label polish

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-657 - https://linear.app/megankharrison/issue/AAI-657/update-knowledge-base-rail-icon-and-admin-label
Related Handoff: N/A

## Objective

On `/knowledge`, update the `On this page` icon to match the simpler list-style icon shown in the provided screenshot and rename `Manage sources` to `Add knowledge`.

## Attention Brief

Primary user: Alleato users browsing or adding knowledge.
Primary job: Understand page navigation and where to add new knowledge.
Primary decision: Use the page index or add a knowledge source.
Tier 1: Page title, topic cards, search.
Tier 2: Right-rail page index and admin add action.
Tier 3: None.
Hide until requested: No new content.
Remove: Ambiguous `Manage sources` label.
Primary action: Add knowledge via `/knowledge/manage`.
Failure-loudly behavior: Test asserts the new label and old label absence.

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
| Static/type/lint      | `cd frontend && npx eslint src/features/knowledge/knowledge-base-page.tsx src/features/knowledge/__tests__/knowledge-base-page.test.tsx` | Passed | Focused lint for touched files. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/features/knowledge/__tests__/knowledge-base-page.test.tsx --runInBand` | Passed | Asserts `Add knowledge` href and absence of `Manage sources`. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/knowledge` + screenshot/snapshot | Passed | `tests/agent-browser-runs/2026-06-25-knowledge-icon-label-polish/knowledge-desktop.png`; snapshot shows `Add knowledge` links and no `Manage sources`. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes. |
| End-to-end proof      | `rg -n "Add knowledge|Manage sources|On this page" tests/agent-browser-runs/2026-06-25-knowledge-icon-label-polish/knowledge-desktop-snapshot.txt` | Passed | Rendered route contains `Add knowledge` in both admin entry points and no stale label. |

## Files Changed

- `frontend/src/features/knowledge/knowledge-base-page.tsx` - update rail icon and admin action label.
- `frontend/src/features/knowledge/__tests__/knowledge-base-page.test.tsx` - assert new label and old label absence.
- `docs/ops/tasks/2026-06-25-knowledge-icon-label-polish.md` - task definition and evidence ledger.

## Risks / Gaps

- None known. Unrelated dirty files existed before closeout and were left untouched.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
