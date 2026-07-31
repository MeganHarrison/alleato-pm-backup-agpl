# Task: AI Profile MVP

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-667 - https://linear.app/megankharrison/issue/AAI-667/build-ai-profile-mvp
Related Handoff: Not applicable

## Objective

Add an AI Profile surface where a user can see the identity, role context,
memories, preferences, and governance state Alleato AI can use when interacting
with them.

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
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/components/ai-assistant/ai-profile-page.tsx src/components/ai-assistant/welcome-screen.tsx src/lib/ai/ai-profile-summary.ts src/lib/ai/__tests__/ai-profile-summary.test.ts 'src/app/(main)/ai/profile/page.tsx'`; `cd frontend && npm run typecheck` | Pass | Targeted ESLint clean; bounded typecheck exited 0. |
| Targeted tests        | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/ai-profile-summary.test.ts` | Pass | 4 tests passed. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/ai/profile`; `agent-browser snapshot -i`; `agent-browser open http://localhost:3001/ai`; `agent-browser snapshot -i` | Pass | `/ai/profile` loaded live profile/memory data; `/ai` exposed the AI Profile link. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes. |
| End-to-end proof      | `docs/ops/evidence/2026-06-25-ai-profile-mvp/ai-profile.png`; `docs/ops/evidence/2026-06-25-ai-profile-mvp/ai-command-center-link.png` | Pass | Screenshots captured from the running local app. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-profile-mvp.md` - Task evidence.
- `frontend/src/lib/ai/ai-profile-summary.ts` - Memory/profile summarization helpers.
- `frontend/src/lib/ai/__tests__/ai-profile-summary.test.ts` - Summary guardrails.
- `frontend/src/components/ai-assistant/ai-profile-page.tsx` - AI Profile UI.
- `frontend/src/app/(main)/ai/profile/page.tsx` - AI Profile route.
- `frontend/src/components/ai-assistant/welcome-screen.tsx` - Link AI empty state to profile.

## Risks / Gaps

- Leadership/coaching context has no durable source table in this slice; the MVP
  must show that policy state honestly instead of inventing data.
- Editing memories remains in the existing Settings Memory page.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
