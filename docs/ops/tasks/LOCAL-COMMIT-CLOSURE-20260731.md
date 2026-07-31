# Task: Enforce clean commit closure

Status: Ready to Publish
Owner: Codex
Created: 2026-07-31
Task ID: LOCAL-COMMIT-CLOSURE-20260731
Linear Issue: Not requested
Related Handoff: N/A

## Objective

Prevent a new canonical-checkout task from starting over unrelated dirty work, and require an explicit handoff for any unfinished scope.

## Scope

- Canonical checkout writer and publisher gates and their regression checks.
- Repository instructions governing task closure.
- Excludes recovery of historical branches and stashes.

## Source of Truth

- Canonical runtime/data owner: `scripts/ops/checkout-session-gate.mjs`
- Existing shared primitives/services: `scripts/ops/codex-finish.mjs`
- Deprecated or parallel paths: permissive path-scoped parallel writer behavior in the canonical checkout.

Delivery lane: Standard

Verification contract: Optional

## Acceptance Criteria

- [x] A dirty canonical checkout refuses a new writer claim.
- [x] An active canonical writer lease refuses a second writer claim.
- [x] A handoff is the only allowed route to resume owned dirty work.
- [x] Repository instructions prohibit stash-based task closure.
- [x] The publisher refuses a selected scope that would leave unrelated dirty work behind.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared gate owns cross-cutting enforcement.
- [x] Errors explain the recovery action.
- [x] No database, provider, authentication, permission, or delivery contract applies.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual user-flow or live-system readback proves the requested outcome when applicable.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: canonical checkout is dirty or already has an active writer.
- Detection path: `checkout-session-gate claim`.
- Recovery path: publish the active scope or use an explicit handoff/registered isolated workspace.

## Incident Learning

- Failure fingerprint: `session.checkout-ownership-drift`
- Root cause: canonical writer gate allowed unrelated dirty work and parallel writer leases.
- Detection gap: completion was not mechanically tied to a clean checkout and published commit.
- Prevention: single-writer clean-start gate with regression coverage.
- Guardrail evidence: `scripts/ops/__tests__/checkout-session-gate.test.mjs`

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- |
| Task setup | This task file | Pass | Scope and closure gate captured before implementation. |
| Regression suite | `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` | Pass | 15/15 tests passed; clean-start and single-writer rejection are covered. |
| Publisher syntax | `node --check scripts/ops/codex-finish.mjs` | Pass | Closeout guard parses successfully. |

## Remaining Risk

- Historical local branches and recovery stashes require separate explicit retirement decisions.

## Final Status

- [x] All required checklist items are complete except publication.
- [x] Evidence is filled in.
- [x] Incident learning is linked.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
