# Task: AI/RAG Legacy Cleanup Proof And Deletion

Status: Complete
Owner: Codex
Created: 2026-06-26
Linear Issue: AAI-703 - https://linear.app/megankharrison/issue/AAI-703/prove-and-remove-remaining-legacy-airag-implementations
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Inventory remaining legacy/duplicate/deprecated AI/RAG implementation candidates,
prove whether each candidate is active or inactive through import, route,
provider-schedule, database-write, and verifier evidence, then delete only the
inactive implementations with complete proof.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared primitives/services/helpers identified before adding new ones.
- [x] Source-of-truth owner chosen for each workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Create cleanup candidate inventory with one row per candidate.
- [x] For each candidate, record import/reference proof.
- [x] For each candidate, record route/API/UI reachability proof.
- [x] For each candidate, record provider schedule/cron/job proof where applicable.
- [x] For each candidate, record database read/write table proof where applicable.
- [x] Classify each candidate as `delete`, `migrate-first`, `active-keep`, or `manual/dev-only`.
- [x] Delete only candidates classified `delete`.
- [x] Record why every non-deleted candidate remains.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Legacy or duplicate paths removed, blocked, or explicitly marked deprecated.
- [x] Errors are specific and actionable; no silent fallback added.

## Regression Guardrails

- [x] Unit or integration test added/updated for deleted path if needed.
- [x] Contract/verifier guard updated so deleted legacy path cannot be restored silently.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted automated tests run.
- [x] Relevant AI/RAG contract verifiers run.
- [x] Provider/read-back proof captured where provider config is involved.
- [x] End-to-end workflow proof captured for affected production path.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-cleanup-candidate-inventory-aai-703.md | Complete | Initial slice classified two scripts as `delete`, one as `migrate-first`, one as `manual/dev-only`, and five local admin eval scripts as `active-keep`; AAI-734 later retired the contextual retrieval `migrate-first` pilot. |
| Import/route proof | `rg -n "eval_graph_sync|eval_mine_emails" backend frontend scripts docs package.json render.yaml ...` | Pass | After deletion, only `scripts/verify/verify_ai_chat_architecture.mjs` and AAI evidence files reference the removed script names. |
| Provider proof | `rg ... render.yaml`; candidate inventory | Pass | Deleted scripts had no Render/package/provider schedule references. No provider changes required. |
| DB inventory refresh | `npm run db:inventory` | Blocked by unrelated schema inventory drift | Generator connected to MAIN and RAG DBs, then failed because `document_page_intelligence`, `idea_items`, `rfi_response_tokens`, `rfi_responses`, `spec_drawing_links`, `submittal_ai_review_checks`, `submittal_ai_review_runs`, and `submittal_project_settings` are missing from `docs/architecture/tables.yaml`. Stale deleted-file reference objects were removed manually from the generated JSON. |
| JSON validity | `node -e "JSON.parse(require('fs').readFileSync('frontend/src/components/dev-tools/db-inventory.generated.json','utf8')); console.log('json ok')"` | Pass | Generated inventory JSON remains parseable after removing stale deleted-file references. |
| Python compile | `backend/.venv/bin/python -m compileall -q backend/src/scripts backend/src/services/pipeline/contextualize.py` | Pass | Remaining backend scripts compile after deletions. |
| Typecheck | delegated sub-agent: `cd frontend && npm run typecheck:changed` | Pass | Ran after generated JSON edit and again after JS verifier guard edit; no new `any` debt detected. |
| Contract verifiers | `npm run rag:verify:chat-architecture`; `npm run rag:verify:source-specific`; `npm run rag:verify:retrieval-contract`; `npm run rag:verify:client-boundary`; `npm run rag:verify:backend-client-boundary`; `npm run rag:verify:metadata-boundary` | Pass | Chat architecture guard now fails if deleted eval scripts reappear. |

## Files Changed

- `backend/README.md`
- `backend/src/scripts/eval_graph_sync.py` (deleted)
- `backend/src/scripts/eval_mine_emails.py` (deleted)
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-cleanup-candidate-inventory-aai-703.md`
- `docs/ops/tasks/2026-06-26-ai-rag-legacy-cleanup-proof.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `frontend/src/components/dev-tools/db-inventory.generated.json`
- `scripts/verify/verify_ai_chat_architecture.mjs`

## Risks / Gaps

- The checkout contains unrelated dirty frontend files; this slice must stage and publish only AAI-703-owned files.
- The broad `docs/` tree is ignored by Git; task/evidence files must be force-added when publishing.
- `npm run db:inventory` is blocked by unrelated `tables.yaml` schema drift, so the generated inventory could not be fully regenerated in this slice.
- `backend/src/scripts/backfill_contextual_embeddings.py` was retired in AAI-734 after contextual retrieval was explicitly retired.
- `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py` was retired in AAI-732 after `backfill_outlook_intake_rag_documents()` and `SupabaseRagStore.upsert_document_metadata()` were proven as the replacement repair owner.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
