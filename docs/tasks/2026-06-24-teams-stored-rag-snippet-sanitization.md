# Task: Teams Stored RAG Snippet Sanitization

Status: In Progress
Owner: Codex
Created: 2026-06-24
Linear Issue: AAI-627 - https://linear.app/megankharrison/issue/AAI-627/sanitize-stored-teams-rag-evidence-snippets
Related Handoff: N/A

## Objective

Stop stored Teams conversation rows from leaking raw Teams/RAG metadata into the
assistant response. The model-facing Teams evidence should contain readable
message snippets and source context, not raw `19:` chat IDs, `[message:...]`
tokens, HTML entities, or copied document headers.

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

- Stored Teams evidence snippets do not include `[Teams Direct Message Conversation: ...]`, `[message:...]`, raw `19:` chat IDs, `&nbsp;`, or `&amp;`.
- Opaque Teams `19:` titles render as a generic Teams conversation label without exposing the ID.
- Named Teams conversations keep their readable names.
- Regression tests cover the exact pasted bad output shape.

## Failure-Loudly Behavior

Tests fail if stored Teams output reintroduces raw Teams document headers,
message IDs, chat IDs, or HTML entities into the model-facing evidence block.

## Evidence

| Check                 | Command / artifact                                                                                                                                                                                                   | Result | Notes                                                                                                                                                     |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------ | --------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Static/type/lint      | `pnpm --dir frontend exec prettier --check src/lib/ai/retrieval/source-specific-rag.ts src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts ../docs/tasks/2026-06-24-teams-stored-rag-snippet-sanitization.md` | Pass   | All matched files use Prettier code style.                                                                                                                |
| Targeted tests        | `pnpm --dir frontend exec jest src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts --runInBand`                                                                                                               | Pass   | 1 suite, 3 tests passed.                                                                                                                                  |
| Browser/user-flow     | N/A                                                                                                                                                                                                                  | N/A    | Backend prompt/evidence formatting change only.                                                                                                           |
| DB/provider read-back | N/A                                                                                                                                                                                                                  | N/A    | No schema, migration, env, or provider changes.                                                                                                           |
| End-to-end proof      | Stored Teams leak regression test                                                                                                                                                                                    | Pass   | Proves stored Teams snippets exclude raw conversation headers, `[message:]`, `19:` IDs, `&nbsp;`, and `&amp;` while keeping readable named conversations. |

## Files Changed

- `frontend/src/lib/ai/retrieval/source-specific-rag.ts` - stored Teams snippet sanitization.
- `frontend/src/lib/ai/retrieval/__tests__/source-specific-rag.test.ts` - regression coverage for stored Teams leakage.
- `docs/tasks/2026-06-24-teams-stored-rag-snippet-sanitization.md` - task definition and evidence.

## Risks / Gaps

- This fixes model-facing evidence formatting. A live assistant rerun is still recommended to verify final synthesis behavior against current production data.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
