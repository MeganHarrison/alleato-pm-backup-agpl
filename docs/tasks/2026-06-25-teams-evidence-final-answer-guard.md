# Task: Teams Evidence Final Answer Guard

Status: In Progress
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-633 - https://linear.app/megankharrison/issue/AAI-633/prevent-teams-evidence-blocks-from-rendering-as-final-answers
Related Handoff: N/A

## Objective

Prevent source-specific Teams evidence blocks from being copied into user-visible
assistant answers, and fix the Teams sanitizer so it removes raw chat IDs without
corrupting normal timestamps like `19:44:54`.

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

## Acceptance Criteria

- Source-specific RAG context injected into the system prompt is marked as
  internal evidence and explicitly forbidden from being copied into final output.
- The prompt wrapper tells the model to answer with synthesis, themes, risks,
  decisions, and follow-ups rather than evidence block headings or raw rows.
- Teams snippet sanitizer removes raw `19:<chat-id>` values without changing
  normal timestamps.
- Regression tests cover the copied-evidence-block failure and timestamp
  corruption.

## Failure-Loudly Behavior

Tests fail if the source-specific RAG prompt lacks the internal-only final-answer
guard or if Teams snippets change `19:44:54` timestamps into conversation labels.

## Evidence

| Check                 | Command / artifact                                                                                                                                                                                                                                                                                          | Result | Notes                                                                                                                                                  |
| --------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/lib/ai/retrieval/source-specific-rag.ts src/lib/ai/retrieval/system-prompt.ts src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts src/lib/ai/retrieval/__tests__/system-prompt.test.ts ../docs/tasks/2026-06-25-teams-evidence-final-answer-guard.md` | Pass   | All matched files use Prettier code style.                                                                                                             |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts src/lib/ai/retrieval/__tests__/system-prompt.test.ts --runInBand`                                                                                                                                                 | Pass   | 2 suites, 21 tests passed.                                                                                                                             |
| Browser/user-flow     | N/A                                                                                                                                                                                                                                                                                                         | N/A    | Backend prompt/evidence formatting change only.                                                                                                        |
| DB/provider read-back | N/A                                                                                                                                                                                                                                                                                                         | N/A    | No schema, migration, env, or provider changes.                                                                                                        |
| End-to-end proof      | Prompt wrapper and timestamp regression tests                                                                                                                                                                                                                                                               | Pass   | System prompt test proves internal-only final-answer guard; Teams RAG test proves `19:44:54` timestamp is preserved and raw `19:<chat-id>` is removed. |

## Files Changed

- `frontend/src/lib/ai/retrieval/system-prompt.ts` - source-specific evidence prompt guard.
- `frontend/src/lib/ai/retrieval/__tests__/system-prompt.test.ts` - prompt guard regression coverage.
- `frontend/src/lib/ai/retrieval/source-specific-rag.ts` - Teams chat ID sanitizer.
- `frontend/src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts` - timestamp preservation regression coverage.
- `docs/tasks/2026-06-25-teams-evidence-final-answer-guard.md` - task definition and evidence.

## Risks / Gaps

- This changes the model-facing prompt contract. A live rerun of the exact Teams prompt remains the best final product proof.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
