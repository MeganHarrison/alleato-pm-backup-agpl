# Task: Standard Main Publisher

Status: In Progress
Owner: Codex
Created: 2026-07-21
Task ID: AAI-1240
Linear Issue: [AAI-1240](https://linear.app/megankharrison/issue/AAI-1240/make-canonical-checkout-workflow-resilient-to-concurrent-scoped-work)
Related Handoff: `docs/ops/handoffs/2026-07-21-SROOT1240-standard-main-publisher.md`

## Objective

Make `codex:finish` publish exact committed task files through the remote CAS publisher instead of rebasing or stashing the shared checkout.

## Acceptance Criteria

- [x] No `pull --rebase --autostash` path remains in normal finish.
- [x] Standard finish delegates exact staged files to the remote publisher.
- [x] The standard publisher is remotely published.

## Evidence

| Check | Result |
| --- | --- |
| `node --check scripts/ops/codex-finish.mjs` | Pass |
| no rebase/autostash search | Pass |
| remote CAS publication | Pass — `464662b6ee79c88a843209120c0e7a388bd6779b` |

## Final Status

- [x] All required checklist items are complete.