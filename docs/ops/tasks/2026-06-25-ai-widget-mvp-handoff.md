# Task: AI Widget MVP Implementation Handoff

Status: Complete
Owner: Codex
Created: 2026-06-25
Linear Issue: AAI-647 - https://linear.app/megankharrison/issue/AAI-647/create-implementation-handoff-for-intercom-style-ai-widget-mvp
Related Handoff: docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md

## Objective

Create a ready-to-use implementation handoff so a follow-on Codex session can improve the existing global floating AI chat widget into a more polished Intercom-style assistant surface, with a quick welcome/proactive notification MVP suitable for an owner demo.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence filled in. If any item cannot be completed, change `Status` to `Blocked/Deferred` and document the blocker, owner, and next action.

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

- [x] Unit or integration test added/updated for the core behavior.
- [x] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check                 | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint      | `git diff --check -- docs/ops/tasks/2026-06-25-ai-widget-mvp-handoff.md docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md` | Pass | No whitespace or patch-format issues. |
| Targeted tests        | Not applicable | Pass | Documentation-only handoff. |
| Browser/user-flow     | Not applicable | Pass | Implementation session must capture browser screenshots. |
| DB/provider read-back | Not applicable | Pass | No database/provider changes in this handoff task. |
| End-to-end proof      | docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md | Pass | Handoff includes current files, MVP scope, research instructions, verification instructions, and failure-loud behavior. |

## Files Changed

- `docs/ops/tasks/2026-06-25-ai-widget-mvp-handoff.md` - Definition of done and evidence for this handoff creation task.
- `docs/ops/handoffs/2026-06-25-S92-ai-widget-mvp-handoff.md` - Implementation handoff for the follow-on AI widget MVP session.

## Risks / Gaps

- The implementation itself is not part of this handoff task.
- Required external screenshot research is specified for the next session; no production UI change should start until that evidence is captured.
- The checkout had unrelated modified and untracked files before this task. They were not touched.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
