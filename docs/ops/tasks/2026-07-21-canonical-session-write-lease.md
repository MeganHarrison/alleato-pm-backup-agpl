# Task: Canonical Session Write Lease

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1232
Linear Issue: [AAI-1232](https://linear.app/megankharrison/issue/AAI-1232/prevent-codex-dirty-checkout-collisions-with-a-canonical-writer-lease)
Related Handoff: `docs/ops/handoffs/2026-07-21-S209-canonical-session-write-lease.md`

## Objective

Allow concurrent Codex sessions to research and verify in parallel while permitting only one controlled writer in the canonical `main` checkout, so dirty-state collisions cannot lose work or create branches/worktrees.

## Scope

- A repository-owned lease command stored in the shared Git metadata.
- Mandatory canonical-checkout, clean-baseline, main-branch, ownership, and recovery checks.
- Explicitly excludes deletion of existing worktrees or refs; recovery remains a separately reviewed operation.

## Source of Truth

- Canonical owner: the Git checkout registered by `checkout-session-gate.mjs bootstrap`.
- Existing publish owner: `scripts/ops/codex-finish.mjs`.
- Deprecated parallel path: concurrent uncommitted product edits, automatic worktree creation, and routine task branches.

Verification contract: Not applicable

This is a repository-maintenance command with focused executable coverage, not
a user-facing runtime flow. The observed command output and command tests are
the applicable evidence.

## Acceptance Criteria

- [x] A session cannot acquire a write lease outside the canonical checkout, off `main`, or with a dirty baseline.
- [x] A second session gets an actionable conflict error rather than writing into a dirty checkout.
- [x] A lease records task, owner, and owned paths and can be released only by its owner.
- [x] Stale leases are discoverable and require explicit recovery rather than silent replacement.
- [x] Automated tests prove the failure-loudly contract.

## Implementation Checklist

- [x] Add the shared lease command and focused tests.
- [x] Add the mandatory session lifecycle to `AGENTS.md`.
- [x] Record recovery guidance and handoff evidence.

## Integration and Verification

- [x] Focused command tests pass.
- [x] The command reports the current checkout's unsafe state without mutation.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: canonical checkout, branch, dirty baseline, or lease-owner error naming the recovery action.
- Detection path: `node scripts/ops/checkout-session-gate.mjs status`.
- Recovery path: preserve the existing diff, reconcile its owner, then release/recover the named lease explicitly.

## Incident Learning

- Failure fingerprint: `session.checkout-ownership-drift`
- Root cause: several sessions leave uncommitted edits in one checkout while others switch branches or create unmanaged worktrees.
- Detection gap: the publish command checked `main`, but no write-time guard asserted checkout ownership and cleanliness.
- Prevention: one canonical writer lease with explicit lifecycle commands and an immutable audit record.
- Guardrail evidence: `scripts/ops/checkout-session-gate.mjs` and its focused tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | In progress | Scope and failure-loudly contract defined before implementation. |
| Focused tests | `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` | Pass | 4/4: serialized writer ownership, dirty baseline rejection, main-only enforcement, and owner-scoped recovery. |
| Live unsafe-state readback | `node scripts/ops/checkout-session-gate.mjs status` | Pass (unsafe state detected) | Checkout is unregistered, on `codex/accounting-dashboard-dark-style`, has 54 dirty paths, and no active lease. No mutation occurred. |

## Remaining Risk

- The current checkout has pre-existing multi-session dirty work. Owner reconciliation is required before it can adopt the clean-baseline workflow.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
