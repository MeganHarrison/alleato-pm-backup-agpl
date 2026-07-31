# Task: Structured audit findings for training docs

Status: Complete
Owner: Codex
Created: 2026-07-01
Linear Issue: AAI-852 - https://linear.app/megankharrison/issue/AAI-852/add-structured-audit-findings-to-training-docs-control-plane
Related Handoff: N/A

## Objective

Add the first structured audit layer to the training docs control plane so each
doc can carry machine-readable audit findings for stale docs, product gaps, and
capture blockers without requiring a new database migration in this pass.

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

- Shared training-doc create/update paths accept structured audit findings.
- API responses expose normalized audit fields consistently for tables, editor,
  and training map consumers.
- `/training-docs` shows audit state in the table and editor.
- `/training-map` shows audit state so stale docs and product gaps are visible
  in the inventory surface.
- The implementation does not add a new migration in this pass; it uses the
  existing `metadata` contract intentionally.

## Source Of Truth

- Shared server contract: `frontend/src/lib/training-docs/server.ts`
- Training-doc types: `frontend/src/lib/training-docs/types.ts`
- Admin APIs: `frontend/src/app/api/admin/training-docs/**`
- Admin UI: `frontend/src/app/(admin)/training-docs/**`
- Inventory UI: `frontend/src/app/(admin)/training-map/**`
- Operating model: `docs/architecture/DOCS-OPERATING-MODEL.md`

## Files Changed

- `docs/ops/tasks/2026-07-01-training-docs-audit-layer.md` - task ledger and evidence.
- `frontend/src/lib/training-docs/constants.ts` - audit status constants.
- `frontend/src/lib/training-docs/types.ts` - audit fields on the normalized API record.
- `frontend/src/lib/training-docs/server.ts` - audit metadata normalization and readback helpers.
- `frontend/src/hooks/use-training-docs.ts` - client mutation payloads.
- `frontend/src/features/training-docs/training-docs-table-config.tsx` - audit columns and filters.
- `frontend/src/features/training-docs/training-map-config.tsx` - audit visibility in inventory view.
- `frontend/src/app/(admin)/training-docs/training-docs-client.tsx` - audit filter handling.
- `frontend/src/app/(admin)/training-docs/training-doc-editor.tsx` - audit editor fields.

## Evidence

| Check | Command / artifact | Result | Notes |
| --------------------- | ------------------ | ------ | ----- |
| Static/type/lint | `cd frontend && ./node_modules/.bin/eslint src/lib/training-docs/constants.ts src/lib/training-docs/types.ts src/lib/training-docs/server.ts src/lib/training-docs/__tests__/server.test.ts src/hooks/use-training-docs.ts src/features/training-docs/training-docs-table-config.tsx src/features/training-docs/training-map-config.tsx src/app/'(admin)'/training-docs/training-docs-client.tsx src/app/'(admin)'/training-docs/training-doc-editor.tsx src/app/'(admin)'/training-map/training-map-client.tsx src/app/api/admin/training-docs/route.ts src/app/api/admin/training-docs/'[docId]'/route.ts` | Pass | Re-ran after repairing the null-byte corruption in `training-map-config.tsx`. |
| Targeted tests | `cd frontend && ./node_modules/.bin/jest src/lib/training-docs/__tests__/server.test.ts src/lib/training-docs/__tests__/docs-site.test.ts --runInBand` | Pass | 10 tests passed; includes audit metadata contract coverage. |
| Browser/user-flow | `agent-browser --session-name training-docs-audit ...` and one-off Playwright proof | Pass | Verified authenticated `/training-docs` and `/training-map`; agent-browser confirmed live admin table with Audit column/filter, Playwright verified detail editor labels. |
| DB/provider read-back | N/A | Pass | No migration, provider, or external-service mutation in this slice; metadata-backed contract intentionally reuses existing `published_training_docs` storage path. |
| End-to-end proof | `/Users/meganharrison/Documents/alleato-pm/tmp/training-docs-audit/training-docs-table.png`, `/Users/meganharrison/Documents/alleato-pm/tmp/training-docs-audit/training-doc-editor-audit-fields.png`, `/Users/meganharrison/Documents/alleato-pm/tmp/training-docs-audit/training-map-audit-column.png` | Pass | Proof shows audit visibility in table, detail editor, and training map inventory. |

## Risks / Gaps

- Audit findings are metadata-backed in this pass, not first-class DB columns.
- This pass does not yet generate `audit-report.md` or `parity-gaps.json`.
- `lastAuditedAt` is stamped on update when `audit_status !== "not_audited"` and cleared when reset; there is not yet a separate audit-run history ledger.
- Known unrelated failures: none observed in the targeted lint, test, or browser verification commands for this slice.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
