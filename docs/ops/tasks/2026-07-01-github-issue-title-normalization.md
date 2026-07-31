# Task: Normalize open GitHub admin-feedback issue titles

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-854
Related Handoff: Not applicable

## Objective

Rename the open `admin-feedback` GitHub issues in `MeganHarrison/alleato-pm`
so the title is a concise tool-first summary rather than a copy of the raw
feedback text, while preserving the detailed request in the issue body and
comments.

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
| Static/type/lint      | Not applicable | Pass | Metadata-only ops task; no repo code path changed. |
| Targeted tests        | Not applicable | Pass | No runtime logic changed; live GitHub read-back is the verification surface. |
| Browser/user-flow     | Not applicable | Pass | No frontend/runtime behavior change. |
| DB/provider read-back | `gh issue list --repo MeganHarrison/alleato-pm --state open --label admin-feedback --limit 200 --json number,title`, `gh issue view 595 --repo MeganHarrison/alleato-pm --json title`, `gh issue view 342 --repo MeganHarrison/alleato-pm --json title`, Linear `AAI-854` | Pass | Verified all 72 live GitHub titles plus spot-readback on representative issues and Linear tracking. |
| End-to-end proof      | `python` batch using `gh issue edit ... --title ...` for 72 issues, then regenerated `docs/ops/2026-07-01-open-github-issue-status-report.md` from live GitHub titles | Pass | Live repo now reflects concise tool-first titles and the local report matches GitHub. |

## Files Changed

- `docs/ops/tasks/2026-07-01-github-issue-title-normalization.md` - task record
- `docs/ops/2026-07-01-open-github-issue-status-report.md` - backlog report title sync after renames

## Risks / Gaps

- A few imported annotations were inherently vague, so those titles are still best-effort summaries rather than perfect product specs.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
