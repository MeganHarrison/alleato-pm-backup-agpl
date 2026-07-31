# Handoff: AI Dashboard Route Consolidation

Session: S215  
Task: LOCAL-AI-DASHBOARD-ROUTE-CONSOLIDATION-2026-07-21  
Status: Blocked/Deferred pending concurrent dashboard integration

## Scope and Ownership

- Changed: `frontend/src/app/(main)/ai-dashboard/page.tsx`
- Changed: `frontend/src/app/(main)/ai-dashboard/ai-os/page.tsx`
- Changed: `frontend/src/app/(main)/ai-dashboard/projects/page.tsx`
- Added guardrail: `frontend/src/app/(main)/ai-dashboard/__tests__/route-consolidation.test.ts`

## Result

- `/ai-dashboard` now renders `AiOsDashboard` inside the existing shared page and workspace shells.
- `/ai-dashboard/ai-os` redirects to `/ai-dashboard`.
- `/ai-dashboard/projects` redirects to `/ai-dashboard`.

## Verification

- Pass: `cd frontend && npm run test:unit -- --runInBand --testPathPatterns='route-consolidation.test.ts'` (3/3)
- Pass: `npm run check:routes`
- Browser proof: desktop and mobile screenshots under `docs/ops/evidence/2026-07-21-ai-dashboard-route-consolidation-*.png`.

## Blocker

The task cannot publish safely from the shared `main` checkout: it is ahead/behind `origin/main`, has unrelated dirty files, and has active writer leases. In addition, the concurrent owner of `workspace-shell.tsx` and `ai-os-data.ts` must remove stale Projects/AI System navigation entries or repoint their underlying links before merge. The redirects prevent broken navigation in the interim.

Cause: concurrent dashboard work overlaps the remaining navigation cleanup.  
Detection gap: route ownership was previously split across root and child pages.  
Prevention: the route-consolidation Jest contract now asserts one canonical AI OS root plus redirect-only legacy routes.  
Next action: integrate this scoped route diff after the active dashboard owner releases their changes, remove stale links, then run `codex:finish` with the exact S215-owned paths.
