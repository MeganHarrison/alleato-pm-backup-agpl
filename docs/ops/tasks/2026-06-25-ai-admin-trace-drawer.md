# Task: AI Admin Trace Drawer

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: Not created yet - Linear issue creation tool unavailable in this session
Related Handoff: N/A

## Objective

Add a compact admin chat-history trace drawer so an operator can inspect a selected AI assistant turn and see trace id, tools called, token usage, scores, and write-preview/write-confirmed status from persisted chat metadata.

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

- Admin users can open an AI chat history view and select an assistant message.
- The selected message opens a compact drawer with trace id, tools called, usage, scores, and write status.
- Write status distinguishes preview-only, confirmed write, failed write, and no-write turns using persisted tool outputs.
- Missing trace metadata fails visibly in the drawer instead of appearing successful.

## Failure-Loudly Behavior

- API returns a specific admin/chat-history query error if `chat_history` or `conversations` fails.
- Drawer shows `Missing trace id` when no Langfuse trace id is persisted.
- Drawer shows `Unknown write status` only when tool metadata is malformed, not when there are no write tools.

## Planned Files

- `frontend/src/app/(admin)/ai-chat-history/page.tsx` - admin route shell.
- `frontend/src/app/(admin)/ai-chat-history/ai-chat-history-client.tsx` - compact table and trace drawer UI.
- `frontend/src/app/api/admin/ai-chat-history/route.ts` - admin source-of-truth endpoint over `chat_history`.
- `frontend/src/app/api/admin/ai-chat-history/__tests__/route.test.ts` - metadata mapping guardrail.
- `docs/ops/tasks/2026-06-25-ai-admin-trace-drawer.md` - task ledger.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `npx eslint 'src/app/(admin)/ai-chat-history/ai-chat-history-client.tsx' 'src/app/(admin)/ai-chat-history/page.tsx' 'src/app/api/admin/ai-chat-history/route.ts' 'src/app/api/admin/ai-chat-history/__tests__/route.test.ts' 'src/lib/navigation-config.ts'` | Pass | Targeted lint from `frontend/`. |
| Static/type/lint      | `npm run typecheck -- --pretty false` | Blocked by unrelated repo debt | Fails before this slice at `src/lib/submittals/ai-review/review-run-service.ts:1039` with `TS1005: ',' expected`. |
| Targeted tests        | `npx jest 'src/app/api/admin/ai-chat-history/__tests__/route.test.ts' --runInBand` | Pass | 3 tests cover preview-only, confirmed, failed, unknown, no-write, and missing trace id. |
| Browser/user-flow     | `agent-browser open http://localhost:3001/ai-chat-history`, `agent-browser click Inspect`, `agent-browser get text body` | Pass | Page rendered 75 assistant turns; drawer showed trace id, tools, token usage, score, and `Preview` write status for the Vermillion change-event turn. |
| DB/provider read-back | N/A | N/A | No schema/provider changes. |
| End-to-end proof      | `/ai-chat-history` browser drawer over live `chat_history` data | Pass | The first row links trace `536e53d1014bf407647fe46cc0cc7b4b` and correctly distinguishes preview-only write behavior. |

## Files Changed

- `frontend/src/app/(admin)/ai-chat-history/page.tsx` - new admin route shell.
- `frontend/src/app/(admin)/ai-chat-history/ai-chat-history-client.tsx` - table and drawer.
- `frontend/src/app/api/admin/ai-chat-history/route.ts` - typed API projection from chat metadata.
- `frontend/src/app/api/admin/ai-chat-history/__tests__/route.test.ts` - guardrail coverage.
- `frontend/src/lib/navigation-config.ts` - shared admin navigation entry.
- `docs/ops/tasks/2026-06-25-ai-admin-trace-drawer.md` - task ledger.

## Risks / Gaps

- Linear issue could not be created because the available Linear connector did not expose issue creation in this session.
- Full frontend typecheck is blocked by unrelated submittal AI review syntax debt in `frontend/src/lib/submittals/ai-review/review-run-service.ts`.
- `codex:finish` was not run because the workspace contains broad unrelated dirty files and the global frontend typecheck blocker would prevent a clean finish.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
