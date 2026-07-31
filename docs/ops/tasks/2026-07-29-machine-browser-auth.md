# Task: Machine-Backed Browser Authentication

Status: Complete
Owner: Codex Sworktreeauth
Created: 2026-07-29
Task ID: local-machine-browser-auth
Linear Issue: Not requested; single-session verification-tooling correction.
Related Handoff: Not required for a Standard single-session change.

## Objective

Refresh and verify authenticated production browser sessions from any worktree
using the machine Vercel project and a safe native Windows launcher.

## Scope

- `scripts/verification/prepare-authenticated-browser.mjs`
- Focused environment, redirect, launcher, and secret-redaction tests

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] The canonical Vercel project supplies test authentication state.
- [x] Windows launches native executables without `cmd.exe`.
- [x] Login and access-denied redirects fail verification.
- [x] Cookie mutation failures cannot expose cookie values or captured output.
- [x] A fresh named session reaches the protected production `/tasks` route.

## Failure-Loudly Contract

- Cause surfaced as: missing safe executable, provider hydration failure, or rejected protected route.
- Detection path: authenticated-browser preflight plus final URL readback.
- Recovery path: repair the named machine capability and rerun the preflight.

## Evidence

| Check | Result |
| --- | --- |
| Focused Node tests | Pass, 7/7 |
| Fresh authenticated session | Pass; `https://projects.alleatogroup.com/tasks` |
| Independent security re-review | Pass; no blocking findings |
| Main publication | Pending exact-file publication through `codex:finish` |

## Remaining Risk

- None within this verifier boundary.
