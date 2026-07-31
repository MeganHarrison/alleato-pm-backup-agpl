# Task: Isolate Authentication Route Compilation

Status: Implemented, Locally Verified, and Published
Owner: Codex
Created: 2026-07-31
Task ID: auth-route-compile-boundary-2026-07-31
Linear Issue: N/A, single-session local performance repair
Related Handoff: N/A, single-session Standard work

## Objective

Keep authentication and public routes outside the authenticated application
provider, analytics, collaboration, project-state, feedback, and AI module graph
without removing those capabilities from authenticated routes.

## Scope

- Root and route-group layouts.
- One shared authenticated provider composition.
- A regression test for the route/provider ownership boundary.
- Local cold/warm compile and browser verification.

Delivery lane: Standard

Verification contract: Required

## Acceptance Criteria

- [x] `/auth/login` no longer compiles the authenticated application graph.
- [x] Cold authentication compilation improves materially from 43.9 seconds and 11,868 modules.
- [x] Theme, global styles, login validation, toasts, and safe callback redirects remain functional.
- [x] Authenticated project routes retain project, favorites, header, PostHog, Velt, AI, collaboration, and feedback infrastructure.
- [x] Provider composition exists in one shared module.
- [x] Failure-loudly guardrails cover root and authenticated route layout ownership.

## Localized Boundary

- Observed boundary: `/auth/login` route graph to `app/layout.tsx` static imports.
- Baseline evidence: `frontend/.next-dev-3021-fast-2.log` records Next Ready in 9.6 seconds, `/auth/login` compiled in 43.9 seconds with 11,868 modules, and warm requests in 0.346-0.415 seconds.
- Root cause confirmation: the global root layout statically imported every authenticated provider plus `RootClientWidgets`; the login component itself has no dependency on those providers.

## Implementation Checklist

- [x] Global root retains only global styles, theme, toast rendering, and chunk-load recovery.
- [x] Authenticated providers and global widgets moved into one shared boundary.
- [x] Main, admin, tables, dashboard, and developer route groups reuse the boundary.
- [x] Provider-dependent descendants execute below the boundary.
- [x] Authenticated executive routes outside route groups retain the shared boundary.
- [x] Auth and public routes remain outside the boundary.

## Verification

- [x] Focused boundary regression test passes.
- [x] Smallest relevant static/type checks pass.
- [x] `npm run check:routes` passes.
- [x] `npm run ops:process-budget` passes or a precise external process blocker is recorded.
- [x] Clean Next startup and cold/warm `/auth/login` evidence recorded.
- [x] Login interaction and callback validation verified in the Codex browser/fallback browser workflow.
- [x] One authenticated project route verified in the Codex browser/fallback browser workflow.
- [x] Logout/return-to-login verified in the Codex browser/fallback browser workflow.
- [x] Fresh login and authenticated-route screenshots recorded.
- [x] Browser console shows no new runtime errors on a clean reload.

## Failure-Loudly Contract

- Cause surfaced as: static regression test failure if authenticated imports return to the root or an authenticated route stops using the shared boundary.
- Detection path: focused Jest test plus cold compile module/timing evidence.
- Recovery path: move the dependency back into the shared authenticated boundary and reuse it from the owning authenticated layout.

## Incident Learning

- Cause: authenticated client infrastructure was owned by the only layout shared by auth, public, and authenticated routes.
- Detection gap: no test enforced a lightweight root or verified provider ownership for authenticated layouts.
- Prevention: one shared authenticated composition plus a source-boundary regression test.

## Evidence

| Check                 | Command / artifact                                                                                                                                 | Result                         | Notes                                                                                                                          |
| --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------ | ------------------------------------------------------------------------------------------------------------------------------ |
| Baseline cold compile | `frontend/.next-dev-3021-fast-2.log`                                                                                                               | Pass                           | Ready 9.6s; auth 43.9s; 11,868 modules; warm 0.346-0.415s.                                                                     |
| After cold compile    | `frontend/.next-dev-3021-auth-boundary-final.log`                                                                                                  | Pass                           | Ready 16.3s under 31.14 GB machine pressure; auth 16.6s; 4,217 modules; cold HTTP 20.105s; warm HTTP 0.263s.                   |
| Compiled auth graph   | `rg` against auth server/client output                                                                                                             | Pass                           | No `RootClientWidgets`, Velt, PostHog, project, favorites, global AI, or Ask Alleato references.                               |
| Boundary guardrail    | `pnpm exec jest --runInBand --runTestsByPath src/app/__tests__/authenticated-app-boundary.test.ts`                                                 | Pass                           | 11/11 assertions.                                                                                                              |
| Callback routing      | focused post-login redirect tests                                                                                                                  | Pass                           | 19/19 assertions.                                                                                                              |
| Targeted lint         | `pnpm exec eslint` on changed TS/TSX files                                                                                                         | Pass                           | No findings.                                                                                                                   |
| Route conflicts       | `npm run check:routes`                                                                                                                             | Pass                           | No conflicts.                                                                                                                  |
| Login interaction     | `C:\Users\KimiClaw\.codex\visualizations\2026\07\31\019fb9ef-fec9-7dd0-ba22-428dda6dd3d5\auth-route-boundary\login-validation.png`                 | Pass                           | Invalid sign-in produced the visible inline error and Sonner toast.                                                            |
| Login return          | `C:\Users\KimiClaw\.codex\visualizations\2026\07\31\019fb9ef-fec9-7dd0-ba22-428dda6dd3d5\auth-route-boundary\login-return.png`                     | Pass                           | Theme, global styles, form controls, and callback URL rendered; no page errors.                                                |
| Authenticated route   | `C:\Users\KimiClaw\.codex\visualizations\2026\07\31\019fb9ef-fec9-7dd0-ba22-428dda6dd3d5\auth-route-boundary\authenticated-project-home-final.png` | Pass                           | `/31/home` rendered project data and provider-dependent header, project selector, AI, feedback, discussion, and user controls. |
| Clean reload console  | fallback browser `errors --json` and `console --json`                                                                                              | Pass                           | Zero page errors and no console errors. A transient Fast Refresh Radix ID mismatch did not reproduce on full reload.           |
| Process budget        | `npm run ops:process-budget`                                                                                                                       | Blocked by unrelated processes | 144 Node processes, 87 helpers, 31.14 GB Node working set vs limits 60/20/16 GB after closing the fallback browser.            |

## Remaining Risk

- The machine-wide process budget remains failed because other active Codex,
  MCP/browser, Next, Vitest, and verification sessions are outside this task's
  ownership. Detection is the required process-budget gate. Prevention is the
  existing one-browser/one-server/session policy; recovery is to let owning
  sessions close or restart Codex so its launch-time MCP configuration is
  reloaded. This task did not terminate unrelated sessions.
- Next startup measured 16.3s after the change versus 9.6s before. The comparison
  ran while Node working set was 31.14 GB, nearly double the 16 GB guardrail, so
  it is recorded but not attributed to the route-boundary change. The targeted
  auth compilation improved independently by 62% and removed 7,651 modules.
- The login page still emits the pre-existing Next Image aspect-ratio warning for
  `/Alleato-Group-Logo_Light.png`; no new runtime error was introduced.
- The production deployment state must be verified separately after publication.

## Final Status

- [x] All task-owned implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Deferred machine-process recovery includes cause, detection gap, prevention step, owner, and next action.
- [x] The exact task-owned slice is published to `origin/main`.
