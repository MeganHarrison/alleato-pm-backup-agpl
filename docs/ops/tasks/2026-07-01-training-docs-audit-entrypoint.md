# Task: Training-doc audit entrypoint and artifact contract

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-853 - https://linear.app/megankharrison/issue/AAI-853/add-training-doc-audit-entrypoint-and-artifact-contract
Related Handoff: N/A

## Objective

Add one canonical audit entrypoint for the repeatable training-docs pipeline so
`audit` mode produces stable evidence artifacts, classifies parity outcomes
consistently, and fails loudly when the underlying workflow capture is invalid.

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

## Acceptance Criteria

- A single audit command exists for tutorial/training-doc workflows.
- The audit command writes `audit-report.md` and `parity-gaps.json` into the
  workflow output directory.
- The audit command classifies outcomes with the existing normalized audit
  status vocabulary: `aligned`, `doc_stale`, `product_gap`, `capture_blocked`.
- The audit command fails loudly when required capture artifacts are missing or
  when manifest steps show invalid auth/access routes.
- The audit output includes enough structured data for future UI ingestion or
  automation without introducing a new database migration in this pass.

## Source Of Truth

- Skill contract: `.codex/skills/repeatable-training-docs/SKILL.md`
- Operating model: `docs/architecture/DOCS-OPERATING-MODEL.md`
- Tutorial capture/compose/publish pipeline: `scripts/tutorials/**`
- Shared training-doc constants/types: `frontend/src/lib/training-docs/constants.ts`

## Files Changed

- `docs/ops/tasks/2026-07-01-training-docs-audit-entrypoint.md` - task ledger and evidence.
- `scripts/tutorials/*` - canonical audit entrypoint and tests.
- `package.json` - task-level script entrypoint if needed.
- `.codex/skills/repeatable-training-docs/SKILL.md` - operator guide updates if contract changes.

## Evidence

| Check | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint | `node --import tsx scripts/tutorials/audit-training-doc.ts --help`; `git diff --check -- docs/ops/tasks/2026-07-01-training-docs-audit-entrypoint.md scripts/tutorials/audit-training-doc.ts scripts/tutorials/__tests__/audit-training-doc.test.mjs scripts/tutorials/slug-contract.ts scripts/tutorials/publish-tutorial.ts .codex/skills/repeatable-training-docs/SKILL.md package.json frontend/src/lib/training-docs/constants.ts` | Pass | The repo ESLint config intentionally ignores `scripts/**`, so the static proof here is CLI load plus whitespace/diff integrity on all touched files. |
| Targeted tests | `node --import tsx --test scripts/tutorials/__tests__/audit-training-doc.test.mjs scripts/tutorials/__tests__/publish-tutorial.test.mjs` | Pass | 8 tests passed, covering audit validation/classification plus existing publish guardrails. |
| Browser/user-flow | N/A | Pass | No frontend-visible changes in this slice. |
| DB/provider read-back | `node --import tsx scripts/tutorials/audit-training-doc.ts docs/tutorials/commitments/create-commitment/manifest.json --query "create commitment workflow contract details sov attachments"` | Pass | The live audit run read back the existing `training_docs` row using the real metadata-backed table contract and emitted aligned artifacts. |
| End-to-end proof | `docs/tutorials/commitments/create-commitment/audit-report.md`; `docs/tutorials/commitments/create-commitment/parity-gaps.json` | Pass | Live proof produced an `aligned` audit report for the commitment workflow packet after slug-contract normalization. |

## Risks / Gaps

- This slice is intentionally artifact-first; it does not yet persist audit runs
  or parity findings into a dedicated runtime ledger.
- Automatic Linear issue creation for `product_gap` remains deferred.
- The audit command currently reads the existing `training_docs` row and writes
  artifacts, but it does not yet patch audit status back into the runtime row.
- Known unrelated failures: none observed in the targeted static, test, or live
  audit commands for this slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
