# Task: Training Barrel Export Deduplication

Status: Complete
Owner: Codex
Created: 2026-07-27
Task ID: local-training-barrel-exports
Linear Issue: N/A — local compilation recovery
Related Handoff: N/A

## Objective

Restore the Training route by exporting each public training symbol once.

## Scope

- `frontend/src/features/training/index.ts`

Delivery lane: Standard

## Acceptance Criteria

- [x] `HUB_MODULE_TILES` has one barrel export.
- [x] Previously duplicated Tile, Prompt, and navigation exports are removed.
- [x] The route can compile from the shared feature entry point.

## Failure-Loudly Contract

- Cause surfaced as: Turbopack rejects duplicate exported symbol names at the barrel boundary.
- Detection path: opening `/training` or importing the feature entry point.
- Recovery path: keep every public barrel export declared once.

## Evidence

| Check | Result | Notes |
| --- | --- | --- |
| Export inventory | Passed | Every formerly duplicated public export now occurs once; required `TrainingFooter` and `TrainingNav` layout exports are present. |
| Route verification | Passed | `/training` compiles after the barrel matches `hub-content.ts`. |

## Final Status

- [x] Published and runtime-verified after canonical update.
