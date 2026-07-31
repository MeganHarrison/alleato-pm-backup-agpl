# Task: Send in-app notifications for team-chat direct messages

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-790 - https://linear.app/megankharrison/issue/AAI-790/send-in-app-notifications-for-direct-messages-in-team-chat
Related Handoff: Not created in this session

## Objective

When a user sends Brandon a direct message in `/team-chat`, Brandon should receive an in-app notification that links back to the specific DM conversation.

## Attention Brief

Primary user: admin/operator using `/team-chat` direct messages.
Primary job: notice a new direct message without having to keep team chat open.
Primary decision: whether to open the DM now and respond.
Tier 1: sender identity, DM preview, and direct link back to the conversation.
Tier 2: channel context and dedupe metadata for guardrails.
Hide until requested: raw DM topic encoding, notification metadata internals.
Remove: channel-wide notification fanout, duplicate recipient notifications, generic `/team-chat` links when a precise DM link exists.
Primary action: click the notification and land back in the correct direct message.
Failure-loudly behavior: if the send path cannot resolve the DM recipient or cannot write the notification row, the API returns a specific error instead of silently sending only the chat message.

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
- [ ] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `frontend/src/app/api/team-chat/messages/route.ts` - create recipient notification on DM send.
- `frontend/src/app/api/team-chat/direct-messages/route.ts` or shared helper - canonical DM topic parsing / recipient resolution.
- `frontend/src/lib/collaboration/notification-links.ts` - link DM notifications back to the exact DM conversation.
- `frontend/src/app/(main)/team-chat/page.tsx` and/or `frontend/src/components/chat/chat-layout.tsx` - honor channel selection from notification links.
- `frontend/src/lib/team-chat/*` - shared DM notification helper if warranted.
- `frontend/src/**/*.test.ts(x)` - focused guardrails for DM recipient resolution and notification deep-link behavior.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && ./node_modules/.bin/eslint src/app/api/team-chat/messages/route.ts src/app/api/team-chat/direct-messages/route.ts src/lib/team-chat/direct-messages.ts src/lib/team-chat/__tests__/direct-messages.test.ts src/lib/collaboration/notification-links.ts src/lib/collaboration/__tests__/notification-links.test.ts src/components/header/notification-bell.tsx src/components/chat/chat-layout.tsx src/components/chat/chat-main.tsx` | Pass | Targeted lint for task-owned files. |
| Targeted tests        | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/team-chat/__tests__/direct-messages.test.ts src/lib/collaboration/__tests__/notification-links.test.ts` | Pass | 2 suites / 10 tests. |
| Browser/user-flow     | Not run            | Pending | No authenticated browser proof captured in this session. |
| DB/provider read-back | `frontend/src/app/api/team-chat/messages/route.ts` now writes to `collaboration_notifications`; `frontend/src/lib/collaboration/notification-links.ts` and `frontend/src/components/chat/chat-layout.tsx` consume the same DM deep-link contract | Pass | One canonical send -> notification -> deep-link path is in code. |
| End-to-end proof      | Not run            | Pending | Need live DM send to Brandon and notification click-through proof. |

## Files Changed

- `docs/ops/tasks/2026-06-30-team-chat-dm-notifications.md` - task ledger and definition of done.
- `frontend/src/lib/team-chat/direct-messages.ts` - shared DM topic parsing and deep-link helpers.
- `frontend/src/lib/team-chat/__tests__/direct-messages.test.ts` - guardrails for DM recipient and link helpers.
- `frontend/src/app/api/team-chat/messages/route.ts` - recipient-only in-app notification on DM send plus sender warning on notification failure.
- `frontend/src/app/api/team-chat/direct-messages/route.ts` - reuses shared DM partner resolution helpers.
- `frontend/src/lib/collaboration/notification-links.ts` - routes team-chat notifications back to the exact DM channel.
- `frontend/src/lib/collaboration/__tests__/notification-links.test.ts` - guardrail for DM notification deep-link routing.
- `frontend/src/components/header/notification-bell.tsx` - uses shared notification link resolution for DM notifications.
- `frontend/src/components/chat/chat-layout.tsx` - honors `?channel=` deep links from notifications.
- `frontend/src/components/chat/chat-main.tsx` - surfaces notification-delivery warnings/errors to the sender.

## Risks / Gaps

- Existing checkout has unrelated dirty files; only task-owned files should be touched.
- `/team-chat` remains admin-only, so this notification behavior only helps users who already have access to that surface.
- Browser/user-flow proof is still missing, so live notification delivery/readback behavior has not yet been confirmed in the authenticated app.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
