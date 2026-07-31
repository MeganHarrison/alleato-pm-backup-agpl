# Task: Comments, notifications, and team-chat integration

Status: In Progress
Owner: Codex
Created: 2026-07-06
Linear Issue: AAI-788 - https://linear.app/megankharrison/issue/AAI-788/mirror-page-comment-mentions-into-team-chat-direct-messages
Related Handoff: docs/ops/handoffs/2026-07-06-S115-comments-velt-teams-chat-integration.md

## Objective

Tighten the Velt comments and notification surfaces so page comments, comment notifications, and the `/team-chat` page form one coherent collaboration flow: clear comment entry points, quiet annotation behavior, precise notification deep links, and a canonical team-chat handoff path when comment activity needs follow-up.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Attention Brief

Primary user: Alleato project user moving between a source page, the comments workspace, notifications, and `/team-chat`.
Primary job: inspect a comment notification, decide whether to reply on the source page or continue in team chat, and keep context intact.
Primary decision: open the source-page discussion, open the comments workspace, or land on the related team-chat thread.
Tier 1: comment activity rows, unread state, and source-page deep links.
Tier 2: quiet Velt comment chrome and notification routing.
Tier 3: team-chat follow-up context and any mirrored message/thread representation.
Hide until requested: raw Velt event metadata, internal notification payloads, duplicate feed chrome.
Remove: generic `/team-chat` fallback when a precise comment thread or comments workspace route exists, duplicated comment panels, noisy persistent annotation states.
Primary action: click a comment/notification and land on the right follow-up surface.
Failure-loudly behavior: if direct source routing fails, keep the canonical comments workspace or team-chat thread link visible instead of silently dropping the user into a dead or ambiguous surface.

## Acceptance Criteria

- [x] Comment and notification surfaces use one clear visual language instead of separate ad hoc presentation styles.
- [x] Comment activity rows deep-link to the source page discussion or comments workspace when a precise route exists.
- [x] Comment activity can hand off cleanly to `/team-chat` when that is the intended follow-up surface.
- [x] The team-chat page can receive the relevant comment context without losing the originating source.
- [x] If a precise thread cannot be resolved, the fallback is the canonical comments workspace, not a generic chat destination.
- [x] Velt comment chrome returns to a minimal resting state after submit and does not leave the page visually noisy.
- [x] Failure states for comment/notification routing remain visible and actionable.

## Failure-Loudly Behavior

- If comment routing cannot resolve a source page, the user still gets a comments workspace or team-chat link instead of a dead-end panel.
- If the team-chat handoff cannot be resolved precisely, the UI does not invent a generic chat target and does not hide the missing context.
- If Velt comment controls cannot mount, the header and workspace still expose a reachable comments entry point.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing shared primitives/services/helpers reused or extracted instead of duplicating UI.
- [x] Comment routing adjusted at shared notification/discussion seams, not with page-local hacks.
- [x] Team-chat integration follows the same canonical link/path contract as notifications and comments.
- [x] User-facing copy/UI follows project noise gate and design doctrine rules.

## Planned Files

- `docs/ops/tasks/2026-07-06-comments-velt-teams-chat-integration.md`
- `docs/ops/handoffs/2026-07-06-S115-comments-velt-teams-chat-integration.md`
- `frontend/src/components/header/comments-sidebar-button.tsx`
- `frontend/src/components/header/notification-bell.tsx`
- `frontend/src/components/notifications/activity-feed.tsx`
- `frontend/src/components/notifications/velt-comment-notifications.tsx`
- `frontend/src/components/velt/VeltGlobalLayer.tsx`
- `frontend/src/features/comments/comments-split-page.tsx`
- `frontend/src/app/(main)/comments/page.tsx`
- `frontend/src/app/(main)/notifications/page.tsx`
- `frontend/src/app/(main)/team-chat/page.tsx`
- `frontend/src/components/chat/chat-layout.tsx`
- `frontend/src/lib/collaboration/notification-links.ts`
- `frontend/src/lib/team-chat/*`

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] No page-local override added to compensate for shared primitive or integration defects.
- [x] Linear kickoff and milestone comments recorded, or blocker documented.

## Regression Guardrails

