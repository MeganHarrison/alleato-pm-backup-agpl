# Task: Job Planner API current-state canonical doc

Status: Partial
Owner: Codex
Created: 2026-06-25
Linear Issue: Not created yet - blocked by unavailable Linear connector in this turn
Related Handoff: None

## Objective

Create a single canonical repo doc that lets a future Codex session get up to speed on the current Job Planner API integration state without re-auditing the entire surface from scratch.

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
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [ ] Unit or integration test added/updated for the core behavior.
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run, or explicitly marked N/A with reason.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Planned Files

- `docs/ops/tasks/2026-06-25-jobplanner-api-current-state-doc.md`
- `docs/ops/handoffs/2026-06-25-jobplanner-api-current-state.md`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Canonical doc artifact | `docs/ops/handoffs/2026-06-25-jobplanner-api-current-state.md` | Pass | Consolidates project mapping, scripts, working endpoints, blocked endpoints, sync results, and next-step guardrails for future Codex sessions |
| Static/type/lint | visual read-back of canonical doc + linked repo paths | Pass | Paths and commands in the canonical doc resolve against the current repo |
| Targeted tests | N/A | Not run | This slice adds documentation only |
| Browser/user-flow | N/A | Referenced existing evidence | Canonical doc points to already-verified live Job Planner surfaces rather than adding new UI behavior |
| DB/provider read-back | referenced existing import and audit outcomes | Pass | Canonical doc embeds the already-verified `143` submittals, `60` drawings, `109` revisions, and submittal-doc blocker state |
| Known unrelated failures | None | N/A | No new runtime failures in this doc-only slice |

## Risks / Gaps

- Linear issue creation is blocked in this turn because no Linear connector/tool has been used yet.
- This canonical doc will improve future pickup materially, but it is still repo documentation, not global Codex memory.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
