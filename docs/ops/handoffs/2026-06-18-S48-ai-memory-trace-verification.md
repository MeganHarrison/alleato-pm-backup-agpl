# Handoff: 2026-06-18 — AI Memory Trace Verification

## Intake Block

1) Session ID: S48
2) Task ID: AAI-533
3) Linear issue: AAI-533
4) Linear URL: https://linear.app/megankharrison/issue/AAI-533/run-browser-verification-and-adoption-demo-for-ai-os
5) Current status: Accepted
6) Files changed (absolute paths): `/Users/meganharrison/Documents/alleato-pm/docs/ops/handoffs/2026-06-18-S48-ai-memory-trace-verification.md`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/rag-chat-page.tsx`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/memory-usage-metadata.ts`, `/Users/meganharrison/Documents/alleato-pm/frontend/src/components/ai-assistant/__tests__/rag-chat-page-memory-usage.test.ts`, `/Users/meganharrison/Documents/alleato-pm/tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/*`, `/Users/meganharrison/Documents/alleato-pm/tests/agent-browser-runs/2026-06-18-ai-memory-trace-mobile/*`, `/Users/meganharrison/Documents/alleato-pm/tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/*`
7) Commands run and outcome (pass/fail counts): 24 pass, 1 initial verification fail remediated (memory-backed metadata persisted but memory-trace UI controls did not render until the message-ID mapping fix)
8) Evidence artifacts (screenshot/video/report/log paths): `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/**`, `tests/agent-browser-runs/2026-06-18-ai-memory-trace-mobile/**`, `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/**`
9) Top 3 findings (frontend-visible issues first):
   - Initial desktop/mobile browser verification found persisted `memory_usage.totalUsed = 3` but no visible `Memory used`, `Review memory`, or wrong-memory controls.
   - Root cause was message-ID drift: post-stream UI retained the AI SDK response message ID while persisted metadata was only indexed by the database row ID.
   - Rerun verified the memory trace renders on desktop and mobile, expands without overflow, and queues wrong-memory feedback from the answer trace.
10) Recommended next action (one line): Build the next AI OS slice: Teach Alleato intake or the read-only parent-child work-run ledger, depending on whether adoption or runtime autonomy is the higher priority.
11) Handoff file path: `docs/ops/handoffs/2026-06-18-S48-ai-memory-trace-verification.md`
12) Migration ledger evidence: Not applicable unless this worker unexpectedly touches `supabase/migrations/*.sql`

## Linear Updates

- Kickoff comment: https://linear.app/megankharrison/issue/AAI-533#comment-1d3efedc-0ec1-49d1-b9d1-bc9e094b7708
- Milestone comments: none
- Completion/blocker comment: posted 2026-06-18 via Linear comment id `7a8a6980-cd36-4b63-9724-34e86d59405d`
- Acceptance/remediation comment: posted 2026-06-18 via Linear comment id `9b81677e-ff4d-47bd-b968-fb580d7a56d3`

## Current Status

Verification complete and accepted after remediation. The first browser pass found a real mismatch between persisted assistant metadata and the rendered `/ai-assistant` UI: a desktop/mobile Westfield answer was saved with `memory_usage`, but the visible disclosure and wrong-memory affordances never appeared.

The remediation indexes memory usage metadata by both the persisted database message ID and the AI SDK streamed response message ID stored in the metadata field. Rerun evidence confirms the visible answer trace now appears on desktop and mobile, expands cleanly, links to Memory Center, and queues wrong-memory feedback from the answer.

This worker did not implement admin review queue or subagent runtime changes.

## Exact Browser Steps

1. Start local frontend: `npm run dev:frontend`
2. Desktop with `agent-browser`:
   - `agent-browser --session-name s48-ai-memory-desktop --headed open http://localhost:3001/ai-assistant`
   - `agent-browser --session-name s48-ai-memory-desktop wait --load networkidle`
   - `agent-browser --session-name s48-ai-memory-desktop record start tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/session.webm`
   - Capture page-load screenshots/snapshot.
   - Submit `What context do you already have from past Westfield conversations so I do not have to repeat myself?`
   - Capture streaming and completed-response screenshots.
3. Browser tooling with Playwright:
   - Open `http://localhost:3001/ai-assistant`
   - Login with the Alleato test user from `.env` / `frontend/.env.local`
   - Capture console and network logs
   - Submit the same Westfield prompt
   - Read the persisted `GET /api/ai-assistant/messages/<sessionId>` payload from the browser session
   - Count rendered `used N memories`, `Review memory`, and wrong-memory controls
