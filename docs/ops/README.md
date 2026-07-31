# Engineering Memory System

This directory is the canonical memory system for ongoing engineering work.

## Goals

- Preserve context between sessions
- Prevent repeated failures
- Record why decisions were made
- Make resuming work deterministic

## Update Rules

1. Update `memory/current-state.md` at the start and end of focused work.
2. Add one entry to the current weekly file in `logs/` for each meaningful change.
3. Capture durable decisions in `adr/` using the ADR template.
4. When an issue repeats, update `lessons/recurring-failures.md` before closing it.
5. End each session with a handoff note in `handoffs/`.

## Folder Map

- `memory/`: Active context and near-term priorities.
- `logs/`: Time-ordered progress and evidence.
- `adr/`: Architecture Decision Records.
- `lessons/`: Recurring failures, root causes, and guardrails.
- `patterns/`: Reusable implementation patterns and anti-patterns.
- `handoffs/`: Session handoff notes for fast resumption.
- `migrations/`: Audits and migration notes from legacy docs.
- `orchestration/`: Leader/worker operating model for parallel sessions.
- `project-intelligence-runbook.md`: Production monitoring, recovery, and
  verification procedure for the daily Project Intelligence workflow.

## Multi-Session Rule

When running parallel sessions, `docs/ops/orchestration/` is mandatory:

1. Leader uses `leader-runbook.md`.
2. Workers follow `worker-protocol.md`.
3. All tasks must be claimed in `session-board.md`.
4. All completed work must pass through `review-queue.md`.

## Definition Of Done For Documentation

A change is documented when:

- Current status is reflected in `memory/current-state.md`
- Evidence is logged in the weekly log
- Any new decision has an ADR
- Any repeated failure has a prevention entry
