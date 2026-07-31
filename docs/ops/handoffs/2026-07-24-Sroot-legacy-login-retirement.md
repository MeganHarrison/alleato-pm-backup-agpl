# Legacy Login Retirement Handoff

Status: Complete in isolated branch; not merged or deployed
Session: Sroot legacy-login retirement
Date: 2026-07-24
Task: `docs/ops/tasks/2026-07-24-retire-legacy-login-routes.md`

## Scope

- Retire `/auth/login-v2` and `/auth/login-v3` page implementations.
- Preserve direct-link queries through a temporary redirect to `/auth/login`.
- Refresh tracked route inventories and focused tests.
- Do not merge or deploy.

## Current Findings

- `/auth/login-v2` rendered the same `LoginPageV2` component as `/auth/login`.
- `/auth/login-v3` was the only consumer of `LoginPageV3`; its older callback branch pushed a validated project URL directly instead of using the canonical server authorization-aware resolver.
- No source caller points at either legacy URL.
- Remaining pre-change current-route references were tracked generated inventories, the page-description sidecar, and the generated project map.
- The public screenshot manifest is a dated historical production capture, so it remains unchanged rather than being hand-edited as if freshly captured.
- Middleware already owns unauthenticated canonical redirects and runs for `/auth/*`, making it the narrowest shared compatibility boundary.

## Verification

- Pass: 3 focused Jest suites, 33 tests.
- Pass: focused ESLint on middleware and its regression test.
- Pass: route conflict check and fresh local route audit.
- Pass: project map/app-surface and cross-layer system-map regeneration/check mode.
- Pass: App Expert generator syntax/fallback and fully regenerated inventories: 356 routes, 364 features, all 60 help articles, 52 documented routes, and zero retired aliases.
- Pass: both local HTTP requests returned `307` with the exact canonical query-bearing `Location`.
- Pass: agent-browser followed both aliases to the exact canonical query-bearing URL and canonical form; screenshots visually reviewed.
- Unrelated environment failure: `PYTHONPATH=backend python3 -m pytest backend/tests/test_app_expert_agent.py -q` could not create the FastAPI fixture because `backend/tests/conftest.py` had `app=None`.
- Unrelated environment failure: direct Python help-resolution import lacked local `langchain_core`; Node-level generator invariants passed.
- Pass: independent reviewer found no remaining actionable auth-routing, callback, inventory, or generator issues.

## Files Owned

- `frontend/src/lib/supabase/middleware.ts`
- `frontend/src/lib/supabase/__tests__/middleware.test.ts`
- `frontend/src/app/auth/login-v2/page.tsx` (delete)
- `frontend/src/app/auth/login-v3/page.tsx` (delete)
- `frontend/src/components/misc/login-page-v3.tsx` (delete)
- `frontend/src/lib/app-surface/page-descriptions.json`
- `scripts/docs/generate-app-expert-artifacts.mjs`
- Generated project-map, system-map, and App Expert route inventories
- `tests/agent-browser-runs/2026-07-24-legacy-login-retirement/`
- This handoff and its task ledger

## Remaining

- No implementation or verification work remains.
- The coordinator may review or cherry-pick the isolated commit; merge and deployment remain explicitly out of scope.
