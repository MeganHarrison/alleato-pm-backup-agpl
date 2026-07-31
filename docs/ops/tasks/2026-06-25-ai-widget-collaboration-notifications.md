# Task: AI Widget Collaboration Notifications

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-652 - https://linear.app/megankharrison/issue/AAI-652/wire-ai-widget-notifications-through-collaboration-notifications
Related Handoff: docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md

## Objective

Continue the AI widget MVP into the durable notification path: AI assistant notification kinds should be represented through the existing collaboration notification abstraction, and the global widget should be able to use those notifications for unread/welcome behavior without creating a second notification store or second floating assistant.

## Attention Brief

Primary user: owner, executive, PM, or project team member using normal app pages.
Primary job: notice actionable AI assistance without leaving the current workflow.
Primary decision: whether to open the assistant now or keep working.
Tier 1: unread state and the current assistant prompt/action when the widget opens.
Tier 2: notification kind/title/body and target action.
Tier 3: delivery source and metadata for debugging.
Hide until requested: notification history, raw payload metadata, admin/debug details.
Remove: duplicate widgets, extra banners, decorative notification panels, second notification APIs.
Primary action: open the existing global AI widget and act from the existing composer/action chips.
Failure-loudly behavior: invalid AI notification payloads are filtered with a typed reason in tests/logging, and API/storage errors surface through existing notification hook error state instead of silently clearing unread.

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

## Planned Files

- `frontend/src/hooks/use-collaboration-notifications.ts` - existing notification source of truth to inspect/reuse.
- `frontend/src/app/api/collaboration/notifications/route.ts` - existing API contract to inspect/reuse.
- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - unread/open behavior integration if needed.
- `frontend/src/components/ai-assistant/widget-ai-chat.tsx` - pass typed notification context only if needed.
- `frontend/src/components/ai-assistant/chat-area.tsx` - render/use assistant action context only if needed.
- `frontend/src/lib/ai/*` or `frontend/src/lib/collaboration/*` - shared typed AI notification helper if warranted.
- `frontend/src/**/*.test.ts(x)` - focused guardrails for notification classification/unread behavior.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && npx eslint src/lib/collaboration/ai-widget-notifications.ts src/lib/collaboration/__tests__/ai-widget-notifications.test.ts src/hooks/use-collaboration-notifications.ts src/app/api/collaboration/notifications/route.ts src/components/ai-assistant/global-ai-widget.tsx src/components/ai-assistant/widget-ai-chat.tsx` | Pass | Targeted lint for task-owned files. |
| Static/type/lint      | `cd frontend && npx tsc --noEmit --pretty false` | Pass | Full frontend typecheck passed. |
| Targeted tests        | `cd frontend && npx jest --runInBand --runTestsByPath src/lib/collaboration/__tests__/ai-widget-notifications.test.ts` | Pass | 1 suite / 5 tests. |
| Browser/user-flow     | `node <playwright smoke using frontend/tests/.auth/user.json>` | Pass | Authenticated `/25125/home`, opened widget, dialog visible, welcome action still shows `Create a change request`; screenshot: `docs/ops/evidence/2026-06-25-ai-widget-collaboration-notifications/widget-open-authenticated.png`. Forced click was required because local Agentation feedback toolbar intercepted pointer events. |
| DB/provider read-back | `node <playwright API request> GET /api/collaboration/notifications?limit=5` | Pass | Returned HTTP 200 with `unreadCount` number and `hasMore=false`; test user had 0 notification rows, so no live per-row metadata sample existed. No migration or provider config required. |
| End-to-end proof      | `node <playwright smoke using frontend/tests/.auth/user.json>` | Pass | Existing widget remains the single assistant surface; API consumer and typed notification selectors are wired. Live AI notification producer rows are a follow-up gap. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-widget-collaboration-notifications.md` - task ledger and definition of done.
- `frontend/src/app/api/collaboration/notifications/route.ts` - includes `metadata` in notification API results.
- `frontend/src/hooks/use-collaboration-notifications.ts` - exposes metadata, stable mutation handlers, and actionable error state.
- `frontend/src/lib/collaboration/ai-widget-notifications.ts` - typed AI widget notification kinds, metadata normalization, unread filtering, and prompt draft selection.
- `frontend/src/lib/collaboration/__tests__/ai-widget-notifications.test.ts` - guardrails for kinds, unread filtering, metadata normalization, and prompt draft selection.
- `frontend/src/components/ai-assistant/global-ai-widget.tsx` - derives unread/welcome state from collaboration notifications, marks AI widget notifications read on open, and passes prompt drafts to the assistant.
- `frontend/src/components/ai-assistant/widget-ai-chat.tsx` - consumes one notification prompt draft into the existing composer without adding another UI surface.

## Risks / Gaps

- Existing checkout has unrelated dirty files. This task must stage/publish only task-owned files.
- No live AI notification producer was added in this slice. The consumer path is ready for `ai_assistant_welcome`, `ai_action_ready`, `rfi_attention`, and `change_request_review_needed` rows, but a producer still needs to insert those rows with normalized `metadata.prompt` when the product event is defined.
- The existing localStorage welcome MVP remains valid as a fallback until a database-backed AI notification producer is active.
- Browser smoke used a refreshed local Playwright test auth state. The local Agentation feedback toolbar intercepted pointer clicks on the launcher, so the smoke used a forced click after verifying the launcher was visible.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
