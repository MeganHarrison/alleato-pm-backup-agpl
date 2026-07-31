# Orchestration System

This system keeps parallel Codex sessions organized and reviewable.

## Roles

- Leader session: assigns work, reviews evidence, accepts/rejects handoffs.
- Worker sessions: implement one claimed task at a time and submit evidence-backed handoffs.

## Core Rule

No task is considered done until the leader marks it `Accepted` in the review queue.

Linear is the source of truth for issue ownership and state. The local orchestration files are the evidence ledger. Follow `linear-codex-process.md` for every Codex-owned issue.

## Files

- `leader-runbook.md` — step-by-step operating procedure for the leader.
- `worker-protocol.md` — mandatory protocol for every worker session.
- `linear-codex-process.md` — Linear issue, sub-issue, comment, and evidence update contract.
- `session-board.md` — live registry of active sessions and ownership.
- `review-queue.md` — handoff acceptance queue with disposition.

## Cadence

- Workers update handoff at each milestone and at stop/end.
- Leader processes review queue at fixed intervals (for example every 30-60 minutes).