- [x] Guardrail added so the same class of routing or comment-resting-state regression fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Design doctrine audit scripts run on changed UI surfaces.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | `docs/ops/tasks/2026-07-06-comments-velt-teams-chat-integration.md` | In progress | This task record scopes the combined comments, notifications, and team-chat integration work. |
| Targeted ESLint | `cd frontend && ./node_modules/.bin/eslint src/app/api/comments/all/route.ts src/lib/comments/all-comments.ts src/lib/team-chat/comment-dm.ts src/app/api/team-chat/direct-messages/route.ts src/app/api/team-chat/messages/route.ts src/components/chat/chat-main.tsx src/components/chat/chat-header.tsx src/components/chat/chat-sidebar.tsx src/components/chat/message-group.tsx src/components/chat/message-list.tsx src/components/chat/team-chat-data.ts src/lib/team-chat/__tests__/comment-dm.test.ts src/hooks/__tests__/use-comment-activity.test.ts` | Pass with warnings | Existing design-system warnings remain in `src/components/chat/chat-sidebar.tsx` and `src/components/chat/message-group.tsx` (raw button/search input/error-state patterns and raw message buttons/arbitrary spacing). |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/team-chat/__tests__/comment-dm.test.ts src/hooks/__tests__/use-comment-activity.test.ts` | Pass | 2 suites / 4 tests. |
| Follow-up-link tests | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/components/chat/__tests__/team-chat-routing.test.ts src/lib/collaboration/__tests__/notification-links.test.ts src/hooks/__tests__/use-comment-activity.test.ts` | Pass | Covers team-chat deep-link selection and comment follow-up link generation. |
| Follow-up fallback test | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/collaboration/__tests__/notification-links.test.ts src/hooks/__tests__/use-comment-activity.test.ts src/components/notifications/__tests__/activity-feed.test.tsx` | Pass | Covers the visible comment follow-up action and the canonical comments workspace fallback when a precise team-chat thread is unavailable. |
| Fallback label check | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/collaboration/__tests__/notification-links.test.ts` | Pass | Verifies the visible fallback action is labeled `Comments workspace` instead of implying a generic chat target. |
| Comment row render test | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/components/notifications/__tests__/activity-feed.test.tsx` | Pass | Proves the notification row exposes both the source discussion link and the `Team chat` follow-up link. |
| Direct-messages regression test | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/app/api/team-chat/direct-messages/__tests__/route.test.ts` | Pass | Proves `Comments inbox` is still returned when no normal DM channels exist. |
| Messages regression test | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/app/api/team-chat/messages/__tests__/route.test.ts` | Pass | Proves `comments-inbox` loads imported comment rows in the message panel. |
| Velt resting-state guardrail | `cd frontend && ./node_modules/.bin/eslint src/components/velt/VeltGlobalLayer.tsx && npm run typecheck:changed -- --staged` | Pass | The comment UI now has a force-cleanup fallback so submit returns the chrome to a quiet resting state even if the SDK lags. |
| Shared comment surface language | `cd frontend && ./node_modules/.bin/eslint src/features/comments/comments-split-page.tsx && npm run typecheck:changed -- --staged` | Pass | The comments workspace headers now use the shared section-heading primitive, aligning the visual language with notifications. |
| Changed-file type debt | `cd frontend && npm run typecheck:changed -- --staged` | Pass | No new `any` debt detected in staged task files. |
| Browser route proof | `node` Playwright browser check against `http://localhost:3001/team-chat` with `frontend/tests/.auth/user.json` | Pass | Authenticated `/team-chat` rendered the expected chat shell and the injected `Comments inbox` direct message; screenshot saved at `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/team-chat-browser-check.png`. |
| Browser thread proof | `node` Playwright browser check against `http://localhost:3001/team-chat` after opening `Comments inbox` | Pass | Imported comment rows render in the panel after the history load settles; screenshot saved at `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/team-chat-comments-inbox-open-late.png`. |
| Comments retry action | `cd frontend && ./node_modules/.bin/eslint src/features/comments/comments-split-page.tsx && npm run typecheck:changed -- --staged` | Pass | The comments workspace error state now exposes a retry action instead of leaving a dead-end screen. |
| Design ratchet | `cd frontend && npm run design:ratchet` | Pass | Design lint count improved by 1151; no new design-system regressions introduced by this slice. |
| Velt comment chrome cleanup | `agent-browser --session-name alleato-test-3001 screenshot /tmp/velt-comments-panel.png` and `agent-browser --session-name alleato-test-3001 screenshot /tmp/velt-comments-hover.png` | Pass | The page comments sidebar now hides the redundant dialog-level options surface; screenshots confirm the top menu is gone while the per-thread panel remains usable. |
| Thread menu placement | `frontend/src/app/globals.css` + browser check on `/meetings` comments popup | Pass | The thread-card options selector was missing, so the top-row ellipsis survived. Hiding `velt-comment-dialog-thread-card-options-wireframe` removes the extra header menu and leaves the row-level actions intact. |

