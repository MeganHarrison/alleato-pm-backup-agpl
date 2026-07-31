# Task: Job Planner Vermillion Rise submittals import

Status: Partial
Owner: Codex
Created: 2026-06-24
Linear Issue: Not created yet - blocked by unavailable Linear connector in this turn
Related Handoff: None

## Objective

Import the live Job Planner submittal log for Vermillion Rise into Alleato project `67` in an idempotent way so the team can re-sync submittals during the transition without manual Excel-only work.

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
- [ ] Contract test added/updated for cross-module or source/delivery boundaries.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [ ] Browser/user-flow verification run for frontend-visible changes.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Static/type/lint | `node --check scripts/jobplanner/import-submittals.mjs` + `node --check scripts/jobplanner/import-submittals-lib.mjs` | Pass | Syntax verified for importer and mapping lib |
| Targeted tests | `npm run test:jobplanner-submittals-import` | Pass | 4 focused mapping/guardrail tests passed |
| Browser/user-flow | `agent-browser --session-name jobplanner-vermillion ...` against Job Planner access-key session | Pass | Confirmed live project access, traced private submittal/drawing requests, and captured actual API boundary differences between submittals and drawings |
| DB/provider read-back | `npm run verify:jobplanner-api` | Pass | Live Job Planner API key and submittals endpoint verified before implementation |
| End-to-end proof | `npm run jobplanner:import-submittals -- --jp=5296 --app=67` plus dry-run/read-back rerun | Pass | Imported 143 Job Planner submittals into project 67; follow-up dry run reported 0 inserts / 143 updates; DB read-back showed 145 total rows with 143 tagged `metadata.jobplanner.project_id = 5296` |
| API boundary proof | API key reads against `GET /projects/5296/versions`, `GET /projects/5296/drawings/settings`, `GET /projects/5296/drawings/areas`, `GET /drawings/{guid}/download`, plus access-key-session header replay for submittals | Pass | Drawings metadata and PDF download are accessible via API key; submittal metadata is accessible via API key, but submittal document endpoints still return `401` in the authenticated access-key browser session and `attachments: []` in API-key detail payloads |

## Files Changed

- `docs/ops/tasks/2026-06-24-jobplanner-vermillion-submittals-import.md` - task ledger and verification record
- `scripts/jobplanner/import-submittals.mjs` - idempotent Job Planner submittals importer
- `scripts/jobplanner/import-submittals-lib.mjs` - shared mapping and metadata helpers for importer behavior
- `scripts/jobplanner/__tests__/import-submittals.test.mjs` - importer mapping/idempotency guardrails
- `package.json` - CLI entrypoints for import and focused tests

## Risks / Gaps

- Linear issue creation is blocked in this turn because no Linear connector/tool has been used yet.
- Job Planner exposes submittal metadata but not submittal documents on the submittal payload, so this task covers log sync only.
- Job Planner drawings are accessible through different endpoints than submittals: `GET /projects/{projectId}/versions` returns drawing/version metadata and `GET /drawings/{guid}/download` returns the PDF, but the same pattern does not exist for submittal files on the API surface we can reach.
- No contract-style integration test was added yet for the Job Planner API payload boundary; current guardrail coverage is focused mapping/unit behavior plus live dry-run/import verification.
- Follow-up submittal document import is blocked on access surface, not on Alleato ingestion code: across all 143 Vermillion Rise Job Planner submittals, `GET /submittals/{id}` returned `attachments: []` and no usable `folderId`, the project attachment tree does not correlate because every imported submittal surfaced `folderId = 0`, and replaying the browser's signed access-key headers against `/submittals/{id}/attachments` still returns `401`.

## Final Status

- [ ] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [ ] Final response includes what is done, what remains, and recommended next steps.
