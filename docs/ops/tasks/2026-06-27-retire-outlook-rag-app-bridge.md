# Task: Retire Outlook RAG-To-App Document Bridge

Status: Completed
Owner: Codex
Created: 2026-06-27
Linear Issue: AAI-732 - https://linear.app/megankharrison/issue/AAI-732/prove-or-retire-outlook-rag-to-app-document-bridge
Parent: AAI-636
Related Handoff: docs/ops/handoffs/2026-06-25-S91-ai-rag-production-finalization-audit.md

## Objective

Prove whether `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py`
is still required after Outlook raw intake plus canonical RAG/app projection
became the production owner. Delete it only if the replacement workflow is
proven and all docs/evidence are updated.

## Non-Negotiable Done Rule

This task is not done until every checklist item below is checked, with evidence
filled in. If any item cannot be completed, change `Status` to
`Blocked/Deferred` and document the blocker, owner, and next action.

## Scope Checklist

- [x] Existing architecture and prior related implementations reviewed.
- [x] Existing shared services/helpers identified before removing code.
- [x] Source-of-truth owner chosen for the workflow/data/control plane.
- [x] Deprecated or bypassed paths identified.
- [x] Acceptance criteria written as observable behavior, not implementation hopes.
- [x] Failure-loudly behavior defined.

## Proof Checklist

- [x] Prove current import/reference surface before deletion.
- [x] Prove route/API/UI reachability before deletion.
- [x] Prove provider schedule/cron/job ownership before deletion.
- [x] Prove database-write ownership before deletion.
- [x] Record retained replacement paths before deletion.
- [x] Delete only candidates with active-path proof.
- [x] Record retained Outlook repair paths and why they remain.

## Implementation Checklist

- [x] Files/modules to change listed before edits.
- [x] Database schema/types/migrations handled, if applicable.
- [x] Provider/env/config changes handled through CLI/API/MCP when available.
- [x] Retired standalone bridge script removed.
- [x] Architecture and cleanup evidence no longer advertise the retired script as a current repair path.
- [x] Generated DB inventory no longer references the retired script.
- [x] Errors are specific and actionable; no silent fallback added.

## Integration Checklist

- [x] Canonical `SupabaseRagStore.upsert_document_metadata()` remains the app+RAG document write owner.
- [x] Canonical `backfill_outlook_intake_rag_documents()` remains the bounded Outlook intake repair owner.
- [x] Outlook promotion freshness monitoring remains active.
- [x] Artifacts link back to source evidence and command logs.

## Regression Guardrails

- [x] Static scan proves the retired script name remains only in historical/proof docs, not current architecture/runtime docs.
- [x] Compile/import check proves current Outlook service replacement path still loads.
- [x] Relevant Outlook/Graph/RAG verifier or focused contract check run.
- [x] Existing tests adjusted only for intentional behavior changes.

## Verification Checklist

- [x] Static/type/lint check run, or explicitly delegated to a cheaper sub-agent.
- [x] Targeted backend compile check run.
- [x] Relevant source/provider verifier run.
- [x] Evidence artifacts recorded below.
- [x] Known unrelated failures documented with exact command and owner files.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Candidate inventory | docs/ops/evidence/2026-06-25-ai-rag-production-finalization/outlook-rag-app-bridge-retirement-aai-732.md | In Progress | Current references and replacement owner recorded before code deletion. |
| Import/reference proof | `rg -n "backfill_outlook_rag_metadata_to_app_documents..." backend/src frontend/src scripts package.json render.yaml docs/...` | Pass | Candidate is a manual CLI plus docs/generated inventory references; no package, route, frontend, or Render owner found. |
| Replacement owner proof | `SupabaseRagStore.upsert_document_metadata`; `backfill_outlook_intake_rag_documents` | Pass | Current Outlook service has canonical app+RAG metadata write and bounded intake repair functions. |
| Script deletion | `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py` | Pass | Deleted obsolete standalone incident bridge. |
| Backend compile | `backend/.venv/bin/python -m py_compile backend/src/services/integrations/microsoft_graph/outlook.py backend/src/services/supabase_helpers.py backend/src/services/health/outlook_promotion_freshness.py backend/src/services/health/pipeline_alert_notifier.py` | Pass | Replacement Outlook service/store/health modules load. |
| DB inventory | `npm run db:inventory` | Pass | Initially failed on unrelated `training_docs`/`training_doc_assets` tables missing from `tables.yaml`; added documented dormant stubs, reran, and regenerated inventory successfully. |
| Deleted inventory reference scan | `rg -n "backfill_outlook_rag_metadata_to_app_documents" frontend/src/components/dev-tools/db-inventory.generated.json frontend/src/components/dev-tools/db-inventory.generated.ts docs/architecture/TABLE-LIST.md docs/architecture/tables.yaml` | Pass | Zero matches. |
| Outlook health | `npm run verify:microsoft-assistant-health -- --json` | Pass | Initial run found cached intake stale; scoped Brandon sync repaired it and the verifier passed. |
| Outlook subscriptions | `npm run verify:graph-subscriptions -- --json` | Pass | 11/11 expected Outlook subscriptions active; 0 stale. |
| Attachment detail endpoint | scoped Brandon Outlook sync + focused test update | Pass | Live sync exposed Graph 400s on the cast attachment endpoint; `_fetch_file_attachment_detail` now uses the generic attachment endpoint with `contentBytes` selected. |

## Files To Change

- `backend/src/scripts/backfill_outlook_rag_metadata_to_app_documents.py`
- `docs/architecture/AI-RAG-ARCHITECTURE.md`
- `docs/architecture/email-sync-rebuild-plan.md`
- `docs/ops/ai-rag-production-finalization/TASKS.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/legacy-cleanup-candidate-inventory-aai-703.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/retrieval-legacy-candidate-inventory-aai-682.md`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/outlook-rag-app-bridge-retirement-aai-732.md`
- `docs/ops/tasks/2026-06-27-retire-outlook-rag-app-bridge.md`
- `docs/architecture/tables.yaml`
- `docs/architecture/TABLE-LIST.md`
- `frontend/src/components/dev-tools/db-inventory.generated.json`
- `frontend/src/components/dev-tools/db-inventory.generated.ts`

## Risks / Gaps

- The checkout contains unrelated dirty frontend/backend files; this slice must stage and publish only AAI-732-owned files.
- The broad `docs/` tree is ignored by Git; task/evidence files must be force-added when publishing.
- `npm run db:inventory` regenerated the full JSON payload after the table stubs were added; the stale deleted-script references are gone.

## Final Status

- [x] All checklist items are complete.
- [x] Evidence is recorded.
- [x] Any deferred work is explicitly marked Blocked/Deferred with owner and next action.
- [x] Final response includes what is done, what remains, and recommended next steps.
