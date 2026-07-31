# Task: Schedule verification automation

Status: Blocked/Deferred
Owner: SROOT1193B
Created: 2026-07-22
Task ID: AAI-1193 follow-through
Linear Issue: [AAI-1193](https://linear.app/megankharrison/issue/AAI-1193/provide-tradevendor-schedule-visibility-and-change-alerts)
Related Handoff: `docs/ops/handoffs/2026-07-22-SROOT1193A-trade-visibility-alerts.md`

## Objective

One deterministic command runs the focused scheduling TDD regression suite and establishes an authenticated browser session on a named canonical Schedule route.

## Scope

- Compose the existing browser-auth verifier; do not copy credentials, create a second auth mechanism, or restart shared browser work.
- Make the focused scheduling suite discoverable from the root and frontend package scripts.
- Excludes full project tests, deployment polling, and writer-lease mutation.

## Source of Truth

- Canonical auth owner: `scripts/verification/prepare-authenticated-browser.mjs`.
- Scheduling test owners: `frontend/src/{lib,components,app}/**/scheduling/**`.
- Deprecated path: hand-assembled ad hoc Jest commands and direct login attempts.

Verification contract: Required

## Acceptance Criteria

- [x] The command fails loudly for a missing/invalid project ID or unknown option.
- [x] It runs the focused scheduling TDD suite before claiming browser readiness.
- [x] It reuses the canonical browser-auth preflight and prints the exact proof route/session.
- [x] A regression test proves the command contract and focused suite passes.

## Implementation Checklist

- [x] Add red/green CLI contract tests.
- [x] Add reusable preflight script and package scripts.
- [x] Run the production-session proof using an existing authenticated session.

## Integration and Verification

- [x] Targeted static/unit checks pass.
- [ ] Actual authenticated canonical-route readback passes.
- [x] Evidence is recorded and task-owned files are published.

## Failure-Loudly Contract

- Cause surfaced as: missing project identifier, failed focused suite, or login redirect from the canonical verifier.
- Detection path: `npm run schedule:preflight -- --project-id <id>`.
- Recovery path: correct the project identifier, fix the failing focused test, or repair the shared auth verifier.

## Incident Learning

- Failure fingerprint: repeated schedule verification rediscovered test and auth setup.
- Root cause: no composed scheduling entry point existed.
- Detection gap: isolated worktree sessions used manually assembled commands and occasionally a different Vercel project.
- Prevention: a shared script composes the known focused test set with the shared canonical auth verifier.
- Guardrail evidence: CLI contract test and authenticated production readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and end-state gate recorded before implementation. |
| CLI contract | `node --test scripts/verification/__tests__/schedule-preflight.test.mjs` | Pass (3/3) | Covers required numeric project IDs, unsafe input rejection, and composition with the canonical auth verifier. |
| Focused scheduling TDD | `npm run test:schedule` | Pass (23/23) | One discoverable regression suite spans published revisions, lookaheads, risks, trade visibility, and alert contracts. |
| Canonical browser proof | `npm run schedule:preflight -- --project-id 43 --session company-table-prod` | Pass | Reused the authenticated production session and verified `https://projects.alleatogroup.com/43/schedule` after the focused suite passed. |
| Auth regression recheck | `npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /43/schedule --session company-table-prod` | Blocked | Vercel lists `NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY`, but `vercel env run` did not inject them into Playwright; auth setup failed before the route proof. The same test passed with the secure canonical local environment, proving the credentials and app are valid while the provider-env subprocess is not. |

## Remaining Risk

- Cause: Vercel CLI `env run` did not provide the encrypted Supabase variables that the shared Playwright auth setup requires.
- Detection gap: the verifier accepted an existing session in prior runs and did not assert that its provider child process received both admin variables.
- Prevention: add a verifier contract check that fails before Playwright when provider-injected admin variables are absent, then use the configured secure environment source rather than silently attempting the login path.
- Owner: Codex. Next action: repair the shared verifier’s provider-env contract, rerun its canonical proof, then remove this deferral.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