4. Mobile pass:
   - Resize Playwright browser to `390x844`
   - Capture mobile page-load screenshot
   - Capture the memory-backed answer in the existing session and confirm whether any disclosure/controls render
5. Remediation rerun:
   - Open `http://localhost:3001/ai-assistant?session=42a7878f-33c3-4e17-ae0a-2c51848e9a26`
   - Submit `What context do you already have from past Westfield conversations so I do not have to repeat myself?`
   - Confirm persisted `memory_usage.totalUsed = 3`
   - Confirm collapsed desktop trace shows `Memory used`
   - Expand the trace and confirm one `Review memory` link plus three wrong-memory actions
   - Resize to `390x844` and confirm the expanded trace remains visible without overflow
   - Click one wrong-memory action and confirm queued state appears

## Commands And Outcomes

- `npm run dev:frontend`
  - Pass. Local app reached `http://localhost:3001` and served `/ai-assistant`.
- `agent-browser --session-name s48-ai-memory-desktop --headed open http://localhost:3001/ai-assistant && ...`
  - Pass. Desktop page loaded and artifact capture started.
- `agent-browser --session-name s48-ai-memory-desktop fill/click` with prompt `What context do you already have from past Westfield conversations so I do not have to repeat myself?`
  - Pass. UI returned a visible answer, but no memory disclosure rendered.
- `mcp__playwright` open/login to `http://localhost:3001/ai-assistant`
  - Pass. Browser redirected to login first, then reached `/ai-assistant` after sign-in.
- `mcp__playwright` network capture for `POST /api/ai-assistant/chat`
  - Pass. Request `#214` returned `200 text/event-stream`; stream showed `Plan: conversational_fallback`.
- `mcp__playwright` persisted-message fetch for session `ba81c086-407a-47ed-b045-95de449fde5b`
  - Pass. Last assistant message saved `memory_usage.totalUsed = 3` with three preference memories.
- `mcp__playwright` rendered-control count check (`used N memories`, `Review memory`, wrong/queued buttons)
  - Initial fail. Desktop and mobile counts both returned zero despite persisted `memory_usage`.
- Code remediation: `extractMemoryUsage` helper
  - Pass. Persisted memory usage is now indexed by database row ID and the metadata response message ID, matching the live AI SDK message ID that remains in the UI after streaming.
- `npm run test:unit -- --runTestsByPath src/components/ai-assistant/__tests__/rag-chat-page-memory-usage.test.ts src/components/ai-assistant/__tests__/memory-usage-disclosure.test.tsx --runInBand`
  - Pass. 2 suites, 5 tests.
- `npx eslint --cache --cache-strategy content src/components/ai-assistant/rag-chat-page.tsx src/components/ai-assistant/memory-usage-metadata.ts src/components/ai-assistant/__tests__/rag-chat-page-memory-usage.test.ts src/components/ai-assistant/memory-usage-disclosure.tsx src/components/ai-assistant/__tests__/memory-usage-disclosure.test.tsx`
  - Pass.
- `npm run typecheck:changed` from `frontend/`
  - Pass.
- `npm run lint:changed:debt` from `frontend/`
  - Pass.
- Browser rerun for session `42a7878f-33c3-4e17-ae0a-2c51848e9a26`
  - Pass. Collapsed desktop trace rendered with `used=1` visible marker and persisted `memory_usage.totalUsed=3`.
- Expanded desktop trace count
  - Pass. `Review memory=1`, wrong-memory controls `=3`, memory snippet visible.
- Expanded mobile trace count at `390x844`
  - Pass. `Memory used=1`, `Review memory=1`, wrong-memory controls `=3`; no visible overflow in screenshot.
- Wrong-memory click from answer trace
  - Pass. One wrong-memory action changed to queued state (`queued=1`, remaining wrong controls `=2`).
- `npm run linear:codex:check -- docs/ops/handoffs/2026-06-18-S48-ai-memory-trace-verification.md`
  - Pass.

## Known Pitfalls

- If the local app redirects to login, use the project auth rule from `AGENTS.md`.
- If no live answer naturally includes memory metadata, document that blocker and verify the UI with the nearest available persisted memory-backed conversation.
- Do not touch `scripts/jobplanner/import-prime-contract.mjs`; it is unrelated existing dirt.

## Resume Commands

```bash
agent-browser open http://localhost:3001/ai-assistant
agent-browser snapshot -i
```

## Evidence

### Desktop Artifacts

