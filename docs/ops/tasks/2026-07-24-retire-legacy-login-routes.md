# Task: Retire Legacy Login Routes

Status: Complete in isolated branch; not merged or deployed
Owner: Codex Sroot legacy-login retirement
Created: 2026-07-24
Task ID: LOCAL-2026-07-24-LEGACY-LOGIN-RETIREMENT
Linear Issue: N/A - coordinator delegated a bounded isolated retirement without external tracking.
Related Handoff: `docs/ops/handoffs/2026-07-24-Sroot-legacy-login-retirement.md`

## Objective

Retire the duplicate `/auth/login-v2` and `/auth/login-v3` page implementations while preserving every direct-link query parameter through a compatibility redirect to the canonical `/auth/login` flow.

## Scope

- Own the two legacy page routes, their otherwise-unused alternate component, authentication middleware redirect compatibility, focused regression coverage, and tracked route inventories.
- Exclude canonical login behavior changes, authentication provider changes, deployment, merge, and unrelated repository debt.

## Source of Truth

- Canonical runtime/data owner: `frontend/src/app/auth/login/page.tsx` and `frontend/src/components/misc/login-page-v2.tsx`
- Existing shared primitives/services: `frontend/src/lib/supabase/middleware.ts`, `frontend/src/lib/validation/callback-url.ts`, and `frontend/src/lib/auth/post-login-router.ts`
- Deprecated or parallel paths: `frontend/src/app/auth/login-v2/page.tsx`, `frontend/src/app/auth/login-v3/page.tsx`, and `frontend/src/components/misc/login-page-v3.tsx`
- Generated inventory owner: `scripts/docs/generate-app-expert-artifacts.mjs`, with the bundled runtime help corpus as fallback after the public docs repository split.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Contract

- `/auth/login` remains the only login page implementation.
- Requests to `/auth/login-v2` and `/auth/login-v3` return a temporary same-origin redirect to `/auth/login`.
- The redirect preserves `callbackUrl` and every additional query parameter without decoding, filtering, or reordering them.
- Canonical login continues to validate the callback against open redirects and resolve project authorization server-side after sign-in.
- No source caller, tracked documentation, or generated current-route inventory advertises either retired page.
- The isolated result is not merged or deployed.

## Acceptance Criteria

- [x] Requested behavior is observable end to end.
- [x] Failure-loudly behavior is defined.
- [x] Relevant existing guardrails are identified before implementation.
- [x] Legacy or duplicate paths are removed or explicitly deferred.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication redirect and callback contracts are handled.

## Integration and Verification

- [x] Focused middleware regression tests pass.
- [x] Route conflict and generated-inventory checks pass.
- [x] Browser and HTTP proof demonstrate both redirects and preserved queries.
- [x] Independent review accepts the authentication routing and inventory guardrail changes.
- [x] Evidence artifacts are recorded.
- [x] Unrelated verification/tooling failures are named with their exact command and owner.
- [x] Publishing is explicitly excluded by the coordinator; branch must remain isolated.

## Failure-Loudly Contract

- Cause surfaced as: a focused middleware test fails if a legacy path stops redirecting, uses the wrong destination/status, or drops/reorders query parameters.
- Detection path: middleware Jest test, route inventory search, and end-user redirect proof.
- Recovery path: restore the two-path compatibility set in `frontend/src/lib/supabase/middleware.ts`; do not restore alternate login components.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: Two design-experiment routes remained routable after `/auth/login` adopted the V2 component; V3 also retained an older callback flow that bypassed the canonical server authorization check.
- Detection gap: Route discovery inventories recorded existence but did not distinguish canonical authentication entry points from duplicate experiments. App Expert regeneration also silently returned zero help articles after its former docs source moved repositories.
- Prevention: Focused redirect regression coverage plus regenerated route/App Expert inventories make `/auth/login` the only discoverable page while direct legacy links remain compatible. The generator now falls back to the bundled runtime help corpus and fails loudly if neither source produces frontmatter-backed articles.
- Guardrail evidence: 33 focused middleware/post-login tests passed; both legacy HTTP requests returned the exact canonical `Location`; generated inventories contain zero retired-route entries and preserve all 60 help articles.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | High-risk acceptance and no-publish boundary captured before verification. |
| Pre-change production behavior | `curl -D - https://projects.alleatogroup.com/auth/login-v{2,3}?...` | Pass | Both candidates returned `200` as independently rendered pages before retirement. |
| Focused auth tests | `pnpm --dir frontend exec jest src/lib/supabase/__tests__/middleware.test.ts src/lib/auth/__tests__/post-login-router.test.ts src/lib/auth/__tests__/post-login-redirect-client.test.ts --runInBand` | Pass | 3 suites, 33 tests; covers both aliases, query preservation, callback authorization, and safe fallback behavior. |
| Focused lint | `pnpm --dir frontend exec eslint src/lib/supabase/middleware.ts src/lib/supabase/__tests__/middleware.test.ts` | Pass | No diagnostics. |
| Route conflicts | `npm run check:routes` | Pass | No dynamic route conflicts. |
| Route inventory | `node scripts/verify/route-audit.mjs`; search generated CSV/Markdown | Pass | Fresh local inventory contains neither retired page; reports remain ignored by repository policy. |
| Project map | `npm run map:project`; `node scripts/dev-tools/generate-project-map.mjs --check-only` | Pass | Current tracked map/app-surface contain only `/auth/login`. |
| System map | `npm run map:system`; `npm run map:system -- --check-only` | Pass | Cross-layer route count updated from 358 to 356 without unrelated count drift. |
| App Expert inventory | `node --check scripts/docs/generate-app-expert-artifacts.mjs`; `npm run docs:generate-app-expert`; JSON count/help/retired-route invariants | Pass | Fully regenerated at `2026-07-24T08:17:13.169Z`; 356 routes, 364 features, 60 help articles, 52 documented routes, and zero retired aliases. |
| End-user redirect proof | `tests/agent-browser-runs/2026-07-24-legacy-login-retirement/redirect-proof.md` | Pass | Both paths returned `307`, exact query-bearing `Location`, and agent-browser landed on the canonical query-bearing URL. |
| Screenshot review | `browser/login-v2-canonical-redirect.png`, `browser/login-v3-canonical-redirect.png` | Pass | Both reviewed images render the canonical Alleato login controls. |
| Independent review | `tests/agent-browser-runs/2026-07-24-legacy-login-retirement/independent-review.md` | Pass | No actionable auth-routing, callback, inventory, or generator findings remain. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Backend App Expert test file | `PYTHONPATH=backend python3 -m pytest backend/tests/test_app_expert_agent.py -q` | Unrelated environment failure | 3 existing fixture errors: `backend/tests/conftest.py:178` has `app=None`; no generator or auth assertion ran. |
| Direct Python help resolver probe | `PYTHONPATH=backend python3 - ... _safe_help_article_path(...)` | Unrelated environment failure | Local Python environment lacks `langchain_core`; the Node generator fallback and 60-article invariants passed independently. |

## Remaining Risk

- A non-source external bookmark may still use a legacy URL; compatibility redirects preserve those requests. Deployment is explicitly out of scope, so production remains unchanged.
- The dated screenshot-capture manifest remains unchanged because it is historical production evidence, not a current source-route inventory; the current project map, route audit, and App Expert inventories were regenerated.
- Full backend App Expert route tests require the configured backend test environment; local fixture/import failures are unrelated to this TypeScript/middleware change and the generator's Node-level invariants.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is explicitly recorded.
- [x] No merge or deployment was performed.
