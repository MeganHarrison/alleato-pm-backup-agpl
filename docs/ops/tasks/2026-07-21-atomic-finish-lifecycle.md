# Task: Atomic Finish Lifecycle

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1240
Linear Issue: [AAI-1240](https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1240-atomic-finish-lifecycle.md`

## Objective

Make normal finish ordered and mandatory: test, commit exact files, remote-publish, then release the named lease.

## Acceptance Criteria

- [x] Normal finish requires an active session ID.
- [x] Lease release occurs only after remote publication succeeds.
- [ ] The lifecycle guard is remotely published.

## Evidence

| Check | Result |
| --- | --- |
| syntax | `node --check scripts/ops/codex-finish.mjs` pass |
| missing-session guard | pass — normal publish is rejected before staging |
| help contract | pass — `--session <id>` documented |

## Final Status

- [ ] All required checklist items are complete.
