# Task: Remote Main Publisher

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1240
Linear Issue: [AAI-1240](https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1240-remote-main-publisher.md`

## Objective

Publish exact task-owned files to current `origin/main` without rebasing, stashing, branching, or touching a dirty shared checkout.

## Acceptance Criteria

- [x] Builds a commit from the current remote main tree and exact selected source files.
- [x] Uses a non-force compare-and-swap ref update and bounded retry.
- [x] Publishes the previously blocked release guardrail.

## Evidence

| Check | Command | Result |
| --- | --- | --- |
| Task setup | This file | Pass |
| Syntax | `node --check scripts/ops/remote-main-publish.mjs` | Pass |
| Dry run | `remote-main-publish ... --dry-run` | Pass |
| Live publish | `remote-main-publish --source ebc726601 ...` | Pass — `ea7c3b5dcbacd5f68a3aab96ecf6566d4d2b2d61` |

## Final Status

- [x] All required checklist items are complete.