# AI Assistant Debug Console

Date: 2026-07-06
Linear: AAI-946
Status: Complete

## Objective

Build a separate admin/developer AI assistant diagnostic page that shows which routing, retrieval, tools, agents, model/provider path, source/debug metadata, and response-quality signals were used for assistant answers.

## Scope

- Add a developer/admin route for AI assistant trace inspection.
- Read existing persisted assistant metadata; do not change the end-user assistant route.
- Provide a quiet list/detail diagnostic UI using existing app primitives.
- Include targeted verification and architecture/task evidence.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Inspect current AI assistant metadata persistence and admin route patterns.
- [x] Implement debug console route and any focused data-loading helper/API needed.
- [x] Verify route/type/lint behavior with narrow checks.
- [x] Record evidence and post Linear closeout comment.

## Evidence

- Existing patterns inspected:
  - `frontend/src/app/(admin)/ai-chat-history/page.tsx`
  - `frontend/src/app/(admin)/ai-chat-history/ai-chat-history-client.tsx`
  - `frontend/src/app/api/admin/ai-chat-history/route.ts`
  - `frontend/src/app/(admin)/ai-prompt-diagnostics/page.tsx`
  - `frontend/src/app/api/admin/_shared.ts`
  - `frontend/src/app/api/ai-assistant/chat/handler-v2.ts`
- Implemented:
  - `frontend/src/app/(admin)/ai-assistant-debug/page.tsx`
  - `frontend/src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx`
  - `frontend/src/app/api/admin/ai-assistant-debug/route.ts`
  - `frontend/src/app/(admin)/admin/page.tsx`
- Checks:
  - `npm run check:routes` passed.
  - `cd frontend && npx eslint 'src/app/api/admin/ai-assistant-debug/route.ts' 'src/app/(admin)/ai-assistant-debug/page.tsx' 'src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx' 'src/app/(admin)/admin/page.tsx'` passed with zero warnings after cleanup.
  - `cd frontend && npm run typecheck:changed` passed with no new `any` debt.
  - `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-ai-assistant-debug-console.md` passed.
- Browser/auth evidence:
  - Dev server ready at `http://localhost:3001`.
  - `agent-browser open http://localhost:3001/ai-assistant-debug` redirected to `/auth/login?callbackUrl=%2Fai-assistant-debug`, confirming the route is protected.
  - Screenshot saved at `/tmp/ai-assistant-debug-login-gate.png`.
  - `curl -I http://localhost:3001/ai-assistant-debug` returned `307 Temporary Redirect` to login.
  - `curl 'http://localhost:3001/api/admin/ai-assistant-debug?limit=1'` returned `401 Unauthorized`, confirming the API is not public.
- Linear evidence:
  - Posted closeout comment `d8687191-6d3b-4d7d-8288-3af0af0d82fe` on `AAI-946`.

## Closeout Notes

- End-user `/ai` assistant route was not changed.
- The developer route reads persisted assistant metadata only; it does not add model calls.
- Full authenticated visual inspection was not completed because this browser session did not have a signed-in developer user.
- Linear status transition was not completed because the available Linear connector tools exposed comments/status lookup but not issue status mutation.

## Noise Gate

- Primary user: AI/product maintainer.
- Primary job: diagnose why a specific AI assistant answer was good or bad.
- Primary decision: which routing/tool/retrieval/model/source step failed or needs adjustment.
- Tier 1: selected run answer, intent, tool trace, retrieval plan, backend agent calls, failures.
- Tier 2: source/debug metadata, model/provider path, response-quality scores, widgets.
- Tier 3: raw JSON metadata and conversation list.
- Hide until requested: full raw metadata.
- Remove: aggregate KPI cards, decorative charts, duplicate summaries, marketing copy.
- Primary action: inspect a run and copy/open the evidence needed for a fix.
- Failure-loudly behavior: empty/missing metadata says exactly what is missing and where it should be persisted.

## Initial Constraints

- End-user AI assistant must remain one consistent personality and route.
- This slice should not introduce new AI model calls.
- Checkout is dirty with unrelated work; keep edits scoped to the debug console and task docs.
