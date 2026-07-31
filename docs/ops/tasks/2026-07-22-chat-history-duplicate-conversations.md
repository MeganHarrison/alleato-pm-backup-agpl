# Task: Prevent Duplicate Empty AI Conversations

Status: Complete
Owner: SROOT-CHAT-DUPE
Created: 2026-07-22
Task ID: chat-history-duplicate-conversations-20260722
Linear Issue: Not required; single-session repair with no existing tracked issue.
Related Handoff: Not required; single-session task.

## Objective

Starting a new Alleato AI chat must not persist a conversation until the user submits the first message.

## Scope

- Own the shared conversation-creation mutation, full-page Alleato AI new-chat lifecycle, sidebar action state, and focused regression tests.
- Preserve the existing first-message conversation creation flow and widget behavior.
- Exclude chat message persistence, schema changes, SDK upgrades, and destructive cleanup of historical rows.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/components/ai-assistant/rag-chat-page.tsx` and Supabase `conversations` / `chat_history` readback.
- Existing shared primitives/services: `useCreateConversation`, `ChatWithSession`, and the already-correct reset-only new-chat behavior in `widget-ai-chat.tsx`.
- Deprecated or parallel paths: N/A.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Production data proves whether duplication occurs in `conversations` or `chat_history`.
- [x] Clicking New chat resets the route and local state without calling the conversation POST mutation.
- [x] Concurrent first-message creation attempts coalesce into one conversation POST.
- [x] The first submitted message creates exactly one conversation and one user message row in the authenticated user flow.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] The existing full-page owner is repaired without adding a parallel component or persistence path.
- [x] The shared creation hook owns the single-flight guard for full-page and widget callers.
- [x] Errors remain owned by the existing first-message mutation and chat transport.
- [x] No database, provider, authentication, permission, or delivery contract changes are required.

## Integration and Verification

- [x] Targeted unit checks pass.
- [x] Authenticated user-flow proof confirms New chat does not add a history row and first submit adds one.
- [x] Independent review passes.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures are excluded by exact-file verification.
- [x] Task-owned files are published to `origin/main`; the exact task commit is deployed to production.

## Failure-Loudly Contract

- Cause surfaced as: a focused regression test fails if the New chat handler calls `createConversation.mutateAsync` or restores a placeholder title.
- Detection path: targeted Jest test plus before/after production `conversations` and `chat_history` counts during the browser flow.
- Recovery path: keep New chat as a local reset and route transition; create the server record only through the existing first-message path.

## Incident Learning

- Failure fingerprint: `ai-chat-turn-persistence-drift`
- Root cause: the full-page New chat handler persisted a placeholder conversation while the first-message handler independently owned real conversation creation.
- Detection gap: there was no contract asserting that New chat is side-effect free before the first user message.
- Prevention: keep one creation boundary at first submission, coalesce concurrent mutation attempts in the shared hook, disable/reset-guard New chat while creation is in flight, and block placeholder persistence with focused contracts.
- Guardrail evidence: `rag-chat-page-layout.test.tsx` asserts the New chat handler contains no conversation mutation and is in-flight-guarded; `use-rag-conversations.test.tsx` proves two concurrent creation attempts issue one API request.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | High-risk acceptance and proof contract captured before implementation. |
| Production database localization | Supabase service-role readback, 2026-07-22 | Pass | No same-content `chat_history` rows within 15 seconds in 30 days; three same-title conversation pairs within 15 seconds were all `New conversation` placeholders. |
| Existing implementation comparison | `widget-ai-chat.tsx` | Pass | Widget New chat already resets local state without persisting. |
| Targeted regressions | `cd frontend && npm run test:unit -- --runInBand --runTestsByPath src/components/ai-assistant/__tests__/rag-chat-page-layout.test.tsx src/hooks/__tests__/use-rag-conversations.test.tsx` | Pass | 2 suites, 4 tests; placeholder write, pending reset guard, and concurrent creation coalescing covered. |
| Targeted lint | `cd frontend && npx eslint src/components/ai-assistant/rag-chat-page.tsx src/components/ai-assistant/conversation-sidebar.tsx src/components/ai-assistant/__tests__/rag-chat-page-layout.test.tsx src/hooks/use-rag-conversations.ts src/hooks/__tests__/use-rag-conversations.test.tsx --max-warnings=0` | Pass | No errors or warnings. |
| Independent review | Read-only reviewer | Pass | Initial review found an in-flight creation/reset race; re-review passed after the guard, disabled action, and behavioral single-flight test were added. |
| Frontend typecheck | `cd frontend && npm run typecheck` | Unrelated fail | No diagnostics in task-owned files. Existing errors remain in `handler-v2.ts`, `chat-area.tsx`, `widget-ai-chat.tsx`, and other unrelated owners. |
| Authenticated browser proof | `agent-browser --session chat-dupe-proof-0722` on `http://localhost:3000/ai` | Pass | New chat kept the count at 360; first submit raised it to 361; controlled session archived after proof and active count returned to 360. Screenshots and action log are under `docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/`. |
| Database readback | `database-readback.json` | Pass | Exact controlled session had one conversation, one matching user row, and one assistant row. |
| Verification contract | `npm run verify:contract -- --manifest docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/verification-manifest.json --result docs/ops/evidence/2026-07-22-chat-history-duplicate-conversations/verification-result.json --root . --require-pass` | Pass | Declared evidence supports PASS. |
| Production release | Vercel deployment `dpl_HEUa4u4R1xTVK3iM2nWZZe2WUr6M` for commit `6ea6363` | Pass | Deployment is Ready and the canonical `projects.alleatogroup.com` alias resolves to it. |
| Canonical authenticated proof | `agent-browser --session chat-dupe-prod-final-0722` on `https://projects.alleatogroup.com/ai` | Pass | Active conversation count was 360 before New chat and 360 after New chat. Screenshot: `production-after-new-chat.png`. |

## Remaining Risk

- Historical empty placeholder rows remain stored but will no longer be created by the repaired flow. Cleanup is intentionally excluded because it would be a destructive data operation without evidence that users need those rows removed.
- A render-level interaction test for clicking New chat during a throttled first-message POST remains a coverage improvement; the shared single-flight behavioral test and page-level pending/disabled contract cover the release boundary. Owner: AI assistant frontend. Next action: add it when the chat page receives a reusable render harness.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Deferred historical cleanup has cause, detection gap, prevention, owner, and next action documented under Remaining Risk.
