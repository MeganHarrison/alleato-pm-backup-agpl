# Restore AI Assistant Debug Route

Date: 2026-07-06
Linear: AAI-948
Status: Complete

## Objective

Restore `/ai-assistant-debug` so developers can inspect assistant routing,
tools, sources, model path, trace IDs, and write-tool status without using the
end-user AI page as the debugging surface.

## Scope

- Restore the local checkout to the canonical `/ai-assistant-debug` app route.
- Use the canonical `/api/admin/ai-assistant-debug` contract.
- Keep the page developer-focused and separate from the end-user `/ai` surface.
- Verify the route renders locally instead of returning 404.

## Done Checklist

- [x] Create Linear issue before implementation.
- [x] Create task markdown before implementation.
- [x] Confirm root cause of the 404.
- [x] Restore the missing page route.
- [x] Run focused route/frontend checks.
- [x] Verify local URL no longer renders 404.
- [x] Post Linear closeout comment.

## Evidence

- Linear issue: `AAI-948`.
- Linear closeout comment: `8dd2d12b-d30a-453a-ad8d-661d019f6c57`.
- Linear correction comment: `145d73f7-673f-4002-9e66-226ae1414bc5`.
- Root cause: the local checkout/dev server was behind `origin/main`; the
  canonical `ai-assistant-debug` page was not present locally when the browser
  requested it.
- Initial unauthenticated route probe returned `307` to `/auth/login`, which
  confirmed middleware was handling the protected route request, not serving a
  public static 404.
- Process gap: `docs/ops/tasks/TASK-TEMPLATE.md` is referenced by repo
  instructions but is not present in this checkout.
- Pulled `origin/main`, which includes the canonical route files:
  - `frontend/src/app/(admin)/ai-assistant-debug/page.tsx`
  - `frontend/src/app/(admin)/ai-assistant-debug/ai-assistant-debug-console-client.tsx`
  - `frontend/src/app/api/admin/ai-assistant-debug/route.ts`
- Removed the temporary duplicate `(main)` route candidate so
  `/ai-assistant-debug` has one owner.
- `npm run check:routes` passed.
- `cd frontend && npx eslint 'src/app/(main)/ai-assistant-debug/page.tsx'`
  passed before the temporary duplicate route candidate was removed.
- `cd frontend && npm run typecheck:changed` passed before the temporary
  duplicate route candidate was removed.
- `npx markdownlint-cli2 --no-globs docs/ops/tasks/2026-07-06-restore-ai-assistant-debug-route.md`
  passed.
- Cleared `frontend/.next` and restarted the frontend on
  `http://localhost:3001`.
- `curl -I http://localhost:3001/ai-assistant-debug` returned `307` to
  `/auth/login?callbackUrl=%2Fai-assistant-debug`, not 404.
- Generated Next route types include `"/ai-assistant-debug"`.

## Failure Contract

- Cause: the developer debug URL existed in the browser but the local checkout
  and running dev server did not have the canonical route from `origin/main`.
- Detection gap: route inventory checks did not assert this developer surface.
- Prevention: keep local `main` current before route debugging and verify
  `/ai-assistant-debug` appears in generated Next route types after restart.