- Agent-browser page load:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/01-page-load.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/01-page-load-full.png`
- Agent-browser streaming and completed response:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/02-streaming.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/03-response-no-memory-trace.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/03-response-no-memory-trace-full.png`
- Agent-browser session recording:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/session.webm`
- Agent-browser captured body text:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/body-after-response.txt`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/body-after-second-response.txt`
- Playwright screenshots:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-01-page-load.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-02-after-send.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-03-after-response.png`
- Playwright console/network evidence:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-console-initial.log`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-network-initial.log`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-network-ai-assistant.log`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-network-214-full.txt`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-network-214-request-body.txt`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-desktop/playwright-network-214-response-body.txt`

### Mobile Artifacts

- Mobile page load:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-mobile/playwright-00-mobile-page-load.png`
- Mobile answer state:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-mobile/playwright-01-mobile-page-with-memory-backed-answer.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-mobile/playwright-02-mobile-after-response.png`

### Remediation Rerun Artifacts

- Fixed page-load and response:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/01-page-load-after-fix.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/02-after-response.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/03-persisted-session-desktop.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/05-fresh-answer-desktop.png`
- Expanded memory trace:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/06-expanded-memory-trace-desktop.png`
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/07-expanded-memory-trace-mobile.png`
- Wrong-memory queued state:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/08-wrong-memory-queued-desktop.png`
- Captured page text:
  - `tests/agent-browser-runs/2026-06-18-ai-memory-trace-rerun/body-after-response.txt`

## Findings

### 1. Memory metadata persisted, but no trace UI rendered

- Persisted evidence from the browser session for `sessionId=ba81c086-407a-47ed-b045-95de449fde5b` showed:
  - `lastAssistantMemoryUsage.totalUsed = 3`
  - three preference-memory rows
  - assistant text grounded in those preferences
- Visible UI evidence on both desktop and mobile showed:
  - `0` matches for `used N memories`
  - `0` `Review memory` links
  - `0` wrong/queued buttons
- Initial UI behavior: the answer text rendered normally, but the memory-trace disclosure never mounted anywhere on the page.
- Remediated UI behavior: the disclosure now mounts for the live streamed answer after persisted metadata reload.

### Root Cause And Fix

- Cause: the chat page intentionally avoided replacing live AI SDK messages immediately after streaming, so the visible assistant answer kept the streamed response ID. The persisted message metadata was only keyed by the database row ID, so `memoryUsageByMessageId[message.id]` missed the trace data.
- Detection gap: the prior regression only covered the disclosure component, not the persisted-history-to-live-message ID mapping.
- Prevention: `frontend/src/components/ai-assistant/memory-usage-metadata.ts` centralizes extraction and indexes memory usage by both IDs. `frontend/src/components/ai-assistant/__tests__/rag-chat-page-memory-usage.test.ts` locks the mapping.

### 2. Live Westfield recall behavior differs between visible UI and persisted-session proof

- In the first desktop `agent-browser` run, the assistant explicitly said:
  - no Westfield-specific memories were found
  - the prior-conversation recall source failed
- In the Playwright-backed logged-in run, the saved assistant message still carried three preference memories in `memory_usage`.
- Actual UI behavior: depending on session/context, the answer content changes, but the visible memory-trace controls remain absent either way.

### 3. Wrong-memory action could not be exercised from the UI

- Initial run: because no disclosure rendered, there was no visible per-memory control to expand, no `Review memory` link, and no `This is wrong` button to click.
- Remediation rerun: expanded answer trace exposed three wrong-memory actions; clicking one changed it to queued state.

### 4. Console and network noise observed during verification

- Console/log evidence captured:
  - repeated pre-auth `401 /api/users/me/profile`
  - Supabase `Invalid Refresh Token`
  - nested-button hydration warnings/errors around the council-mode control
  - `POST /api/velt/token` `500`
- Network evidence captured:
  - `POST /api/ai-assistant/chat` request `#214` returned `200`
  - SSE stream began with `Plan: conversational_fallback`
- Assessment:
  - The persisted-message mismatch is related to AAI-533.
  - The Velt token failure, refresh-token noise, and council-mode nested-button error look unrelated repo debt for this verification slice.

## TASKS-AI Update

- `Current Status > Add assistant-answer memory trace disclosure` is complete.
- `Phase 2 > Chat UI > Ensure mobile layout does not overflow` is complete based on the `390x844` expanded trace rerun artifact.
- Full admin review queue candidate verification remains separate from this slice; this slice only proved answer-trace feedback reaches the queued UI state.
