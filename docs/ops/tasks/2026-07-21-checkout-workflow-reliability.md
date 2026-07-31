# Task: Checkout Workflow Reliability

Status: Complete
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1240
Linear Issue: [AAI-1240](https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1240-checkout-workflow-reliability.md`

## Objective

Make normal, non-overlapping work claimable and publishable despite other scoped work, while making stale ownership recover automatically and loudly without discarding any work.

## Scope

- The canonical checkout lease command, its executable contract tests, and the worker/leader operating guidance.
- Excludes moving, deleting, stashing, or committing work owned by another session.

## Source of Truth

- Canonical runtime owner: `scripts/ops/checkout-session-gate.mjs`
- Existing shared primitives/services: `scripts/ops/codex-finish.mjs`
- Deprecated or parallel paths: shared mutable session-board updates as a prerequisite to routine claims.

Verification contract: Not applicable — this is an executable repository-maintenance workflow; command tests and live command readback are the observable outcome.

## Acceptance Criteria

- [x] Status distinguishes a usable scoped checkout from a genuinely unsafe checkout.
- [x] A normal claim automatically ignores expired, non-overlapping reservations and no session can manually clear a fresh lease.
- [x] Live owners can renew their reservation without editing shared control-plane files.
- [x] Stale recovery preserves dirty work and names the next safe action.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared lease abstraction owns liveness and stale-recovery behavior.
- [x] Errors are specific and actionable.
- [x] Coordination guidance uses the lease as the runtime ownership source.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Actual command readback proves a non-overlapping lease can coexist with unrelated dirty work.
- [x] Evidence artifacts are recorded.
- [x] Known unrelated failures name the exact command and owner files.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: explicit active/stale lease state, overlap, or pre-dirty owned path.
- Detection path: `status`, `claim`, and focused command tests.
- Recovery path: renew live work; expired leases are reaped without touching files; tracked dirty work remains attributed and must be published or handed off.

## Incident Learning

- Failure fingerprint: `session.checkout-ownership-drift`
- Root cause: an unsafe-status exit and shared control-plane prerequisite caused agents to treat unrelated scoped work as a global stop; stale reservation liveness was not modeled.
- Detection gap: command status did not state whether a new non-overlapping claim was safe.
- Prevention: path-scoped leases become the operational owner, have an explicit heartbeat/TTL, and status reports safe next actions.
- Guardrail evidence: focused checkout-session-gate tests.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file | Pass | Scope and failure-loudly contract captured before implementation. |
| Focused contract | `node --test scripts/ops/__tests__/checkout-session-gate.test.mjs` | Pass | 13/13 — scoped status, stale expiry, heartbeat, resume, manual-recovery removal, quarantine, and audit behavior. |
| Live scoped readback | `node scripts/ops/checkout-session-gate.mjs status` | Pass | 34 unrelated dirty paths and active leases are explicitly reported as non-blocking for a non-overlapping claim. |
| Live resume + audit | `claim ... --resume` then `audit --session SROOT1240` | Pass | Session resumed only its recorded scope and audit renewed its heartbeat without absorbing external paths. |
| Diff hygiene | `git diff --check` | Pass | No whitespace errors. |
| Unrelated-work audit | `node scripts/ops/checkout-session-gate.mjs audit --session SROOT1240` | Blocked (unrelated) | `SROOT-PI-ARCH` released its lease while `scripts/intelligence/{run-scheduled-daily-executive-brief.mjs,lib/executive-intelligence-run.mjs,__tests__/executive-intelligence-run.test.mjs}` and `docs/ops/tasks/2026-07-21-remove-unrelated-intelligence-staging.md` remained dirty. No task-owned files were staged or changed in response. |
| Publish preflight | `git fetch origin main && git rev-list --left-right --count origin/main...HEAD` | Pass | Once concurrent main moved, `origin/main` was an ancestor of the exact commit; no rebase or stash was needed. |
| Publication | `git push origin main` then `HEAD == origin/main` | Pass | `fa98a5273` is published to `origin/main`. |

## Remaining Risk

- Existing tracked dirty files remain protected until their owners publish or deliberately hand them off. They did not block this exact-file publication once `origin/main` advanced to an ancestor.

## Final Status

- [x] All required checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is linked or explicitly N/A.
- [x] Any deferred work has cause, detection gap, prevention step, owner, and next action.
