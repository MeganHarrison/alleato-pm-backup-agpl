# Leader Runbook

Use this in the single leader session only.

## Goal

Create order across parallel sessions by controlling ownership, evidence, and acceptance.

## Start Of Day

1. Open `docs/ops/memory/current-state.md`.
2. Reset/confirm `session-board.md` statuses.
3. Prioritize top tasks and assign one owner per task.
4. Ensure High-risk and multi-session tasks have one Linear issue; do not create tracking work for Fast changes.
5. Ensure each task has a clear definition of done.

## Assignment Rules

- One worker session = one active task.
- Canonical main is integration-only. Every mutating worker uses an isolated session workspace.
- Do not assign overlapping file ownership unless explicitly coordinated.
- High-risk and multi-session assignments must include:
  - Scope
  - Required evidence
  - Stop condition
- Linear issue ID when in scope
  - Whether subtasks are required before implementation

Create the isolated workspace before any mutation:

```bash
node scripts/ops/isolated-session-workspace.mjs create \
  --session S<id> --task <Linear-id> \
  --paths <exact-owned-paths> --expires-hours 24
```

This is safe even when canonical main contains unrelated integration work. It rejects overlapping ownership and records the actual Codex task identity, workspace, branch, base commit, and expiry.

After the worker commits its task-owned files, generate the durable integration receipt:

```bash
node scripts/ops/isolated-session-workspace.mjs handoff --session S<id> --task <Linear-id>
```

Integrate only the manifest's exact commits. Retire the workspace only after its head is present on `origin/main`.

## Review Rules

A handoff is `Accepted` only if it includes:

- Linear issue ID and URL
- Latest Linear Codex update comment
- Exact commands run
- Pass/fail outcome summary
- Artifact paths (logs/screenshots/reports)
- Files changed
- Known risks and next step

If any are missing, mark `Needs Rework` with explicit reason.

Also post the same acceptance or rework reason to the Linear issue. Linear is the source of truth for issue state; `review-queue.md` is the local evidence ledger.

## Fast Intake (No Manual Copy/Paste)

Use filesystem-driven intake instead of chat relays:

```bash
node scripts/ops/worker-status.mjs
# Optional date override:
node scripts/ops/worker-status.mjs 2026-04-14
```

This reports missing handoff sections per worker session so you can disposition quickly.

## Enforcement

- A worker cannot start a new High-risk or multi-session task while its previous handoff is `Pending Review` or `Needs Rework`.
- Unclaimed work is invalid and not merged.
- "Fixed" without evidence is automatically rejected.
- Fast and Standard single-session work does not require Linear or a review queue entry.
- Parent issues with multiple active slices must be decomposed into Linear sub-issues before workers start.

## Dirty Checkout Recovery

Dirty state is an ownership incident, not a reason for every session to stop indefinitely.

1. Run `node scripts/ops/checkout-session-gate.mjs status`. A dirty checkout or a non-overlapping active lease is informational, not a global stop: immediately claim the exact new task paths.
2. The Git lease file is the live locking authority. Session board and handoff rows are audit records and must not be edited before a normal claim.
3. If the exact requested path overlaps an active lease, coordinate that owner; never quarantine active or tracked work.
4. Leases that miss their heartbeat TTL are automatically expired by the next gate command. This clears only the reservation; their dirty paths remain protected and attributed in lease history. Manual recovery is intentionally unavailable so a live owner cannot be cleared by a different session.
5. If an exact untracked path has no owner, prove it is inactive: record its age and verify it has no open file handle.
6. Preserve it with the governed recovery command:

```bash
node scripts/ops/checkout-session-gate.mjs quarantine \
  --session S<id> \
  --task <Linear-id> \
  --reason "why the work is stale and ownerless" \
  --paths <exact-repo-relative-path[,path...]> \
  --stale-minutes 60
```

7. Read the printed manifest path, confirm the claimed path is clean, and immediately claim its writer lease.

Quarantine is recoverable preservation outside the checkout. It refuses active leases, tracked modifications, ignored files, fresh paths, symbolic links, broad repository roots, outside paths, and open handles. Never substitute `git clean`, stash, reset, branch switching, or deletion.

During an active lease, run this at each milestone and before publication. It both audits scope and renews the heartbeat:

```bash
node scripts/ops/checkout-session-gate.mjs audit --session S<id>
```

The audit fails if another session mutated a path outside all active leases. Do not absorb or stage those paths. Non-overlapping scopes may proceed concurrently in the canonical checkout; overlapping scopes require explicit reassignment.

## End Of Day

1. Move unresolved items into tomorrow's priorities.
2. Confirm `review-queue.md` statuses are current.
3. Update `docs/ops/memory/current-state.md`.
4. Add a weekly log entry in `docs/ops/logs/`.
