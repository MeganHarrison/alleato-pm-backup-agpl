# Task: Authenticated Route Proof Harness

Status: Complete - Published
Owner: Codex SQA0731
Created: 2026-07-31
Task ID: LOCAL-20260731-AUTHENTICATED-ROUTE-PROOF
Linear Issue: Not required for this single-session Standard task.
Related Handoff: N/A

## Objective

Make authenticated desktop and mobile screenshot verification a single, fast,
repeatable command on Windows without visible Chrome-window accumulation.

## Scope

- Own the repository browser-proof command, auth-state reuse, runtime preflight,
  desktop/mobile artifacts, browser ownership lock, and cleanup.
- Apply the existing port-scoped Next.js build isolation contract to Windows.
- Update canonical developer guidance and focused regression tests.
- Exclude product UI, production authentication behavior, schema, deployment,
  and user-account changes.

## Source of Truth

- Canonical runtime/data owner: `scripts/verification/route-proof.mjs`
- Existing shared primitives/services: `frontend/tests/auth.setup.ts`,
  `frontend/config/playwright/playwright.no-webserver.config.ts`,
  `frontend/scripts/dev/write-dev-tsconfig.mjs`, and
  `scripts/dev/dev-launcher.mjs`
- Deprecated or parallel paths: the former `agent-browser` verifier and auth
  helper remain compatibility entrypoints only; they delegate to the route
  proof harness and own no browser lifecycle.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] One command starts or reuses an owned isolated local runtime.
- [x] Origin-scoped saved auth is reused and refreshed automatically when needed.
- [x] One headless browser process captures desktop and 390px mobile screenshots.
- [x] Login/access-denied landings, missing credentials, occupied ports, duplicate
      proof runs, runtime timeouts, and browser errors fail with actionable messages.
- [x] The browser always closes and the ownership lock always releases.
- [x] Current local and production proof runs create inspectable artifacts.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Authentication is read-only and uses a pre-existing test identity.

## Integration and Verification

- [x] Targeted Node tests pass.
- [x] A real local protected route proof produces desktop/mobile screenshots.
- [x] A real production protected route proof produces desktop/mobile screenshots.
- [x] Browser-process and runtime cleanup behavior is read back.
- [x] Task-owned files are published with exact remote blob equality. Local
      `HEAD` was intentionally not moved because the shared index contains
      another session's staged files.

## Failure-Loudly Contract

- Cause surfaced as: the first failing boundary and exact route, port, auth-state,
  runtime-log, or browser-lock path.
- Detection path: `npm run verify:browser -- --route <protected-route> --name <task>`.
- Recovery path: follow the emitted one-line recovery command; use
  `npm run verify:browser:stop` only for the harness-owned local runtime.

## Incident Learning

- Failure fingerprint: `build.silent-compiler-stall` and
  `process.claimed-verification-without-runtime-evidence`
- Root cause: Windows skipped the existing port-isolation setup, the documented
  browser helper depended on an executable blocked by Application Control, and
  the verifier closed/reopened browser sessions while omitting mobile proof.
- Detection gap: the command had no preflight asserting isolated dist ownership,
  auth-state origin, one-browser ownership, two required viewports, or artifact
  completeness.
- Prevention: one harness owns startup, auth, browser lifecycle, viewport capture,
  diagnostics, and artifact validation.
- Guardrail evidence: focused harness and Windows-launcher tests plus real local
  and production runs.

## Evidence

| Check                  | Command / artifact                                                                                                                                                                                                                           | Result            | Notes                                                                                                                                                                                                                                                      |
| ---------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Task setup             | This task file                                                                                                                                                                                                                               | Pass              | Exact scope and done gate recorded before implementation.                                                                                                                                                                                                  |
| Runtime diagnosis      | Windows process/port inventory and direct browser-helper invocation                                                                                                                                                                          | Fail localized    | Three local ports were live, many Playwright MCP server processes existed, and Windows Application Control blocked the user-level `agent-browser` executable before navigation.                                                                            |
| Focused regression     | `node --test scripts/dev/dev-launcher.test.mjs scripts/verification/__tests__/route-proof.test.mjs scripts/verification/__tests__/prepare-authenticated-browser.test.mjs scripts/agent-browser/__tests__/agent-browser-verify-auth.test.mjs` | Pass, 12/12       | Covers Windows port isolation, origin-scoped auth, protected-route classification, historical CLI compatibility, and overlapping browser ownership.                                                                                                        |
| Local route proof      | `npm run verify:browser -- --route /tasks --name qa-harness-local-release`                                                                                                                                                                   | Pass with warning | Settled authenticated desktop/mobile artifacts under `tests/agent-browser-runs/2026-07-31T18-15-49-016Z-qa-harness-local-release/`; final route `/tasks?view=board`. The harness surfaced one background 5xx in `browser-errors.log` instead of hiding it. |
| Production route proof | `npm run verify:browser -- --url https://projects.alleatogroup.com/tasks --name qa-harness-production-release`                                                                                                                               | Pass              | Settled authenticated desktop/mobile artifacts under `tests/agent-browser-runs/2026-07-31T18-16-16-284Z-qa-harness-production-release/`; zero page errors and zero 5xx responses.                                                                          |
| Browser singleton      | Production saved-auth rerun plus Chrome process readback                                                                                                                                                                                     | Pass              | Auth was reused; visible Chrome windows were 1 before and 1 after, total Chrome processes fell from 45 to 39, and the browser lock was absent after capture.                                                                                               |
| Runtime cleanup        | `npm run verify:browser:stop` plus port/state readback                                                                                                                                                                                       | Pass              | Port 3100 closed, runtime state was removed, and no browser lock remained. A subsequent proof restarted the runtime successfully; final localhost is intentionally warm.                                                                                   |
| Exact-file publication | `remote-main-publish.mjs` plus remote blob/deletion readback                                                                                                                                                                                 | Pass              | Published 15 exact paths at `5836df63649ec0b491a1451ee25f1b3c23cdb572`; 13 file blobs matched and both retired test files were absent. The unrelated shared index was untouched.                                                                           |

## Remaining Risk

- Production proof still depends on the configured pre-existing test identity
  and Supabase availability. The harness now fails before capture if those
  secure prerequisites are missing or rejected.
- Local `/tasks` currently reports a background `/api/comments/all` 5xx caused
  by missing Velt credentials. The proof completes with an explicit warning and
  log rather than blocking screenshots or describing the route as fully healthy.
  Production is clean, so provider configuration for the local collaboration
  surface remains the separate owner action.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