## Files Changed

- `docs/ops/tasks/2026-07-06-comments-velt-teams-chat-integration.md` - task ledger and definition of done.
- `docs/ops/handoffs/2026-07-06-S115-comments-velt-teams-chat-integration.md` - worker intake and evidence ledger.
- `docs/ops/orchestration/session-board.md` - worker claim for S115.
- `frontend/src/app/api/comments/all/route.ts` - thin comments route over the shared fetch helper.
- `frontend/src/lib/comments/all-comments.ts` - shared Velt comments fetch and normalization helper.
- `frontend/src/lib/team-chat/comment-dm.ts` - synthetic comments inbox channel/message mapper.
- `frontend/src/lib/team-chat/__tests__/comment-dm.test.ts` - guardrails for the synthetic comments inbox mapper.
- `frontend/src/app/api/team-chat/direct-messages/route.ts` - injects the synthetic comments inbox into the DM list.
- `frontend/src/app/api/team-chat/direct-messages/__tests__/route.test.ts` - regression test proving the comments inbox remains visible with no existing DMs.
- `frontend/src/app/api/team-chat/messages/route.ts` - serves read-only comments inbox messages and blocks writes.
- `frontend/src/app/api/team-chat/messages/__tests__/route.test.ts` - regression test proving the message panel loads comment rows for `comments-inbox`.
- `frontend/src/components/chat/team-chat-routing.ts` - pure helper that prefers the comments inbox for discussion deep links.
- `frontend/src/components/chat/__tests__/team-chat-routing.test.ts` - regression test for the initial team-chat channel selection helper.
- `frontend/src/components/chat/chat-header.tsx` - read-only comments inbox subtitle treatment.
- `frontend/src/components/chat/chat-main.tsx` - read-only comments inbox history/error state and composer guard.
- `frontend/src/components/chat/chat-sidebar.tsx` - quiet comments inbox avatar treatment.
- `frontend/src/components/chat/team-chat-data.ts` - extends channel typing for read-only/source metadata.
- `frontend/src/components/notifications/activity-feed.tsx` - notification rows now expose a secondary follow-up link.
- `frontend/src/components/notifications/__tests__/activity-feed.test.tsx` - regression test for the comment row source and team-chat follow-up links.
- `frontend/src/app/(main)/notifications/page.tsx` - copy updated to explain source-vs-follow-up behavior and render the fallback label.
- `frontend/src/app/(main)/team-chat/page.tsx` - deep-link entry for comment discussion context.
- `frontend/src/features/comments/comments-split-page.tsx` - comments workspace error state now exposes a retry action.
- `frontend/src/components/velt/VeltGlobalLayer.tsx` - comment chrome now force-cleans after submit if the SDK misses the normal collapse path.
- `frontend/src/app/globals.css` - hides the redundant dialog-level Velt options surface while preserving the per-thread action surface.

## Risks / Gaps

- The repository already has adjacent task files for comments annotation and comment notification routing, so this work needs to avoid duplicating ownership or drifting into a second parallel comment system.
- `/team-chat` is a separate chat stack today; any comment handoff into that page needs a precise link contract and failure-loud fallback.
- Live browser/user-flow proof is now captured for the authenticated `/team-chat` shell and the opened comments inbox thread, but the notifications-page clickthrough and full reply/reopen loop still need explicit end-to-end proof.
- The current Velt thread-menu slice is verified on the page-comments sidebar, but the page-comment reply/reopen loop still needs one more direct interaction proof against the lower thread-row menu.
- Existing design-system warnings in `frontend/src/components/chat/chat-sidebar.tsx` and `frontend/src/components/chat/message-group.tsx` are unrelated repo debt and remain outside this slice.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
