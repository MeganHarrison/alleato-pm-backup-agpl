# Handoff: AI Sidebar Repair

1) Session ID: SROOT-AI-SIDEBAR
2) Task ID: AAI-1251
3) Linear issue: AAI-1251
4) Linear URL: https://linear.app/megankharrison/issue/AAI-1251/anchor-the-ai-chat-composer-to-the-viewport-bottom
5) Current status: Complete
6) Files changed (absolute paths): `/Users/meganharrison/.codex/isolated-workspaces/sroot-ai-sidebar-aai-1251-cf99c7/frontend/src/app/(main)/layout.tsx`; `/Users/meganharrison/.codex/isolated-workspaces/sroot-ai-sidebar-aai-1251-cf99c7/frontend/src/components/ai-assistant/rag-chat-page.tsx`; `/Users/meganharrison/.codex/isolated-workspaces/sroot-ai-sidebar-aai-1251-cf99c7/frontend/src/components/ai-assistant/conversation-sidebar.tsx`; `/Users/meganharrison/.codex/isolated-workspaces/sroot-ai-sidebar-aai-1251-cf99c7/frontend/src/components/ai-assistant/__tests__/rag-chat-page-layout.test.tsx`
7) Commands run and outcome (pass/fail counts): PASS `jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/rag-chat-page-layout.test.tsx`, 1 suite and 2 tests. PASS targeted ESLint. PASS authenticated Playwright geometry proof at desktop and 375px mobile.
8) Evidence artifacts (screenshot/video/report/log paths): Linear AAI-1251 attachments `Corrected AI sidebar, desktop collapsed`, `Corrected AI sidebar, desktop open`, `Corrected AI sidebar, mobile collapsed`, and `Corrected AI sidebar, mobile open`; temporary paths `/tmp/ai-sidebar-production-corrected-*.png`.
9) Top 3 findings (frontend-visible issues first):
   - The first repair incorrectly removed the shared application sidebar and site header and permanently docked chat history.
   - The corrected `/ai` route preserves the shared app shell and initializes chat history closed.
   - Opening desktop history creates one inline 288px panel below the header with zero overlap; mobile uses the existing Sheet.
10) Recommended next action (one line): Keep the focused app-shell and collapsed-history regression contract in the normal `/ai` test suite.
11) Handoff file path: `docs/ops/handoffs/2026-07-22-SROOT-ai-sidebar-repair.md`
12) Migration ledger evidence: N/A, no migrations touched.

## Scope and verification

- General AI workspace only: the ASRS surface keeps its existing non-docked history behavior.
- Desktop closed geometry: shared app sidebar and site header visible, no history panel, one history trigger, no horizontal overflow.
- Desktop open geometry: app sidebar 56px, site header 48px, inline history panel 288px, zero overlap.
- Mobile geometry: history closed initially; one trigger opens the existing Sheet; no horizontal overflow.
- Regression guardrail: static contract test protects shared app-shell ownership and the initial closed history state.

## Corrected production verification

- Published revision: `c3c9259da0b6092bc3cf301128a84908dd510352` on `origin/main`.
- Vercel deployment: `dpl_57tGZJ3LKN53ep39oXTHyWi9NuAG`, Ready and aliased to `projects.alleatogroup.com`.
- Desktop closed: shared application sidebar and 48px site header visible; no history panel; one history trigger; no horizontal overflow.
- Desktop open: 288px inline history panel; zero application-sidebar or site-header overlap; no horizontal overflow.
- Mobile closed/open: history starts closed; one trigger opens the existing Sheet; mobile navigation remains visible; no horizontal overflow.
- Escape closes both desktop and mobile history surfaces.

## Linear Updates

- Kickoff, local verification, integration handoff, and publication status were posted to AAI-1251.
- Production desktop and mobile screenshot attachments were added after the canonical deployment reached Ready.
- The issue was reopened after direct user feedback, with the corrected acceptance contract and superseded-proof note.
- Four corrected production screenshots were attached after the exact revision reached Ready.

## Resolved publication blocker

- The repository-wide `select("*")` guardrail was repaired with explicit packet-item columns and focused tests.
- The clean isolated release was rebased onto current `origin/main` and pushed directly, preserving the dirty canonical checkout and its active sessions.
- Authenticated production proof used the repository's guarded browser-auth bootstrap; the earlier expired-auth blocker is resolved.
