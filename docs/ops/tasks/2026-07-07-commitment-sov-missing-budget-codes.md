# Task: Commitment SOV Missing Budget Codes

Status: Verified
Owner: Codex
Created: 2026-07-07
Linear Issue: Blocked - Linear issue creation tool unavailable in this session; only Linear comment tools are exposed.
Related Handoff: None

## Objective

Validate the 26 report-only `project_budget_codes` candidates from the
JobPlanner-backed commitment SOV resolver, create only candidates that pass
strict candidate-ledger and current-database checks, then rerun the resolver so the 38
`missing_project_budget_code` SOV rows receive real `project_budget_code_id`
values without reintroducing heuristic budget-master creation.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen: `project_budget_codes` remains the canonical project-scoped selector; JobPlanner evidence is only an input proof.
- [x] Deprecated or bypassed paths identified: the rejected resolver `--create-missing-budget-codes` mode remains disabled.
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
- [x] Source adapters or external dependencies return typed, inspectable results. The upstream JobPlanner proof is the already-generated resolver candidate ledger; this slice does not independently re-query JobPlanner at PBC creation time.
- [x] Run/task/session ledger records every meaningful attempt.
- [x] Artifacts link back to source evidence and run logs.
- [x] Delivery/output adapters report sent, skipped, blocked, failed, and dry-run states.

## Regression Guardrails

- [x] Unit or integration test added/updated for the core behavior. N/A for this one-time data operation; coverage is command/readback evidence plus the existing SOV UI regression.
- [x] Contract test added/updated for cross-module or source/delivery boundaries. N/A; no runtime contract changed in this slice.
- [x] Guardrail added so the same class of bug fails loudly next time.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated test run.
- [x] Browser/user-flow verification run for frontend-visible changes. N/A; no frontend-visible code changed in this slice.
- [x] Database/provider read-back performed for migrations/config/external services.
- [x] End-to-end workflow proof captured for the actual requested outcome.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| ----- | ------------------ | ------ | ----- |
| Candidate validation | `candidate-validation-dry-run.json` | Pass | 26 candidates / 38 rows validated against the resolver candidate ledger plus live projects, cost codes, cost types, duplicate PBC checks, SOV row existence, parent project, null FK, legacy budget text, and source-proof metadata from the ledger. |
| Budget-code creation | `candidate-creation-apply.json` | Pass | Created 26 active `project_budget_codes`; script rejected duplicate/inactive/weak-proof candidates before mutation. |
| SOV FK backfill rerun | `post-budget-code-create-dry-run.json`, `sov-backfill-apply.json`, `final-dry-run.json` | Pass | Dry-run found exactly 38 resolvable rows, apply updated 5 PO + 33 subcontract SOV rows, final dry-run has 0 resolvable updates and 0 missing-budget-code candidates. |
| Cleanup/readback | `post-apply-row-readback.json` | Pass | All 38 target SOV rows now link to the created PBCs; 0 wrong links; 26 created PBCs still present. |
| Syntax checks | `node --check scripts/jobplanner/apply-missing-commitment-sov-budget-codes.mjs && node --check scripts/jobplanner/backfill-commitment-sov-fks.mjs` | Pass | Both JobPlanner data scripts parse cleanly. |
| Current final resolver readback | `node scripts/jobplanner/backfill-commitment-sov-fks.mjs --report-missing-budget-codes > /tmp/final-dry-run-current.json` | Pass | Current live dry-run still reports 23 unresolved rows, 0 resolvable updates, 0 missing-budget-code candidates, and 0 budget-code creation. |
| Current row-level DB readback | `node --input-type=module <<'NODE' ...` | Pass | Current live readback confirms 38 checked rows, 38 linked rows, 0 wrong links, and 26 created PBC rows still present. |
| SOV UI regression | `cd frontend && npx jest src/components/commitments/tabs/__tests__/ScheduleOfValuesTab.columns.test.tsx --runInBand` | Pass | 8/8 tests passed, including locked approved commitments and duplicate summary removal. |
| Secret scan | `rg -n "sb-[a-z0-9]+-auth-token|access_token|refresh_token|Authorization|Bearer|Cookie:|DATABASE_PASSWORD|TEST_PASSWORD|JOBPLANNER_PASSWORD|SUPABASE_SERVICE|service_role|eyJ|password|secret" docs/ops/evidence/2026-07-07-commitment-sov-missing-budget-codes --glob '!README.md'` | Pass | No matches in machine evidence artifacts; README/task contain only the documented scan command text. |
| Duplicate candidate guard | `/tmp/duplicate-missing-budget-candidates.json` with one duplicated candidate, then `node scripts/jobplanner/apply-missing-commitment-sov-budget-codes.mjs --candidate-file=/tmp/duplicate-missing-budget-candidates.json --output=/tmp/duplicate-guard.json` | Pass | Script fails before DB validation/mutation with `Duplicate project_budget_code candidate`. |

## Files Changed

- `docs/ops/tasks/2026-07-07-commitment-sov-missing-budget-codes.md` - Task definition and evidence ledger.
- `scripts/jobplanner/apply-missing-commitment-sov-budget-codes.mjs` - Strict candidate validator/creator for the report-only missing PBC ledger.
- `docs/ops/evidence/2026-07-07-commitment-sov-missing-budget-codes/*` - Validation, creation, resolver, and row-readback evidence.

## Risks / Gaps

- Creating canonical `project_budget_codes` must stay stricter than the rejected auto-create path: every candidate needs an existing project, existing cost code, existing cost type, no active or inactive duplicate, no duplicate tuple in the candidate file, current null-FK target rows, and source-proof metadata from the previously generated JobPlanner resolver ledger.
- Remaining unresolved rows outside `missing_project_budget_code` are not in scope for this slice: 14 weak parent matches and 9 missing JobPlanner project matches remain.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
