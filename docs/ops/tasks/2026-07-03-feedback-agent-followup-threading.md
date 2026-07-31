# Task: Feedback agent follow-up threading

Status: Draft
Owner: Codex
Created: 2026-07-03
Linear Issue: Not created yet - required before implementation starts
Related Handoff: N/A

## Objective

Build one canonical frontend-backed assistant thread per Feedback Inbox item so Brandon or another admin can continue implementation work from the feedback item itself, from follow-up comments, or from the existing AI widget without losing context or depending on a private user conversation.

## Attention Brief

Primary user: admin or reviewer working a Feedback Inbox issue.
Primary job: continue the implementation conversation with full source context.
Primary decision: ask a follow-up, dispatch to execution, or stop and wait for a human.
Tier 1: feedback item summary, latest assistant/human turns, send box, thread state.
Tier 2: screenshots, page/tool context, GitHub dispatch link, relay status.
Tier 3: raw metadata and debug traces.
Hide until requested: transport payloads, internal replay ids, verbose diagnostics.
Remove: duplicate chat stores, second assistant widget, fake comment-tag behavior that is not wired to a real thread owner.
Primary action: open the canonical assistant thread and continue work.
Failure-loudly behavior: relay, load, or streaming failures must show explicit state and retry/error detail on the feedback item and inside the thread.

## Acceptance Criteria

- [ ] A feedback item can create or reopen one canonical assistant thread.
- [ ] The canonical thread is owned by the feedback item, not by `conversations.user_id`.
- [ ] Starting the thread seeds it with feedback item context, tool context, screenshots, and comment history.
- [ ] New feedback comments can relay into the canonical thread without duplicate replay.
- [ ] The existing AI widget can open the same feedback-owned thread.
- [ ] Existing GitHub/Codex dispatch remains intact and visibly separate from the conversational thread path.
- [ ] Failure state is specific and inspectable: `idle`, `running`, `awaiting_human`, `failed`, or `closed`.

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

- [ ] Files/modules to change listed before edits.
- [ ] Database schema/types/migrations handled, if applicable.
- [ ] Provider/env/config changes handled through CLI/API/MCP when available.
- [ ] Centralized/shared abstraction used when the behavior is cross-cutting.
- [ ] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [ ] Errors are specific and actionable; no silent fallback added.
- [ ] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [ ] End-to-end path wired through one owner, not separate disconnected pieces.
- [ ] All entry points for the workflow use the same canonical service/runtime.
- [ ] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [ ] Artifacts link back to source evidence and run logs.
- [ ] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [ ] Guardrail added so the same class of bug fails loudly next time.
- [ ] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `docs/PRPs/feedback-agent-followup-threading/prp-feedback-agent-followup-threading.md` - executable implementation plan.
- `docs/PRPs/feedback-agent-followup-threading/TASKS.md` - ordered workstreams for implementation.
- `supabase/migrations/<timestamp>_admin_feedback_assistant_threads.sql` - shared feedback-thread schema.
- `frontend/src/app/api/admin/feedback/[feedbackId]/assistant-thread/route.ts` - thread create/read endpoint.
- `frontend/src/app/api/admin/feedback/[feedbackId]/assistant-thread/messages/route.ts` - threaded message send endpoint.
- `frontend/src/app/api/admin/feedback/[feedbackId]/assistant-thread/relay/route.ts` - comment relay endpoint.
- `frontend/src/app/api/admin/feedback/comments/route.ts` - relay trigger integration.
- `frontend/src/lib/admin-feedback/assistant-thread-schemas.ts` - typed thread contracts.
- `frontend/src/lib/admin-feedback/assistant-thread-context.ts` - seed context builder.
- `frontend/src/lib/admin-feedback/assistant-thread-service.ts` - canonical shared runtime owner.
- `frontend/src/hooks/use-feedback-assistant-thread.ts` - frontend data hook.
- `frontend/src/components/admin-feedback/feedback-assistant-thread-panel.tsx` - feedback detail thread UI.
- `frontend/src/components/ai-assistant/widget-ai-chat.tsx` - feedback-thread mode in the existing widget.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Planning source review | `frontend/src/app/api/admin/feedback/{route,comments,github-comments,dispatch}.ts`, `frontend/src/components/admin-feedback/AdminFeedbackWidget.tsx`, `frontend/src/components/ai-assistant/widget-ai-chat.tsx`, `frontend/src/app/api/ai-assistant/{chat,conversations}.ts` | Pass | Existing feedback and assistant surfaces reviewed before planning. |
| Task template | `docs/tasks/TASK-TEMPLATE.md` | Pass | Active task template confirmed; `docs/ops/tasks/TASK-TEMPLATE.md` is not the live path. |
| Architecture decision | PRP + this task file | Pass | Shared feedback-owned thread selected over reuse of user-private `conversations`. |

## Files Changed

- `docs/PRPs/feedback-agent-followup-threading/prp-feedback-agent-followup-threading.md` - complete implementation PRP.
- `docs/PRPs/feedback-agent-followup-threading/TASKS.md` - ordered workstreams and acceptance criteria.
- `docs/ops/tasks/2026-07-03-feedback-agent-followup-threading.md` - repo task gate and definition of done.

## Risks / Gaps

- A Linear issue still needs to be created before implementation starts.
- Exact migration column types must be confirmed by fresh `npm run db:types` output at implementation time.
- The current assistant action-tool lane is not reliable enough to scope direct write execution into this thread yet.
- If product later wants assistant replies mirrored back into `admin_feedback_comments`, that should be a deliberate second slice rather than an implicit schema shortcut.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
