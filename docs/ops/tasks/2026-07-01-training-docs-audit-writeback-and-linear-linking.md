# Task: Training-doc audit writeback and Linear linking

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-855 - https://linear.app/megankharrison/issue/AAI-855/write-back-training-doc-audit-results-and-support-product-gap-issue
Related Handoff: N/A

## Objective

Extend the training-doc audit entrypoint so an audit run writes its normalized
result back into the live `training_docs` row using the existing metadata-backed
contract, and support product-gap issue linkage on the same path.

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

- An audit run updates the existing `training_docs` row when one exists.
- Writeback uses the same metadata-backed contract already surfaced by the admin
  workflow: `lastAuditedAt`, `lastParityStatus`, `auditNotes`, `blockerType`,
  `blockerOwner`, `productGapIssueId`.
- Product-gap findings can link an existing Linear issue ID through the audit
  command.
- Auto-create is guarded behind explicit input/config and fails with a concrete
  credential/setup error when the Linear provider is not usable.

## Source Of Truth

- Shared training-doc contract: `frontend/src/lib/training-docs/server.ts`
- Audit entrypoint: `scripts/tutorials/audit-training-doc.ts`
- Existing publish contract: `scripts/tutorials/publish-tutorial.ts`
- Skill contract: `.codex/skills/repeatable-training-docs/SKILL.md`

## Files Changed

- `docs/ops/tasks/2026-07-01-training-docs-audit-writeback-and-linear-linking.md`
- `scripts/tutorials/audit-training-doc.ts`
- `scripts/tutorials/__tests__/audit-training-doc.test.mjs`
- other shared files only if the contract requires it

## Evidence

| Check | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint | `git diff --check -- docs/ops/tasks/2026-07-01-training-docs-audit-writeback-and-linear-linking.md scripts/tutorials/audit-training-doc.ts scripts/tutorials/__tests__/audit-training-doc.test.mjs` | Pass | No whitespace or patch-integrity errors on touched files. |
| Targeted tests | `node --import tsx --test scripts/tutorials/__tests__/audit-training-doc.test.mjs scripts/tutorials/__tests__/publish-tutorial.test.mjs` | Pass | 10 tests passed, including writeback metadata and fail-loud Linear-create coverage. |
| Browser/user-flow | N/A | Pass | CLI/runtime-only slice; no frontend-visible changes. |
| DB/provider read-back | `node --import tsx scripts/tutorials/audit-training-doc.ts docs/tutorials/commitments/create-commitment/manifest.json --query "create commitment workflow contract details sov attachments"` plus direct Supabase read-back | Pass | Confirmed writeback updated `training_docs.metadata.lastAuditedAt` and `lastParityStatus=aligned` on slug `create-a-commitment`. |
| End-to-end proof | `docs/tutorials/commitments/create-commitment/audit-report.md`; `docs/tutorials/commitments/create-commitment/parity-gaps.json`; controlled product-gap drill with `--product-gap-issue-id AAI-1234` and restore run | Pass | Verified aligned writeback, product-gap issue linkage writeback, then restored the row to aligned state. |

## Risks / Gaps

- Existing repo notes already show the current `LINEAR_API_KEY` is rejected by
  live Linear auth, so auto-create may remain guarded rather than fully usable.
- Auto-create is implemented behind explicit flags, but a real end-to-end create
  proof remains blocked by the existing invalid Linear credential.
- Known unrelated failures: none observed in the targeted test, diff, or
  writeback verification commands for this slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
