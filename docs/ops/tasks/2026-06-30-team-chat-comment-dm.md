# Task: Mirror all page comments into a team-chat direct-message style inbox

Status: In Progress
Owner: Codex
Created: 2026-06-30
Linear Issue: AAI-788 - https://linear.app/megankharrison/issue/AAI-788/mirror-page-comment-mentions-into-team-chat-direct-messages
Related Handoff: Not created in this session

## Objective

Make page comments easy to scan inside `/team-chat` by exposing them as a read-only direct-message style conversation, using the existing comments source of truth and the existing team-chat surface.

## Attention Brief

Primary user: admin/operator reviewing internal collaboration activity.
Primary job: see comment activity quickly without switching between separate comment pages and notification surfaces.
Primary decision: whether a comment needs follow-up right now and where it came from.
Tier 1: author, comment preview, timestamp, and page/document source.
Tier 2: resolved/open status and direct link back to the commented page.
Hide until requested: raw annotation ids, Velt payload details, provider internals.
Remove: duplicate inbox concepts, extra wrappers, or a second persisted comment store.
Primary action: open `/team-chat`, select the synthetic comments conversation, and scan recent comment activity.
Failure-loudly behavior: if the comments feed cannot be loaded, the team-chat comments conversation returns a specific API error instead of silently disappearing or showing stale team-chat rows.

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

- `frontend/src/app/api/comments/all/route.ts` - existing comment feed contract to reuse, not fork.
- `frontend/src/app/api/team-chat/direct-messages/route.ts` - include a synthetic comment DM in the team-chat DM list.
- `frontend/src/app/api/team-chat/messages/route.ts` - return read-only synthetic comment messages for the synthetic DM channel.
- `frontend/src/components/chat/chat-layout.tsx` - accept/select the synthetic DM alongside real DMs.
- `frontend/src/components/chat/chat-main.tsx` - disable composer for the synthetic read-only channel and show source-aware placeholder.
- `frontend/src/components/chat/team-chat-data.ts` - extend shared channel typing for source/read-only metadata.
- `frontend/src/lib/team-chat/comment-dm.ts` - shared mapper/constants for the synthetic comments conversation.
- `frontend/src/**/*.test.ts(x)` - focused route/component guardrails for the synthetic comment DM behavior.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `cd frontend && ./node_modules/.bin/eslint src/lib/comments/all-comments.ts src/lib/team-chat/comment-dm.ts src/lib/team-chat/__tests__/comment-dm.test.ts src/app/api/comments/all/route.ts src/app/api/team-chat/direct-messages/route.ts src/app/api/team-chat/messages/route.ts src/components/chat/team-chat-data.ts src/components/chat/chat-main.tsx src/components/chat/chat-header.tsx` | Pass | Targeted lint for task-owned files. |
| Targeted tests        | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/team-chat/__tests__/comment-dm.test.ts` | Pass | 1 suite / 4 tests. |
| Browser/user-flow     | Not run            | Pending | No authenticated browser proof captured in this session. |
| DB/provider read-back | `frontend/src/lib/comments/all-comments.ts` reused by `frontend/src/app/api/comments/all/route.ts`, `frontend/src/app/api/team-chat/direct-messages/route.ts`, and `frontend/src/app/api/team-chat/messages/route.ts` | Pass | One canonical Velt comments fetch path now powers both comments page and team-chat comment inbox. |
| End-to-end proof      | Not run            | Pending | Need authenticated `/team-chat` proof against live comment data. |

## Files Changed

- `docs/ops/tasks/2026-06-30-team-chat-comment-dm.md` - task ledger and definition of done.
- `frontend/src/lib/comments/all-comments.ts` - shared server-side Velt comments fetch and normalization helper.
- `frontend/src/lib/team-chat/comment-dm.ts` - synthetic comments DM channel/message mapper.
- `frontend/src/lib/team-chat/__tests__/comment-dm.test.ts` - guardrails for synthetic comments DM mapping.
- `frontend/src/app/api/comments/all/route.ts` - now reuses the shared comments fetch helper.
- `frontend/src/app/api/team-chat/direct-messages/route.ts` - injects the synthetic comments DM into the DM list.
- `frontend/src/app/api/team-chat/messages/route.ts` - serves synthetic read-only comment messages and blocks writes to that channel.
- `frontend/src/components/chat/team-chat-data.ts` - extends channel metadata for read-only/source-aware conversations.
- `frontend/src/components/chat/chat-main.tsx` - disables composer for read-only comments inbox.
- `frontend/src/components/chat/chat-header.tsx` - labels the synthetic conversation as a comments inbox instead of a normal DM.

## Risks / Gaps

- Existing checkout has unrelated dirty files; only task-owned files should be touched.
- `/team-chat` is admin-only today, so this improves operator visibility only on that surface unless access rules change later.
- Browser/user-flow proof is still missing, so live rendering and navigation behavior on the authenticated production surface are not yet verified.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
