# Task: Remove Redundant Training Navigation

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: local-training-nav-removal
Linear Issue: N/A — user-reported visual defect
Related Handoff: N/A

## Objective

Remove the duplicate Training navigation and Alleato logo below the shared app header.

## Scope

- `frontend/src/app/(main)/training/layout.tsx`

Delivery lane: Standard

## Acceptance Criteria

- [x] Training layout no longer renders `TrainingNav`.
- [x] The shared app shell remains the only page-level navigation.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Complexity audit | Passed | The changed training layout passes the Alleato surface-complexity audit. |
| Live route | Passed | `/training` compiles after removal. |

## Final Status

- [x] Published and verified.
