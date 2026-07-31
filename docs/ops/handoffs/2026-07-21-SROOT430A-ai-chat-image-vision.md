# Handoff: 2026-07-21 — Alleato AI Image Vision

## Intake Block

<!-- prettier-ignore-start -->
1) Session ID: SROOT430A
2) Task ID: LOCAL-AI-IMAGE-VISION-2026-07-21
3) Linear issue: AAI-000
4) Linear URL: https://linear.app/unavailable
5) Current status: In Progress
6) Files changed (absolute paths): `frontend/src/lib/ai/chat-attachment-capabilities.ts`, `frontend/src/lib/ai/chat-attachment-limits.ts`, the focused test, `handler-v2.ts`, `chat-area.tsx`, `prompt-input.tsx`, its attachment test, `scripts/ops/codex-finish.mjs` and `frontend/package.json` for Windows-safe required checks, the recurring-failure registry, and this task/handoff.
7) Commands run and outcome (pass/fail counts): focused attachment suite 18/18; adjacent composer/routing/attachment suites 99/99; changed-file ESLint pass; targeted strict TypeScript pass; learning-registry audit pass; full TypeScript exhausted the repository five-minute bounded timeout without diagnostics while the task-owned targeted strict compile passed.
8) Evidence artifacts (screenshot/video/report/log paths): `C:/Users/Brandon/AppData/Local/Temp/codex-clipboard-430ad742-2388-4989-96b8-b160abe26da6.png`; `docs/ops/evidence/2026-07-21-ai-chat-image-vision/independent-review.md`; `verification-manifest.json`; `verification-result.json`
9) Top 3 findings (frontend-visible issues first): the assistant falsely refuses screenshots; the image bytes already reach the AI SDK message; `handler-v2.ts` labels every file part unreadable and injects the contradictory refusal instruction.
10) Recommended next action (one line): Publish current main and run the authenticated production image-grounding proof.
11) Handoff file path: `docs/ops/handoffs/2026-07-21-SROOT430A-ai-chat-image-vision.md`
12) Migration ledger evidence: Not applicable; no database migration is in scope.
<!-- prettier-ignore-end -->

## Linear Updates

- Kickoff comment: Not posted because no Linear connector or CLI is available; local task and handoff ledgers record the exact blocker.
- Milestone comments: Local evidence ledger updated; external comment unavailable with the missing Linear connector.
- Completion/blocker comment: Pending.

## Current Status

The server and composer fixes are implemented on current main. Supported raster data URLs are validated by MIME/signature/count/size, retained for AI SDK conversion, and receive a multi-turn untrusted-content vision instruction. Unsupported, spoofed, remote, or provider-referenced parts are rejected or filtered before provider conversion. Shared client/server transport limits keep inline base64 below Vercel's fixed request ceiling; early per-file and aggregate limits prevent browser expansion while preserving bounded local text/workbook reduction. Focused, adjacent, lint, strict targeted TypeScript, and learning-registry checks pass. Production publication and live image proof remain.

## Exact Next Step

Complete the final independent review, publish main, and run the authenticated production image-grounding proof.

## Known Pitfalls

- Do not add a new upload endpoint or copy the legacy artifact-editor composer.
- Keep PDF, Office, and other unsupported binary formats fail-loudly unreadable.
- Do not persist base64 image bodies in `chat_history`; durable attachments require a separate private-storage design.
- Vercel rejects request bodies above 4.5 MB before application code; keep inline image totals at or below 3 MB decoded and fail in the composer first.

## Resume Commands

```powershell
cd "C:\Users\Brandon\OneDrive - Alleato Group\Documents\PM 2\.codex-isolated-workspaces\sroot430a-local-ai-image-vision-2026-07-21-4056ba"
node scripts/ops/isolated-session-workspace.mjs status
git status --short --branch
```

## Evidence

- User failure screenshot: `C:/Users/Brandon/AppData/Local/Temp/codex-clipboard-430ad742-2388-4989-96b8-b160abe26da6.png`
- Authenticated pre-change route: `https://projects.alleatogroup.com/1144/schedule`
- Root-cause boundary: `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Verification contract: `docs/ops/evidence/2026-07-21-ai-chat-image-vision/verification-result.json` (PASS).
- Focused attachment contract: 18/18 passing.
- Adjacent composer/routing/attachment contracts: 99/99 passing.
- Security review findings addressed: count-only metadata, untrusted-image instruction, strict data-URL/signature/size validation, provider-reference rejection, exact safe provider filtering, and bounded early browser reads.