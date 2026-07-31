# Quick Start (Leader + Workers)

Use this when multiple sessions are running in parallel.

## Step 1: Leader Session Setup

1. Open `docs/ops/orchestration/session-board.md`
2. Open `docs/ops/orchestration/review-queue.md`
3. Open `docs/ops/memory/current-state.md`
4. Assign each worker exactly one task with owned paths.

## Step 2: Worker Session Instruction (copy/paste)

Use this instruction at the top of each worker session:

```text
You are Worker Session S<id>.
Follow docs/ops/orchestration/worker-protocol.md.
Claim your task in docs/ops/orchestration/session-board.md before coding.
Maintain handoff at docs/ops/handoffs/YYYY-MM-DD-S<id>-<topic>.md.
Do not start new work until leader marks your current handoff Accepted.
```

Workers should update their handoff files directly. No need to paste responses back to leader chat.

## Step 3: Leader Review Loop

Every 30-60 minutes:

1. Check `review-queue.md` for `Pending Review`.
2. Run `node scripts/ops/worker-status.mjs` to detect missing intake fields.
2. Accept or mark `Needs Rework` with explicit notes.
3. Reflect accepted items in weekly log.
4. Update `current-state.md`.

## Step 4: End Of Day

- No `In Progress` task without a handoff.
- No `Pending Review` older than the review SLA.
- Priorities for next day set in `current-state.md`.
