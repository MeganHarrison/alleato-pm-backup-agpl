# Task: Comment Notification Workflow Cleanup

Status: In Progress
Owner: Codex
Created: 2026-07-02
Linear Issue: AAI-788
Linear URL: https://linear.app/megankharrison/issue/AAI-788/mirror-page-comment-mentions-into-team-chat-direct-messages
Related Handoff: N/A

## Objective

Replace the mixed notification/comment surfaces with one consistent comment-activity pattern: the bell and `/notifications` should render comment activity in the same row style as project notifications, and clicking a comment item should open a reply-capable discussion surface instead of a dead-end foreign panel.

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

Primary user: Alleato admin/user checking recent activity from the header bell or `/notifications`.
Primary job: scan what changed and continue the conversation from the correct surface.
Primary decision: open a project record, open the relevant discussion thread, or clear project activity noise.
Tier 1: recent human comment activity, recent human/project notifications, next action.
Tier 2: source-page navigation and page discussion reply path.
Tier 3: global comments workspace and future `/team-chat` mirroring.
Hide until requested: global comment history, raw Velt panel chrome, secondary feeds inside popovers.
Remove: embedded foreign notification card/panel, duplicate comment notification styling, generic `/team-chat` fallback for comment-like activity.
Primary action: open the relevant thread or record.
Failure-loudly behavior: if a comment item cannot deep-link into its source page discussion, the UI must still send the user to a canonical comments workspace instead of silently dumping them in `/team-chat`.

## Acceptance Criteria

- [x] Bell popover no longer embeds a second notification panel with a different visual language.
- [x] Comment activity in the bell uses the same row treatment as project notifications.
- [x] `/notifications` uses the same comment-activity row treatment instead of the Velt notifications panel.
- [x] Comment activity rows open a canonical reply-capable discussion surface owned by Alleato.
- [x] Comment activity does not fall back to `/team-chat` unless actual team-chat mirroring exists for that item.
- [x] Bell no longer uses a compact popover for feed preview; it opens a right-side panel that fits the surface budget.
- [x] The next action for comment activity is visible in five seconds.

## Failure-Loudly Behavior

- If a comment row has a source page route, clicking it opens that route with discussion visible.
- If a comment row lacks a source route, clicking it opens `/comments` rather than `/team-chat`.
- If discussion cannot auto-open on the source page, the source page still loads and preserves a visible comments entry point.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Existing shared notification row primitives reused or extracted instead of duplicating UI.
- [x] Comments workflow wiring adjusted at the shared notification/discussion seam, not via page-local hacks.
- [x] Legacy embedded Velt notification panel removed from affected surfaces.
- [x] User-facing copy/UI follows project noise gate and design doctrine rules.

## Planned Files

- `docs/ops/tasks/2026-07-02-comment-notification-workflow.md`
- `frontend/src/components/header/notification-bell.tsx`
- `frontend/src/app/(main)/notifications/page.tsx`
- `frontend/src/components/header/comments-sidebar-button.tsx`
- `frontend/src/components/notifications/*`
- `frontend/src/hooks/use-comment-activity.ts`
- `frontend/src/lib/collaboration/notification-links.ts`

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for comment activity use the same canonical row pattern and destination logic.
- [x] No page-local override added to compensate for shared primitive or integration defects.
- [x] Linear kickoff and milestone comments recorded, or blocker documented.

## Regression Guardrails

- [x] Guardrail added so comment-activity links stop falling back to `/team-chat` without explicit ownership.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Design doctrine audit scripts run on changed UI surfaces.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Linear scope | `AAI-788` | In progress | Existing issue already owns the canonical team-chat/comment-routing product decision. |
| Task gate source | `docs/tasks/TASK-TEMPLATE.md` | Pass with repo-path note | `docs/ops/tasks/TASK-TEMPLATE.md` is absent; this task mirrors the existing `docs/ops/tasks/*.md` format already in active use. |
| Targeted Jest | `cd frontend && ./node_modules/.bin/jest --runInBand --runTestsByPath src/lib/collaboration/__tests__/notification-links.test.ts src/hooks/__tests__/use-comment-activity.test.ts` | Pass | Added coverage for comment discussion hrefs and comment-activity derivation. |
| Targeted ESLint | `cd frontend && ./node_modules/.bin/eslint src/components/header/notification-bell.tsx 'src/app/(main)/notifications/page.tsx' src/components/header/comments-sidebar-button.tsx src/components/notifications/activity-feed.tsx src/hooks/use-comment-activity.ts src/lib/collaboration/notification-links.ts` | Pass | No lint errors on changed notification/comment surfaces. |
| Changed-file type guard | `cd frontend && npm run typecheck:changed -- --files src/components/header/notification-bell.tsx 'src/app/(main)/notifications/page.tsx' src/components/header/comments-sidebar-button.tsx src/components/notifications/activity-feed.tsx src/hooks/use-comment-activity.ts src/lib/collaboration/notification-links.ts` | Pass | No new `any` debt introduced. |
| Design doctrine audit | `node .agents/skills/alleato-design-doctrine/scripts/audit-surface-complexity.mjs frontend/src/components/header/notification-bell.tsx 'frontend/src/app/(main)/notifications/page.tsx' frontend/src/components/header/comments-sidebar-button.tsx frontend/src/components/notifications/activity-feed.tsx` | Pass | Bell moved out of a popover into a right-side panel; all touched UI surfaces pass the doctrine gate. |
| Browser proof: notifications page entry points | `agent-browser --session-name alleato-notifications open http://localhost:3001/notifications` + `snapshot -i` | Partial pass | Authenticated snapshot showed `Notifications` header button, `All comments` link, and the new notifications page tabs on live localhost. |
| Browser proof: full panel + discussion auto-open | `agent-browser` follow-up and Playwright one-off | Blocked in automation | Local authenticated navigation/hydration is flaky in automation: `agent-browser` hangs on later snapshots and Playwright hit `page.goto: net::ERR_ABORTED` / timeout on `/notifications`. Need live browser readback before calling the UX fully verified. |

## Files Changed

- `docs/ops/tasks/2026-07-02-comment-notification-workflow.md` - task gate and evidence ledger.
- `frontend/src/components/header/notification-bell.tsx` - replaced the bell popover with a right-side notifications panel and unified activity feed rows.
- `frontend/src/app/(main)/notifications/page.tsx` - replaced the Velt block with Alleato-owned comment-activity rows and reused the shared feed rendering.
- `frontend/src/components/header/comments-sidebar-button.tsx` - added `?discussion=` deep-link auto-open behavior and a clearer reply-on-page discussion panel.
- `frontend/src/components/notifications/activity-feed.tsx` - shared notification/comment row primitive and loading/empty states.
- `frontend/src/hooks/use-comment-activity.ts` - canonical comment-activity derivation from `/api/comments/all`.
- `frontend/src/lib/collaboration/notification-links.ts` - explicit source-page discussion href helper for comment activity.
- `frontend/src/lib/collaboration/__tests__/notification-links.test.ts` - guardrail coverage for comment discussion links.
- `frontend/src/hooks/__tests__/use-comment-activity.test.ts` - guardrail coverage for mention/reply activity derivation.

## Risks / Gaps

- `/team-chat` still does not own page-comment threads today; true DM/thread mirroring remains follow-on work under `AAI-788`.
- Live localhost browser proof is still partial because automated authenticated navigation is unstable in this environment.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
