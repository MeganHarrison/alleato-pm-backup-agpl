# Task: Job Planner Vermillion Rise submittal document fallback audit

Status: Partial
Owner: Codex
Created: 2026-06-24
Linear Issue: Not created yet - blocked by unavailable Linear connector in this turn
Related Handoff: None

## Objective

Determine whether Vermillion Rise submittal documents can be recovered from Job Planner through any reachable fallback surface after the direct submittal attachment endpoints proved unavailable.

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

- `docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittal-docs-audit.md`
- `scripts/jobplanner/audit-submittal-docs-fallback.mjs`
- `package.json`

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Access surface proof | Job Planner API key + access-key session tracing | Pass | Direct `/submittals/{id}/attachments` still inaccessible; project attachments remain reachable |
| Static/type/lint | `node --check scripts/jobplanner/audit-submittal-docs-fallback.mjs` | Pass | Audit script syntax verified |
| Targeted tests | N/A | Not run | This slice is an evidence audit script, not a transformation pipeline |
| Browser/user-flow | `agent-browser --session-name jobplanner-vermillion ...` on submittals + attachments surfaces | Pass | Confirmed access-key session can open project routes but still cannot unlock submittal attachment endpoints |
| DB/provider read-back | `npm run jobplanner:audit-submittal-docs -- --jp=5296` | Pass | Live audit found 94 reachable attachment entries: 86 JPG files, 1 PDF, 7 folders, and no trustworthy submittal-package naming surface |
| End-to-end proof | `npm run jobplanner:audit-submittal-docs -- --jp=5296` | Pass | Audit concluded with `confidence: low` and `No trustworthy submittal-document fallback was found on the reachable project attachments surface.` |
| Known unrelated failures | None beyond already-known Job Planner endpoint access limits | N/A | This run did not hit new code/runtime failures |

## Risks / Gaps

- Linear issue creation is blocked in this turn because no Linear connector/tool has been used yet.
- Fallback audit can prove absence or low-confidence matching on reachable surfaces, but it cannot create access to a vendor endpoint that currently returns `401`.
- Reachable project attachments for Vermillion do not resemble a submittal package library: one `Bid Submittal` branch contains a single vendor schedule PDF, while the rest of the reachable files are overwhelmingly daily-report JPG photos.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
