# Task: Finalize Env And Orphan Database Cleanup Proof

Status: Complete
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-737 - https://linear.app/megankharrison/issue/AAI-737/finalize-unused-env-and-orphan-database-cleanup-proof
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Close the Phase 12 cleanup gate for unused environment variables and orphaned
database code in the AI data pipeline/RAG finalization program. Remove only
items proven inactive through source, provider, route/service, and database
evidence.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior cleanup evidence reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for each env/table/control-plane candidate.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Build secret-safe inventory of AI/RAG/pipeline env keys referenced in source.
- [x] Compare source-referenced keys against provider/key presence without printing values.
- [x] Classify env candidates as `active-keep`, `provider-retain`, `delete`, `deleted-by-prior-slice`, or `blocked`.
- [x] Inventory potential orphan database code/tables from generated DB inventory, docs, source references, migrations, and verifiers.
- [x] Classify DB candidates as active, legacy-retain, delete, or blocked.
- [x] Delete only candidates with active-path proof.
- [x] Record retained paths and why they remain.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Architecture/finalization docs updated.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] No production env key required by Render/Vercel/source code is removed.
- [x] No active table or migration-backed workflow is removed.
- [x] Cleanup inventories point to final production owners.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scans prove removed symbols are not referenced by current runtime code.
- [x] Relevant verifier or provider read-back proves retained production paths still work.
- [x] Changed-file typecheck is delegated to a subagent if code/types change.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted backend/frontend checks run as applicable.
- [x] Relevant provider/RAG verifier run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Env/provider subagent proof | explorer `019f08eb-63e1-7790-adc8-f7519396e222` | PASS | Secret-safe env cleanup scan identified stale Vercel/Render key names and active retained provider keys. |
| DB orphan subagent proof | explorer `019f08eb-8cc6-7741-b9a1-a93c1bc529cc` | PASS | Read-only generated inventory/source/migration scan identified eight safe drop candidates and retained/blocked tables. |
| Provider env deletion | Vercel CLI and Render API key-name-only operations | PASS | Removed stale/deprecated provider key names without printing values. |
| Provider env guardrail | `npm run verify:deprecated-provider-env` | PASS | No deprecated Vercel/Render env key names found. |
| DB migration dry run | `BEGIN; \\i supabase/migrations/20260627120000_drop_dead_ai_document_tables.sql; ROLLBACK;` | PASS | Dropped eight candidates in transaction; `document_insights` excluded after dependency failure on `actionable_insights`. |
| DB migration application | `supabase/migrations/20260627120000_drop_dead_ai_document_tables.sql` | PASS | Applied to MAIN database and inserted migration ledger version `20260627120000`. |
| Migration ledger | `npm run db:migrations:verify-applied -- supabase/migrations/20260627120000_drop_dead_ai_document_tables.sql` | PASS | Remote ledger check passed. |
| DB inventory regenerate | `npm run db:inventory` | PASS | Regenerated inventory with 452 tables after table drops. |
| DB inventory check | `npm run db:inventory -- --check-only` | PASS | Schema drift check passed. |
| Supabase types | `npm run db:types` | PASS | Regenerated `frontend/src/types/database.types.ts` via postgres-meta fallback. |
| Static env scan | `rg` over runtime/docs for deleted env names | PASS | No matches outside the guardrail inventory. |
| Static table scan | `rg` over generated types/inventory/tables YAML for dropped table names | PASS | Dropped table names absent except the drop migration. |
| Changed-file typecheck | subagents `019f08f9-5d5d-7dd3-8148-1d70d09d9a8d`, `019f08fa-5504-7960-9e88-43a5d0df1aac` | PASS | `cd frontend && npm run typecheck:changed` passed twice after JS/package changes. |
| Cleanup inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-final-aai-737.md | PASS | Env/DB classifications, retained paths, and verification table recorded. |

## Files To Change

- `docs/ops/tasks/2026-06-27-finalize-env-db-cleanup-proof.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-final-aai-737.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/env-db-cleanup-candidate-inventory-aai-705.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- Additional files only if deletion proof identifies a safe removal.

## Risks / Gaps

- The checkout contains unrelated dirty frontend/backend files; this slice must
  stage and publish only AAI-737-owned files.
- Env scans must not print secret values.
- Provider env read-back should report key presence/status only.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
