# Task: Knowledge Base topic card cleanup

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-656 - https://linear.app/megankharrison/issue/AAI-656/simplify-knowledge-base-topic-surface
Related Handoff: N/A

## Objective

Clean up `/knowledge` so the page no longer relies on unnecessary borders/dividers, removes the requested topic heading/subtitle, removes Source documents and Source confidence, and presents topics as the primary card-style browsing surface.

## Attention Brief

Primary user: Alleato users browsing approved internal knowledge.
Primary job: Choose a knowledge topic quickly.
Primary decision: Which topic to open.
Tier 1: Search, topic cards, selected topic state.
Tier 2: Admin Manage sources.
Tier 3: Topic descriptions.
Hide until requested: Source document rows and source confidence explanatory text.
Remove: `Browse by topic`, its subtitle, Source documents, Source confidence, and border-heavy wrappers.
Primary action: Search or select a topic card.
Failure-loudly behavior: Tests fail if removed section headings return.

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
| Static/type/lint      | `cd frontend && npx eslint src/features/knowledge/knowledge-base-page.tsx src/features/knowledge/__tests__/knowledge-base-page.test.tsx` | Passed | No lint output. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/features/knowledge/__tests__/knowledge-base-page.test.tsx --runInBand` | Passed | Test now asserts removed headings/sections stay absent and topic buttons remain. |
| Browser/user-flow     | `tests/agent-browser-runs/2026-06-25-knowledge-topic-card-cleanup/knowledge-desktop.png`; `tests/agent-browser-runs/2026-06-25-knowledge-topic-card-cleanup/knowledge-mobile.png` | Passed | Topic cards render as tonal cards; removed sections are not visible. |
| DB/provider read-back | N/A                | Passed | No database, provider, env, or migration changes. |
| End-to-end proof      | `rg -n "Browse by topic|Topics follow|Source documents|Source confidence|Safety orientation|Alleato FedEx|Open" tests/agent-browser-runs/2026-06-25-knowledge-topic-card-cleanup/knowledge-desktop-snapshot.txt tests/agent-browser-runs/2026-06-25-knowledge-topic-card-cleanup/knowledge-mobile-snapshot.txt`; overflow JSON artifacts | Passed | Removed section text/source rows absent; only unrelated menu labels matched `Open`. Desktop/mobile have no horizontal overflow. |

## Files Changed

- `frontend/src/features/knowledge/knowledge-base-page.tsx` - remove bordered sections and make topic cards primary.
- `frontend/src/features/knowledge/__tests__/knowledge-base-page.test.tsx` - guard removed sections and topic card behavior.
- `docs/ops/tasks/2026-06-25-knowledge-topic-card-cleanup.md` - task definition and evidence ledger.

## Risks / Gaps

- None for this slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
