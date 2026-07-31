# AI strategic follow-up routing handoff

1) Session ID: S185
2) Task ID: AI-CHAT-FOLLOWUP-2026-07-18
3) Linear issue: unavailable
4) Linear URL: unavailable; no Linear connector is exposed in this session
5) Current status: In Progress
6) Files changed (absolute paths):
   - `/tmp/project-management-ai-chat-publish/frontend/src/lib/ai/retrieval/planner.ts`
   - `/tmp/project-management-ai-chat-publish/frontend/src/lib/ai/deep-agent-bridge.ts`
   - `/tmp/project-management-ai-chat-publish/frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
   - `/tmp/project-management-ai-chat-publish/frontend/src/lib/ai/retrieval/__tests__/planner.test.ts`
   - `/tmp/project-management-ai-chat-publish/frontend/src/lib/ai/__tests__/deep-agent-bridge.test.ts`
7) Commands run and outcome:
   - Focused Jest suite: pass; 2 suites, 82 tests.
   - Focused ESLint and `git diff --check`: pass.
   - Isolated `agent-browser` authenticated two-turn flow: pass.
8) Evidence artifacts:
   - `docs/ops/evidence/2026-07-18-ai-strategic-followup-routing/strategic-followup-transcript.json`
   - `docs/ops/evidence/2026-07-18-ai-strategic-followup-routing/strategic-followup.png`
9) Top 3 findings:
   - Broad strategic follow-ups matched executive intent before follow-up context.
- The handler then bypassed the planner outcome by selecting the bridge from
  intent alone.
- The first production deploy revealed follow-up detection was below broad
  executive detection; the next patch moves it above that branch.
- Render `/api/intelligence/research` did not answer within 44.8 seconds;
     the chat stream previously stayed pending for up to 120 seconds.
10) Recommended next action: publish this isolated patch to `origin/main`, then
    verify the deployed browser flow once the frontend deployment is live.
11) Handoff file path: `docs/ops/handoffs/2026-07-18-S185-ai-strategic-followup-routing.md`
12) Migration ledger evidence: N/A; no migrations touched.

## Change summary

- Follow-up phrases and explicit conversational references now resolve before a
  broad executive job and reuse the prior briefing with fresh semantic grounding.
- The executive bridge now requires the planner's explicit broad-operator reason.
- Bridge timeouts default to 35 seconds and are capped at 45 seconds.
- Tests cover prior history and a reload/history-missing prompt path.

## Risk and review request

The live follow-up was honest about a changed/thin Outlook read rather than
inventing decisions. That is correct source behavior, but a future task may
want a pinned evidence snapshot across a multi-turn inbox conversation.
