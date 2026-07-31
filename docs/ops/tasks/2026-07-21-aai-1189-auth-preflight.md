# Task: Fail Browser Verification on Project Authorization Denials

Status: Complete
Owner: Codex SROOT1189D
Created: 2026-07-21
Task ID: AAI-1189
Linear Issue: [AAI-1189](https://linear.app/megankharrison/issue/AAI-1189/enable-field-schedule-updates-with-impact-audit)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1189D-aai-1189-auth-preflight.md`

## Objective

Browser verification must fail loudly when a protected canonical route reaches an access-denied page, rather than recording it as successful evidence.

## Scope

- `scripts/agent-browser/agent-browser-verify.mjs` and its focused contract test.
- Detect login redirects and project authorization denials before screenshots/actions are treated as evidence.
- Excludes changing product authorization policy or test-user membership data.

## Source of Truth

- Canonical runtime owner: `scripts/agent-browser/agent-browser-verify.mjs`
- Existing shared primitives/services: `frontend/tests/auth.setup.ts`, `frontend/tests/.auth/user.json`
- Deprecated or parallel paths: N/A

Verification contract: Required

## Acceptance Criteria

- [x] Protected-route verification rejects both login and access-denied landings with cause, detection gap, and recovery instruction.
- [x] A focused automated test covers the access-denied classification.
- [x] A real canonical browser run confirms an authenticated schedule route is evaluated after the production environment repair.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared verifier abstraction owns cross-cutting landing checks.
- [x] Errors are specific and actionable.
- [x] Authentication and delivery contracts are in scope.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: login redirect or access-denied reason with the attempted canonical route.
- Detection path: `npm run verify:browser -- --url <canonical-route>`.
- Recovery path: repair the saved session or deployment authorization/data binding, then rerun the verifier.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: the verifier only classified `/auth/login` as an authentication failure, so an `access-denied?reason=no-profile` landing could be captured as evidence.
- Detection gap: landing validation did not inspect authorization-denied routes.
- Prevention: one shared protected-landing classifier plus a focused contract test.
- Guardrail evidence: `node --test scripts/agent-browser/__tests__/agent-browser-verify-auth.test.mjs` (3/3 pass).

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and done gate captured before implementation. |
| TDD red/green | `node --test scripts/agent-browser/__tests__/agent-browser-verify-auth.test.mjs` | Pass | Red import failure preceded the 3/3 green classifier contract. |
| Syntax | `node --check scripts/agent-browser/agent-browser-verify.mjs` | Pass | The shared verifier parses. |
| Canonical route | `npm run verify:browser -- --url https://projects.alleatogroup.com/43/schedule --name aai-1189-auth-preflight` | Pass | The regenerated test session reaches the schedule route after the production configuration repair. |
| UI proof | Linear attachments `6d598633-acc2-4810-9a55-7d114e2a88eb`, `a88e4340-35ec-4359-920c-6d3cc0e1fe95` | Pass | Desktop and mobile canonical-route evidence is viewable on AAI-1189. |

## Remaining Risk

- No remaining risk for this guardrail. Parent AAI-1189 still awaits independent review before closure.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
