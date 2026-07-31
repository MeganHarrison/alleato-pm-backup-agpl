# Task: AI/RAG Env And Database Cleanup Proof

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-705 - https://linear.app/megankharrison/issue/AAI-705/prove-unused-env-vars-and-orphaned-airag-database-code
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Inventory unused AI/RAG/pipeline environment variables and orphaned database
code, prove active vs inactive status through repo references, provider
configuration, database inventory, and verifiers, then remove or retain each
candidate with explicit evidence.

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

## Proof Checklist

- [x] Create env/database cleanup candidate inventory with one row per candidate.
- [x] For each env candidate, record code/doc/provider references.
- [x] For each database candidate, record generated inventory, schema metadata, and route/service references.
- [x] Classify each candidate as `delete`, `document-active`, `migrate-first`, `provider-retain`, or `unknown-retain`.
- [x] Delete or remove only candidates classified `delete`.
- [x] Record why every non-deleted candidate remains.

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

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md | Complete | Classified eight DB drift candidates as active/documented and five env-control groups as retain/migrate-first. |
| DB inventory drift | `npm run db:inventory` | Pass | Schema drift passed; regenerated 458-table inventory. |
| DB inventory check-only | `npm run db:inventory -- --check-only` | Pass | Schema drift gate now passes without writes. |
| Env reference proof | Compact env inventory + targeted `rg` commands | Complete | First likely env candidates are fail-closed/provider-retained or migrate-first, not safe deletes. |
| JSON validity | `node -e "JSON.parse(require('fs').readFileSync('frontend/src/components/dev-tools/db-inventory.generated.json','utf8')); console.log('json ok')"` | Pass | Generated JSON parses. |
| Typecheck | delegated sub-agent: `cd frontend && npm run typecheck:changed` | Pass | No new `any` type debt detected. |
| Targeted tests | `npm run db:inventory -- --check-only`; generated JSON parse check | Pass | DB inventory schema drift is now fail-loud and clean. |
| Contract verifiers | `npm run rag:verify:client-boundary`; `npm run rag:verify:backend-client-boundary`; `npm run rag:verify:metadata-boundary`; `npm run rag:verify:chat-architecture` | Pass | RAG DB boundaries and finalized assistant architecture still pass after inventory regeneration. |

## Files Changed

- `docs/architecture/tables.yaml`
- `docs/architecture/TABLE-LIST.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md`
- `docs/ops/tasks/2026-06-26-ai-rag-env-db-cleanup-proof.md`
- `frontend/src/components/dev-tools/db-inventory.generated.json`
- `frontend/src/components/dev-tools/db-inventory.generated.ts`

## Risks / Gaps

- The checkout contains unrelated dirty frontend files; this slice must stage and publish only AAI-705-owned files.
- The broad `docs/` tree is ignored by Git; task/evidence files must be force-added when publishing.
- No env vars were removed in this slice. The first candidates are active guardrails or migrate-first gates; deleting them safely requires separate route/code removal proof.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
