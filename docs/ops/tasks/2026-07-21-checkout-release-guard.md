# Task: Checkout Release Guard

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1240
Linear Issue: [AAI-1240](https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1240-checkout-release-guard.md`

## Objective

Prevent a writer from releasing a lease while its owned paths are still dirty, unless it records an explicit reasoned handoff.

## Scope

- `checkout-session-gate` release contract and focused tests.
- Excludes reconciliation or publication of work belonging to current sessions.

Verification contract: Not applicable — executable workflow behavior is verified by focused tests.

## Acceptance Criteria

- [x] Normal release fails with the exact owned dirty paths.
- [x] A reasoned `--handoff` is retained in lease history.
- [x] Focused regression tests pass.

## Failure-Loudly Contract

- Cause surfaced as: owned dirty paths at release.
- Detection path: `checkout-session-gate release` and its focused test.
- Recovery path: publish the scope, or use `--handoff --reason` to preserve explicit transfer evidence.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope captured before implementation. |
| Focused contract | `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` | Pass | 14/14, including dirty-release refusal and reasoned-handoff history. |
| Live audit | `node scripts/ops/checkout-session-gate.mjs audit --session SROOT1240` | Blocked (unrelated) | Detected unleased `frontend/src/app/(main)/ai-dashboard/ai-os/ai-os-charts.tsx`; no owned file was changed or staged in response. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |

## Final Status

- [ ] All implementation and publication items are complete.
- [x] Evidence is filled in.