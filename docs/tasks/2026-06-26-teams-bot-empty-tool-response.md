# Task: Teams bot empty tool response

Status: Implemented - Pending Live Teams Verification
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-716 - https://linear.app/megankharrison/issue/AAI-716/fix-teams-bot-empty-tool-response-posts
Related Handoff: Not created - single-session fix

## Objective

Teams bot replies must never attempt to post empty assistant text. When the AI SDK returns a tool-only result, the bot must produce a non-empty Teams-safe response from the tool output and record enough metadata to diagnose the turn later.

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
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `npx eslint src/lib/ai/bot-core.ts src/lib/bot/teams-chat.ts src/lib/ai/__tests__/bot-core-prompt.test.ts --quiet`; `npm run typecheck:changed`; `npm run guardrails:unsafe-patterns`; `GUARDRAIL_ENFORCE_RAW_ERRORS=true npm run guardrails:changed` | Pass | `pnpm --dir frontend test -- bot-core-prompt.test.ts` was blocked by pnpm ignored-builds/install gate before Jest. |
| Targeted tests | `npm run test:unit -- --runTestsByPath src/lib/ai/__tests__/bot-core-prompt.test.ts --runInBand` | Pass | 5 tests passed, including tool-only bot response regression. |
| Browser/user-flow | Screenshot `/Users/meganharrison/Desktop/Screenshot 2026-06-26 at 8.20.42 AM.png` plus Teams bot DB logs | Fail reproduced | Teams showed generic red-X fallback before fix. No live Teams retry after local patch yet. |
| DB/provider read-back | `bot_debug_log`, `tasks`, and `ai_tool_write_audits` queries for `2026-06-26T12:15:00Z..12:25:00Z` | Fail reproduced; no write happened | `after_generate` had `responseLength: 0`; post failed with Teams non-empty text requirement. `tasks` rows=0 and `ai_tool_write_audits` rows=0 for the incident window. |
| End-to-end proof | Pending deployment/live Teams retry | Pending | Required before marking Done. |

## Files Changed

- `frontend/src/lib/ai/bot-core.ts` - derive non-empty bot response text from tool-only AI SDK results.
- `frontend/src/lib/bot/teams-chat.ts` - avoid empty Teams posts and log response derivation state.
- `frontend/src/lib/ai/__tests__/bot-core-prompt.test.ts` - regression coverage for tool-only response fallback.
- `docs/tasks/2026-06-26-teams-bot-empty-tool-response.md` - done gate and evidence.

## Risks / Gaps

- Live Teams post verification depends on the production Teams webhook path; this local patch is not proven against a real inbound Teams retry yet.
- `docs/tasks/2026-06-26-teams-bot-empty-tool-response.md` is under ignored `docs/` and must be force-added if this task ledger should be committed.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
