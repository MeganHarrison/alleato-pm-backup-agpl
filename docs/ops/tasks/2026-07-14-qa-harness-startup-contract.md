# Task: Canonical QA Harness Startup Contract

Status: Complete
Owner: Codex
Created: 2026-07-14
Task ID: QA-HARNESS-2026-07-14
Linear Issue: Micro-change fast path; no Linear issue required.
Related Handoff: N/A — micro-change fast path; evidence is self-contained in this task and the verification result.

## Objective

Make the default local frontend startup and protected-route auth verification reliable for unattended sub-agent QA.

## Scope

- Align the managed frontend launcher with the canonical Playwright/browser default port.
- Allow a cold Next.js compile during protected-route auth verification.
- Explicit exclusion: product feature changes and unrelated staged or untracked worktree changes.

## Source of Truth

- Managed frontend launcher: `scripts/dev/start-frontend-clean.sh`
- Auth setup: `frontend/tests/auth.setup.ts`
- Browser default: `scripts/agent-browser/agent-browser-verify.mjs`

Verification contract: Required

## Acceptance Criteria

- [x] `npm run dev:frontend` defaults to the same port as Playwright and agent-browser.
- [x] Cold-start protected-route auth verification allows compilation latency without hiding auth failures.
- [x] Existing Documents browser smoke flow still passes after the harness change.
- [x] Independent review approves the change.

## Implementation Checklist

- [x] Only the shared launcher and auth setup were changed.
- [x] The timeout rationale is documented at the owner boundary.
- [x] Unrelated worktree changes remain untouched.

## Integration and Verification

- [x] Shell syntax check passes.
- [x] Cold-start auth setup passes.
- [x] Canonical Documents browser smoke passes.
- [x] Evidence artifacts are recorded.
- [x] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: protected-route auth verification timeout with the operation and route identified.
- Detection path: `tests/auth.setup.ts` setup result and browser smoke artifacts.
- Recovery path: inspect the local server URL/compile logs, then rerun auth setup against the canonical base URL.

## Incident Learning

- Failure fingerprint: `process.claimed-verification-without-runtime-evidence`
- Root cause: local QA startup used different default ports and a timeout shorter than a cold compile.
- Detection gap: no startup contract asserted that the launcher, auth setup, Playwright, and agent-browser shared one default.
- Prevention: canonical port plus explicit cold-start timeout budget and an authenticated smoke flow.
- Guardrail evidence: `scripts/verification/fixtures/evidence/qa-harness-summary.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Launcher default | `npm run dev:frontend` | Pass | Started at `http://localhost:3000`. |
| Cold-start auth | `BASE_URL=http://localhost:3000 PLAYWRIGHT_BASE_URL=http://localhost:3000 npx playwright test tests/auth.setup.ts --config config/playwright/playwright.no-webserver.config.ts --project setup` | Pass | 1 passed in 23.7s. |
| Documents smoke | `scripts/verification/fixtures/evidence/qa-harness-summary.md` | Pass | Route, search, settings, responsive list, drawings filter, viewer, and zoom exercised; raw screenshots remain in the browser-run evidence folder. |
| Independent review | `scripts/verification/fixtures/evidence/qa-harness-independent-review.md` | Pass | Erdos approved the two-file harness repair; shell syntax and boundary choices were reviewed. |

## Remaining Risk

- Independent review and publication are complete. Unrelated worktree changes are intentionally excluded.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
