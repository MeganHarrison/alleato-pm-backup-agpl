# Task: One-command authenticated browser E2E

Status: In Progress
Owner: Codex
Created: 2026-07-31
Task ID: browser-e2e-one-command
Linear Issue: Not requested; bounded single-session tooling work
Related Handoff: N/A

## Objective

Provide one canonical command that authenticates a browser E2E session, verifies a protected route, runs optional agent-browser actions, and captures reviewable evidence.

## Scope

- Root `e2e:browser` command and the existing browser-evidence runner.
- Existing authenticated preflight as the sole auth owner, including its Playwright CLI and secure-environment contracts.
- Excludes application authentication, test identities, and browser-action syntax changes.

## Source of Truth

- Canonical runtime owner: `scripts/agent-browser/agent-browser-verify.mjs`
- Existing shared primitives/services: `scripts/verification/prepare-authenticated-browser.mjs`
- Deprecated or parallel paths: direct auth refresh inside the evidence runner

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] `npm run e2e:browser -- --route <path>` is the documented canonical command.
- [x] Authentication is delegated to the shared preflight before evidence capture.
- [x] Login and access-denied landings fail with an actionable error.
- [x] Browser-reported errors fail the evidence run rather than creating a false pass.
- [x] Successful provider-auth output is retained, so a missing auth state cannot appear as a silent pass.
- [x] Existing full-URL invocation remains supported.

## Implementation Checklist

- [x] Root script alias points to the existing evidence-runner owner.
- [x] Runner accepts short `--route`, `--base-url`, and `--actions` inputs.
- [x] Targeted unit coverage covers target resolution, dependency and secure environment reuse, and landing classification.
- [x] Documentation names the new canonical command.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failure is recorded with its exact command and evidence route.
- [x] Task-owned files were published to `origin/main` at `1c1697f48883f06601c6c7f9689d6cf92806e41e`.

## Failure-Loudly Contract

- Cause surfaced as: the authenticated preflight failure, login redirect, access-denied reason, or browser console error.
- Detection path: `npm run e2e:browser -- --route <path>`.
- Recovery path: repair the test identity or target server, then rerun the same command.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: Browser evidence and browser authentication used overlapping entry points.
- Detection gap: E2E callers had to select and compose auth and evidence commands manually.
- Prevention: The evidence runner delegates authentication to one canonical preflight.
- Guardrail evidence: targeted runner tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and done gate captured before implementation. |
| Focused tests | `node --test scripts/agent-browser/__tests__/agent-browser-verify-auth.test.mjs scripts/verification/__tests__/prepare-authenticated-browser.environment.test.mjs scripts/verification/__tests__/prepare-authenticated-browser.cookies.test.mjs` | Pass | 15 tests passed. |
| Command help | `npm run e2e:browser -- --help` | Pass | Documents the canonical route, origin, actions, name, and session inputs. |
| Production authenticated path | `npm run e2e:browser -- --base-url https://projects.alleatogroup.com --route /tasks --name browser-e2e-runner-live --session browser-e2e-runner-live` | Pass (auth boundary) | Refreshed test auth, reached `/tasks`, and wrote video, screenshots, DOM snapshots, and console/error logs. |
| Browser error guard | `npm run e2e:browser -- --base-url https://projects.alleatogroup.com --route /tasks --name browser-e2e-error-guard --session browser-e2e-error-guard` | Expected fail | Summary correctly reports FAIL and the 401/500 browser errors rather than treating the screenshot as a pass. |

## Remaining Risk

- A local app server still must be running before the runner can reach a local route; the preflight reports the actual connection/auth failure instead of producing anonymous evidence.
- Unrelated application defect: the production `/tasks` page returns 401/500 and visibly reports `permission denied for table tasks`. Evidence: `npm run e2e:browser -- --base-url https://projects.alleatogroup.com --route /tasks --name browser-e2e-error-guard --session browser-e2e-error-guard`, run summary `tests/agent-browser-runs/2026-07-31T14-36-21-322Z-browser-e2e-error-guard/VERIFICATION_SUMMARY.md`. Owner: Tasks data/auth boundary. Next action: separately trace the deployed task query from authenticated identity through RLS to API response.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
