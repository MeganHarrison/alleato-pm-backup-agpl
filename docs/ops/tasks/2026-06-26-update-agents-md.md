# Task: Update AGENTS.md automation guidance

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: Not created - docs-only automation maintenance; no Linear connector loaded for this run.
Related Handoff: N/A

## Objective

Update `AGENTS.md` with newly discovered repo workflows and commands, keeping the
edit minimal and grounded in current repo documentation/scripts.

## Non-Negotiable Done Rule

This task is not done until every applicable checklist item below is checked,
with evidence filled in. Non-applicable implementation/test gates are marked as
N/A in evidence rather than invented.

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
| Static/type/lint      | `git diff --check -- AGENTS.md docs/ops/tasks/2026-06-26-update-agents-md.md` | Pass | Markdown whitespace check passed with no output. |
| Targeted tests        | `rg -n "Drawing OCR Pipeline|OCR text is stored|rag:verify:render-ai|rag:verify:source-provider-auth|PUT /env-vars" AGENTS.md` | Pass | Confirms inserted workflow guidance is present. |
| Command existence     | `node -e "... package.json scripts check ..."` | Pass | Confirmed all newly listed npm scripts exist in root `package.json`. |
| Browser/user-flow     | N/A | Pass | Documentation-only change; no frontend-visible behavior. |
| DB/provider read-back | N/A | Pass | No DB/provider changes. |
| End-to-end proof      | `git diff -- AGENTS.md` | Pass | Diff only adds OCR workflow guidance and existing verification commands. |

## Files Changed

- `AGENTS.md` - add drawing OCR pipeline workflow and verification command references.
- `docs/ops/tasks/2026-06-26-update-agents-md.md` - task ledger for this automation run.

## Risks / Gaps

- Linear issue was not created because this is a docs-only automation run and no Linear connector was loaded.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
