# Task: Make Parallel Codex Sessions Recoverable and Isolated

Status: In Progress
Owner: Codex S211
Created: 2026-07-21
Task ID: AAI-1239
Linear Issue: AAI-1239 — https://linear.app/megankharrison/issue/AAI-1239/add-recoverable-orphan-work-handling-to-the-canonical-checkout-writer
Related Handoff: `docs/ops/handoffs/2026-07-21-S211-checkout-orphan-recovery.md`

## Objective

Prevent one Codex session from blocking, recovering, staging, rebasing, or overwriting another session by making canonical main integration-only and giving each mutating session an owned, expiring Git worktree with a durable commit handoff.

## Scope

- Add the isolated-session lifecycle, focused tests, and operator instructions.
- Preserve the recovered ASRS evidence with hashes and restoration instructions.
- Exclude automatic integration; canonical main reviews the manifest's exact commits.

## Source of Truth

- Canonical runtime owner: `scripts/ops/isolated-session-workspace.mjs`
- Shared primitives: Git worktrees, task-scoped branches, Git bundles, `CODEX_THREAD_ID`
- Deprecated path: concurrent mutation inside canonical main

Verification contract: Required

## Acceptance Criteria

- [x] Two non-overlapping mutating sessions can start while canonical main contains unrelated work.
- [x] Each session has a separate filesystem, branch, and Git index outside canonical main.
- [x] Overlapping ownership and spoofed session labels fail loudly.
- [x] Dirty work cannot be handed off; committed work creates a durable bundle and manifest.
- [x] Workspace owner and expiry are recorded.
- [x] Recovered ASRS evidence remains intact outside the checkout.
- [x] Failure-loudly behavior is defined.
- [x] Existing guardrails were inspected before implementation.

## Implementation Checklist

- [x] Files/modules were listed before edits.
- [x] One shared command owns create/status/handoff/retire behavior.
- [x] Errors identify overlap, identity, dirty state, missing commits, and unsafe paths.
- [x] No user work is deleted or silently overwritten.

## Integration and Verification

- [x] Focused syntax and unit tests pass.
- [x] Synthetic repository proves simultaneous isolated writers.
- [x] Synthetic repository proves durable handoff bundle and manifest.
- [x] Linear handoff validation passes.
- [x] Screenshot evidence is attached to AAI-1239.
- [ ] Task-owned files are published and `origin/main` contains the revision.

## Failure-Loudly Contract

- Cause surfaced as: path overlap, task-identity mismatch, unsafe path, invalid expiry, dirty/empty handoff, missing workspace, or unmerged retirement.
- Detection path: `node scripts/ops/isolated-session-workspace.mjs ...` and focused tests.
- Recovery path: keep the isolated workspace intact, correct ownership or commit state, regenerate the handoff, and integrate only the listed commits.

## Incident Learning

- Failure fingerprint: `session.checkout-ownership-drift`
- Root cause: mutating sessions shared one filesystem and Git index; a reusable label such as `S211` was incorrectly treated as authority.
- Detection gap: a different task could clear the lease, stage, rebase, and commit before the owner detected it.
- Prevention: filesystem/index isolation, Codex task identity, exact path ownership, expiry, and durable commit handoff.
- Guardrail evidence: `scripts/ops/__tests__/isolated-session-workspace.test.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Recovered artifact | `/Users/meganharrison/.codex/session-quarantine/20260721T182744Z-unowned-asrs-corpus-access/MANIFEST.md` | Pass | No deletion; original paths and SHA-256 retained. |
| Focused tests | `node --test scripts/ops/__tests__/isolated-session-workspace.test.mjs` | Pass | 3/3 pass. |
| Syntax | `node --check scripts/ops/isolated-session-workspace.mjs` | Pass | Command parses. |
| Visual proof | https://uploads.linear.app/ba18f798-951f-4d5a-88ee-952e1985c6eb/dca63cde-f57a-4248-90b0-253ee4c5cd4e/282f53ad-a7f9-4187-b148-34224f7bf8b2 | Pass | Viewable AAI-1239 attachment shows the verified workflow and guarantees. |

## Remaining Risk

- Canonical integration is deliberately serialized; implementation work is no longer serialized.

## Final Status

- [ ] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
