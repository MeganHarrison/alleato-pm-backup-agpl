# Task: Repair the AI Workspace Sidebar and Viewport Layout

Status: Complete
Owner: Codex
Created: 2026-07-22
Task ID: AAI-1251
Linear Issue: AAI-1251 — https://linear.app/megankharrison/issue/AAI-1251/anchor-the-ai-chat-composer-to-the-viewport-bottom
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT-ai-sidebar-repair.md`

## Objective

Keep `/ai` inside the normal Alleato application shell. Chat history is a
secondary surface that starts collapsed and opens without overlapping the
application sidebar, site header, chat surface, or composer.

## Acceptance Criteria

- [x] The normal application sidebar and site header remain mounted on `/ai`.
- [x] Chat history is collapsed by default on desktop and mobile.
- [x] Opening desktop history shows one inline panel without overlapping application navigation.
- [x] Mobile exposes one history control and uses the existing Sheet pattern.
- [x] The composer remains visible and neither viewport has horizontal overflow.
- [x] Focused regression coverage protects the route and responsive layout contract.
- [x] Corrected desktop and mobile production screenshots are attached to AAI-1251.
- [x] The corrected revision is published to `origin/main` and Ready in production.

## Implementation Checklist

- [x] Remove the `/ai` app-shell exclusion and restore shared `AppSidebar` and `SiteHeader` ownership.
- [x] Reuse one conversation-sidebar content owner for collapsed desktop and mobile Sheet modes.
- [x] Preserve the ASRS surface's existing non-docked history behavior.
- [x] Keep the main chat region in an unbroken flex/min-height chain.
- [x] Update the layout-contract regression test to enforce the corrected shell and default state.

## Failure-Loudly Contract

- Cause surfaced as: the layout test fails if `/ai` excludes the shared app shell, opens history by default, or loses its responsive sidebar contract.
- Detection path: focused Jest coverage plus authenticated production DOM geometry at desktop and mobile widths.
- Recovery path: repair the shared workspace/layout owners; do not add page-local offsets or z-index patches.

## Incident Learning

- Root cause: the original Radix history Sheet and global application rail occupied the same viewport edge. The first repair removed the global shell and permanently docked history, which exceeded the requested scope.
- Detection gap: the first acceptance contract tested overlap removal but did not preserve the explicitly required application sidebar, header, and initial collapsed state.
- Prevention: the corrected regression contract asserts shared app-shell ownership, `historyOpen` initialization to `false`, and open-state-only desktop history rendering.
- Guardrail evidence: `rag-chat-page-layout.test.tsx` and authenticated desktop/mobile DOM geometry readback.

## Evidence

| Check | Command / artifact | Result |
| --- | --- | --- |
| UI regression | `pnpm exec jest --runInBand --runTestsByPath src/components/ai-assistant/__tests__/rag-chat-page-layout.test.tsx` | Pass: 1 suite, 2 tests |
| Targeted lint | ESLint on the four touched frontend files with `--max-warnings=0` | Pass |
| Backend commit guardrail | `python -m pytest backend/tests/test_product_intelligence_packets.py -q` | Pass: 4 tests |
| Route gates | Pre-push `check:routes` and `verify:nonprod-routes` | Pass |
| Corrected desktop closed state | `http://localhost:5432/ai`, 1440x900 | App sidebar and site header visible; history absent; one trigger; no overflow |
| Corrected desktop open state | `http://localhost:5432/ai`, 1440x900 | 288px inline history; no app-sidebar or header overlap |
| Corrected mobile closed/open states | `http://localhost:5432/ai`, 375x812 | Closed initially; one trigger opens Sheet; no overflow |
| Source publication | `git ls-remote origin refs/heads/main` | Corrected UI revision `c3c9259da0b6092bc3cf301128a84908dd510352` published |
| Production deployment | Vercel `dpl_57tGZJ3LKN53ep39oXTHyWi9NuAG` | Ready; cloned commit `c3c9259` |
| Corrected desktop closed state | `https://projects.alleatogroup.com/ai`, 1440x900 | App sidebar and site header visible; history absent; one trigger; no overflow |
| Corrected desktop open state | `https://projects.alleatogroup.com/ai`, 1440x900 | 288px inline history; zero app-sidebar or header overlap |
| Corrected mobile closed/open states | `https://projects.alleatogroup.com/ai`, 375x812 | Closed initially; one trigger opens Sheet; mobile nav retained; no overflow |
| Corrected screenshot evidence | Four `Corrected AI sidebar` attachments on AAI-1251 | Attached and viewable |

## Remaining Risk

- The repository still emits unrelated Sentry source-map token and dynamic AI-skill import warnings during production builds. They did not fail this deployment and are outside this UI repair.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning and prevention are recorded.
- [x] Production screenshots match the corrected shipped revision.
