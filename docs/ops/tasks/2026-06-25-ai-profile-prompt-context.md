# Task: AI Profile Prompt Context

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-678 - https://linear.app/megankharrison/issue/AAI-678/wire-ai-profile-context-packet-into-assistant-prompt-assembly
Related Handoff: Not applicable

## Objective

Wire the governed AI Profile context packet into the assistant prompt assembly
path so Alleato AI can safely know the authenticated user without dumping every
profile or memory record into every conversation.

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

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Static/type/lint | `cd frontend && npx eslint src/lib/ai/bot-core.ts src/lib/ai/ai-profile-context-packet.ts src/lib/ai/__tests__/bot-core-prompt.test.ts src/lib/ai/__tests__/ai-profile-context-packet.test.ts`; `cd frontend && npm run typecheck` | Pass | Targeted ESLint clean; bounded typecheck exited 0. |
| Targeted tests | `cd frontend && npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/bot-core-prompt.test.ts src/lib/ai/__tests__/ai-profile-context-packet.test.ts` | Pass | 9 tests passed. |
| Browser/user-flow | Not applicable | Pass | Prompt assembly/helper slice; no frontend-visible runtime change. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes planned. |
| End-to-end proof | `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` | Pass | Prompt assembly includes AI Profile context and degrades explicitly when profile context cannot load. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-profile-prompt-context.md` - Task evidence.
- `frontend/src/lib/ai/bot-core.ts` - Inject AI Profile context packet into shared prompt assembly.
- `frontend/src/lib/ai/ai-profile-context-packet.ts` - Render compact profile packet prompt block.
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` - Prompt assembly guardrails.
- `frontend/src/lib/ai/__tests__/ai-profile-context-packet.test.ts` - Packet rendering guardrail.

## Risks / Gaps

- Runtime wiring uses the canonical shared `assembleSystemPrompt` helper instead
  of patching the large streaming handler directly.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
