# Handoff: 2026-06-25 - Intercom-Style AI Widget MVP

## Intake Block

1) Session ID: S92
2) Task ID: 2026-06-25-ai-widget-mvp-handoff
3) Linear issue: AAI-647
4) Linear URL: https://linear.app/megankharrison/issue/AAI-647/create-implementation-handoff-for-intercom-style-ai-widget-mvp
5) Current status: Ready for implementation by a follow-on session.
6) Files changed (absolute paths):
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/tasks/2026-06-25-ai-widget-mvp-handoff.md`
   - `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md`
7) Commands run and outcome (pass/fail counts):
   - Research/source pass: pass. Sources listed in the Research Requirements section.
   - Current-code inspection: pass. Widget entry points listed below.
   - `git diff --check -- docs/ops/tasks/2026-06-25-ai-widget-mvp-handoff.md docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md`: pending at handoff draft time; run before final closeout.
8) Evidence artifacts (screenshot/video/report/log paths):
   - This handoff: `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md`
   - Required future implementation evidence root: `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-widget-mvp/`
9) Top 3 findings (frontend-visible issues first):
   - The global AI widget already exists and floats on app pages; improve it in place instead of creating a second widget.
   - The widget already supports an unread dot through `hasUnread`, but that only fires after assistant activity, so a proactive welcome MVP needs its own explicit trigger.
   - There is an existing collaboration notification system; use it for the durable notification path rather than inventing a separate notification model.
10) Recommended next action (one line): Research best-in-class chat widget examples with screenshots, then implement a localStorage-backed owner-demo welcome notification inside the existing `GlobalAiWidget`.
11) Handoff file path: `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md`
12) Migration ledger evidence: Not applicable. No database migration is part of this handoff.

## Linear Updates

- Kickoff comment: Create and link this handoff to AAI-647 before implementation starts.
- Milestone comments: Post after research screenshots are captured, after MVP widget changes land, and after browser verification.
- Completion/blocker comment: Must include changed files, screenshot paths, commands, owner-demo route verified, risks, and next action.

## Goal

Improve the existing floating Alleato AI chat widget into a more polished Intercom-style assistant surface and ship a quick MVP welcome/proactive notification that is visible when an owner logs in. The MVP should feel intentional, quiet, and useful, not like a marketing pop-up or a second chat system.

The immediate demo outcome:

- The owner sees the AI widget on normal app pages.
- The closed launcher can show an unread/welcome indicator.
- Opening the widget shows a concise welcome message with a few obvious actions.
- The user can start from that message without leaving the current page.
- The welcome prompt does not repeatedly nag after it has been seen or dismissed.

## Current Architecture

Use the existing widget. Do not add a new floating assistant.

Primary files:

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/root-client-widgets.tsx`
  - Dynamically mounts `GlobalAiWidget` after `useDeferredMount(6_000)`.
  - Also mounts feedback and Velt overlays. Watch z-index and bottom-right placement conflicts.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/global-ai-widget.tsx`
  - Owns launcher, panel, route hiding, focus trap, open/closed state, expanded state, and unread dot.
  - `shouldHideForRoute()` hides the widget on auth, `/ai`, `/ai/*`, `/ai-assistant`, `/ai-avatar`, `/team-chat`, and drawing viewer routes.
  - `hasUnread` currently renders the red dot on the launcher.
  - `handleAssistantActivity()` sets unread only when an assistant response finishes while the panel is closed.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/widget-ai-chat.tsx`
  - Reuses the full `/api/ai-assistant/chat` transport, persisted RAG conversations, project picker, file attachments, model selector, and council mode.
  - Session state is local to the widget so the user stays on the current page.
  - Calls `onAssistantActivity` from `handleFinishMessage()`.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/chat-area.tsx`
  - Owns the chat messages, welcome state, composer, project/model controls, and streaming UI used by both widget and full assistant.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/welcome-screen.tsx`
  - Existing welcome surface to reuse or extend if the MVP needs compact action prompts.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/globals.css`
  - Owns `.global-ai-widget-launcher`, `.global-ai-widget-panel`, and expanded sizing.

Existing notification surface:

- `/Users/meganharrison/Documents/alleato-pm/frontend/src/hooks/use-collaboration-notifications.ts`
  - Fetches `/api/collaboration/notifications`, subscribes to Supabase realtime on `collaboration_notifications`, and exposes unread count/actions.
- `/Users/meganharrison/Documents/alleato-pm/frontend/src/app/(main)/notifications/page.tsx`
  - Existing notifications page and list behavior.

## Recommended Approach

Use a two-stage approach.

1. Quick MVP for owner demo (recommended now)
   - Implement a client-side welcome/proactive notification inside the existing global widget.
   - Use a localStorage key so it appears once per user/browser and does not nag:
     - Suggested key: `alleato-ai-widget-welcome-seen-v1`
   - Trigger only on normal app pages where `GlobalAiWidget` is visible.
   - Set the existing `hasUnread` state when the panel is closed and the welcome has not been seen.
   - When the user opens the widget, show a compact welcome message at the top of the chat welcome state and clear the unread dot.
   - Provide a dismiss/seen path, stored immediately.

2. Durable notification path (next iteration)
   - Wire AI assistant notifications into the existing `collaboration_notifications` system and `useCollaborationNotifications`.
   - Add a typed notification kind such as `ai_assistant_welcome`, `ai_action_ready`, `rfi_attention`, or `change_request_review_needed`.
   - Add routing rules for quiet vs interruption paths based on the notification matrix.
   - Avoid creating a second notification database, polling service, or widget-specific notification API.

Why this is recommended:

- It makes the owner demo live quickly.
- It avoids a one-off notification architecture.
- It reuses the existing floating widget and AI chat transport.
- It gives a clear upgrade path into the platform notification system.

## Research Requirements Before UI Changes

Before changing UI, research and save screenshots from at least four current best-in-class messenger/widget examples. Do not implement from memory.

Required research outputs:

- Save screenshots to:
  - `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-widget-mvp/research/`
- Create:
  - `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-widget-mvp/research/research-sources.md`
- Each source entry must include:
  - Product name
  - URL
  - Screenshot filename
  - What pattern is worth copying
  - What pattern is too noisy for Alleato

Minimum examples to inspect:

- Intercom Messenger
  - Source: https://www.intercom.com/
  - Look for: launcher treatment, compact open panel, welcome tone, action suggestions, AI agent positioning.
- Zendesk Messaging / Web Widget
  - Source: https://support.zendesk.com/hc/en-us/articles/5511266103834-Creating-proactive-messages-for-the-Web-Widget
  - Source: https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/web/messaging-web-widget-qs/
  - Look for: proactive message conditions, custom launcher patterns, unread/count behavior.
- Help Scout Beacon
  - Source: https://docs.helpscout.com/article/1250-beacon-jumpstart-guide
  - Source: https://docs.helpscout.com/article/1406-advanced-beacon-customization
  - Look for: combined help/chat/docs surface, quiet proactive messages, compact list-first design.
- Crisp
  - Source: https://help.crisp.chat/en/article/how-to-change-the-chatbox-welcome-message-1ja9m16/
  - Source: https://crisp.chat/en/blog/live-chat-welcome-message-best-tips-greetings/
  - Look for: welcome message configuration, proactive vs reactive greeting distinction.

Evaluate each screenshot against:

- Launcher size, placement, icon, badge treatment.
- Welcome message length and tone.
- Whether actions are obvious without creating decision fatigue.
- How proactive messages avoid feeling interruptive.
- Keyboard and screen-reader behavior.
- Mobile panel sizing and safe-area behavior.
- Empty/loading/error states.

Do not copy decorative gradients, oversized illustrations, emoji-heavy greetings, or marketing-style copy.

## MVP User Experience

Primary user:

- Owner, executive, PM, or project team member logging into a normal app page.

Primary job:

- Quickly understand that Alleato AI can help with real project work and start a useful workflow without searching.

Primary decision:

- "What can I ask the assistant to do from here?"

Tier 1 content:

- Concise welcome line.
- 3 to 4 action chips max.
- Composer remains the primary action.
- Current page/project context should be preserved.

Recommended welcome copy:

```text
Welcome back. I can help create RFIs, draft change events, generate progress reports, or find project evidence.
```

Recommended action chips:

- Create an RFI
- Create a change event
- Generate a progress report
- Find project evidence

Behavior:

- Closed launcher shows unread indicator when a welcome prompt is available.
- Opening the widget clears unread.
- Welcome prompt is marked seen when opened or dismissed.
- Welcome prompt does not reappear on every navigation.
- If project/user context cannot be loaded, show a specific inline state:
  - `Assistant context unavailable. Retry or open the full AI workspace.`

## Implementation Instructions

1. Create the implementation task file before coding.
   - Use `docs/tasks/TASK-TEMPLATE.md`.
   - Save under `docs/ops/tasks/YYYY-MM-DD-ai-widget-mvp.md`.
   - Link Linear issue AAI-647 or create a child Linear issue if the implementation session splits the work.

2. Capture research evidence first.
   - Use the sources listed above.
   - Use `agent-browser` or browser screenshots where possible.
   - Save screenshots and `research-sources.md` before editing UI.

3. Keep the implementation in existing widget files.
   - Prefer these files:
     - `frontend/src/components/ai-assistant/global-ai-widget.tsx`
     - `frontend/src/components/ai-assistant/widget-ai-chat.tsx`
     - `frontend/src/components/ai-assistant/chat-area.tsx`
     - `frontend/src/components/ai-assistant/welcome-screen.tsx`
     - `frontend/src/app/globals.css`
   - Do not add a new top-level floating widget.
   - Do not add a page-local widget.

4. Add a small shared hook only if it keeps the behavior clean.
   - Suggested file if needed:
     - `frontend/src/components/ai-assistant/use-ai-widget-welcome-notification.ts`
   - Responsibilities:
     - Check localStorage safely after mount.
     - Determine whether the route is eligible.
     - Expose `shouldShowWelcome`, `markWelcomeSeen`, and `markDismissed`.
     - Fail loudly in development if storage access throws unexpectedly; do not silently swallow context errors.

5. Wire unread state intentionally.
   - `hasUnread` should become true when:
     - Widget is closed.
     - Route is eligible.
     - Welcome has not been seen.
   - `hasUnread` should clear when:
     - Widget opens.
     - Welcome is dismissed.
     - Welcome is marked seen.

6. Add the visible welcome state.
   - Prefer extending existing welcome behavior rather than adding a new card stack.
   - Keep the visible surface compact.
   - Use shared `Button` primitives and existing typography tokens.
   - Use `lucide-react` icons only where they improve scanning.
   - Avoid nested cards, decorative wrappers, heavy shadows, gradients, emojis, or duplicated CTAs.

7. Action chips should seed useful prompts.
   - Clicking `Create an RFI` can put a starter prompt in the composer or immediately submit if the existing chat flow supports it cleanly.
   - Recommended starter prompts:
     - `Help me create a new RFI for this project.`
     - `Help me draft a change event for this project.`
     - `Generate a progress report for this project.`
     - `Find source evidence for the current project status.`
   - Preview-first rule still applies for anything that creates business records. The assistant must not commit RFIs, commitments, or change records without explicit user approval.

8. Durable notification follow-up.
   - If time allows after the demo MVP, inspect `/api/collaboration/notifications` and `collaboration_notifications`.
   - Add a follow-up issue for routing AI notifications through the existing notification service.
   - Do not block the quick owner demo on a database-backed notification fanout unless the MVP is already complete.

## Acceptance Criteria

- The global AI widget still appears on normal app pages and stays hidden on routes already excluded by `shouldHideForRoute()`.
- A first-time eligible user sees a welcome/unread indicator without taking action.
- Opening the widget shows the welcome message and action chips.
- The welcome is remembered and does not repeatedly reappear after open/dismiss.
- The user can click an action chip and get a useful starter prompt or submitted message.
- Existing chat session creation and assistant responses still work.
- Full `/ai` assistant page behavior is not regressed.
- The UI passes Alleato product noise gate:
  - No nested cards.
  - No duplicate primary CTA.
  - No decorative helper panels.
  - No emoji-heavy or marketing copy.
  - No full-page wrapper changes.
- The implementation fails loudly:
  - Context/API/storage failures produce a specific user-visible or developer-visible error.
  - No silent no-op if the assistant cannot access project/user context.

## Verification Commands

Use short targeted checks in the implementation session:

```bash
cd /Users/meganharrison/Documents/alleato-pm
git diff --check -- frontend/src/components/ai-assistant frontend/src/app/globals.css
```

```bash
cd /Users/meganharrison/Documents/alleato-pm/frontend
npx eslint src/components/ai-assistant/global-ai-widget.tsx src/components/ai-assistant/widget-ai-chat.tsx src/components/ai-assistant/chat-area.tsx src/components/ai-assistant/welcome-screen.tsx
```

Browser verification, using the repo's default browser policy:

```bash
cd /Users/meganharrison/Documents/alleato-pm
npm run dev:frontend
```

Then in another terminal:

```bash
agent-browser open http://localhost:3001/25125/home
agent-browser snapshot -i
agent-browser click <ai-widget-launcher-ref>
agent-browser snapshot -i
```

Required screenshots/artifacts:

- Closed launcher with unread indicator.
- Open widget showing welcome message.
- Action chip interaction.
- Mobile viewport open widget.
- Evidence saved under `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-widget-mvp/`.

If a long build or full predeploy is needed, delegate it to a cheaper sub-agent per AGENTS instructions and keep the main implementation session focused on targeted fixes.

## Known Pitfalls

- `GlobalAiWidget` is dynamically mounted after six seconds in `RootClientWidgets`. Do not mistake delayed mount for a broken widget.
- `handleAssistantActivity()` currently only sets unread after a response finishes while the widget is closed. It will not create a proactive welcome by itself.
- The widget hides on `/ai`, `/ai/*`, `/ai-assistant`, `/ai-avatar`, `/team-chat`, auth routes, and drawing viewer routes. Verify on a normal project page such as `/25125/home`.
- The widget panel uses very high z-index while the launcher uses z-index 40. Check conflicts with feedback and Velt overlays.
- The existing chat is backed by persisted RAG conversations. Do not bypass `/api/ai-assistant/chat`.
- The full assistant page and widget share components. Changes to `ChatArea` or `WelcomeScreen` can affect `/ai`; verify both if those files change.
- Do not introduce a local one-off notification API. Quick MVP can be localStorage-backed, but durable notifications should route through `collaboration_notifications`.
- Do not start with database migration work. The owner-demo goal is a visible widget welcome MVP first.
- Docs are ignored by `.gitignore` in this repo. If this handoff needs to be committed, force-add intentionally or use the repo's documented finish flow with exact files.

## Resume Commands

```bash
cd /Users/meganharrison/Documents/alleato-pm
sed -n '1,260p' docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md
nl -ba frontend/src/components/ai-assistant/global-ai-widget.tsx | sed -n '1,280p'
nl -ba frontend/src/components/ai-assistant/widget-ai-chat.tsx | sed -n '1,340p'
nl -ba frontend/src/hooks/use-collaboration-notifications.ts | sed -n '1,210p'
nl -ba frontend/src/app/globals.css | sed -n '1870,1945p'
```

## Out Of Scope For This MVP

- Full Teams/Outlook notification fanout.
- AI approval queue for committing RFIs, commitments, or change events.
- Database-backed AI notification routing unless the demo MVP is already complete.
- Replacing the AI assistant transport.
- Redesigning the full `/ai` command center.

## Evidence

Research sources used for this handoff:

- Intercom: https://www.intercom.com/
- Zendesk proactive messages: https://support.zendesk.com/hc/en-us/articles/5511266103834-Creating-proactive-messages-for-the-Web-Widget
- Zendesk custom launcher docs: https://developer.zendesk.com/documentation/zendesk-web-widget-sdks/sdks/web/messaging-web-widget-qs/
- Help Scout Beacon jumpstart: https://docs.helpscout.com/article/1250-beacon-jumpstart-guide
- Help Scout advanced Beacon customization: https://docs.helpscout.com/article/1406-advanced-beacon-customization
- Crisp welcome message docs: https://help.crisp.chat/en/article/how-to-change-the-chatbox-welcome-message-1ja9m16/
- Crisp welcome message best practices: https://crisp.chat/en/blog/live-chat-welcome-message-best-tips-greetings/

Current-code evidence:

- `GlobalAiWidget` owns the launcher/panel/unread behavior.
- `WidgetAiChat` reuses persisted RAG conversations and `/api/ai-assistant/chat`.
- `useCollaborationNotifications` already provides the durable notification hook.
- `globals.css` owns panel and launcher sizing/positioning.
