# Task: Drawings canonical viewer uses Procore-style wheel zoom and pan

Status: In Progress
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-856
Related Handoff: docs/ops/handoffs/2026-07-01-S105-drawings-procore-zoom-pan.md

## Objective

When a user opens a drawing from `/[projectId]/drawings`, the canonical viewer
route must use the OpenSeadragon interaction model so mouse-wheel zoom and pan
work on the actual production path, matching the expected Procore behavior.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Centralized/shared abstraction used when the behavior is cross-cutting.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.
- [x] User-facing copy/UI follows project noise gate and design-system rules, if applicable.

## Integration Checklist

- [x] End-to-end path wired through one owner, not separate disconnected pieces.
- [x] All entry points for the workflow use the same canonical service/runtime.
- [x] Source adapters or external dependencies return typed, inspectable results.
- [ ] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [ ] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [ ] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [ ] Database/provider read-back performed for migrations/config/external services.
- [ ] End-to-end workflow proof captured for the actual requested outcome.
- [ ] Evidence artifacts recorded below.
- [ ] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      |                    |        |       |
| Targeted tests        |                    |        |       |
| Browser/user-flow     |                    |        |       |
| DB/provider read-back | N/A                | N/A    | No DB/provider change expected. |
| End-to-end proof      |                    |        |       |

## Files Changed

- `frontend/src/app/(main)/[projectId]/drawings/viewer/[drawingId]/page.tsx` - promote OSD viewer into canonical route.
- `frontend/src/app/(main)/[projectId]/drawings/viewer-v2/[drawingId]/page.tsx` - redirect deprecated duplicate route into canonical viewer.
- `docs/ops/tasks/2026-07-01-drawings-procore-zoom-pan.md` - working definition of done.
- `docs/ops/handoffs/2026-07-01-S105-drawings-procore-zoom-pan.md` - evidence ledger.

## Risks / Gaps

- Need production browser proof after deploy because the issue is about the
  exact deployed interaction path.
- Existing repo dirt requires `codex:finish --files` with an exact file list.

## Final Status

- [ ] All checklist items are complete.
- [ ] Evidence is recorded.
- [ ] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
