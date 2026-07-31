# Delete Disabled Vercel Cron Leftovers

Date: 2026-06-25
Linear: AAI-660
Parent: AAI-636
Status: Complete

## Objective

Delete obsolete Vercel cron registrations and route implementations for Graph sync, Graph embed, and Acumatica sync after proving Render/backend owns the production workflows.

This is a cleanup slice of the AI/RAG production-finalization program. It must not remove admin/manual source-sync routes that are still used by operations readiness surfaces.

## Scope

- `/api/cron/graph-sync`
- `/api/cron/graph-embed`
- `/api/cron/acumatica-sync`
- `frontend/vercel.json` cron registrations for the routes above
- Central progress ledger: `docs/ops/ai-rag-production-finalization/TASKS.md`

## Done Checklist

- [x] Create Linear issue before coding.
- [x] Create task markdown before coding.
- [x] Prove active provider ownership for Graph sync and Graph embedding.
- [x] Prove active provider ownership for Acumatica sync.
- [x] Prove Vercel cron routes are disabled or not production-owned.
- [x] Prove no imports/internal callers depend on the deleted cron routes.
- [x] Delete only obsolete cron registrations and route implementations.
- [x] Keep admin/manual source-sync routes intact.
- [x] Update central AI/RAG finalization `TASKS.md` progress notes and deleted-code list.
- [x] Run route and source/RAG/Acumatica verification.
- [x] Fill evidence section.
- [x] Publish to `origin/main`.

## Verification Plan

- `vercel crons ls`
- Render service read-back from existing AAI-653 evidence or refreshed provider state if needed.
- `rg` route/import reference proof for each deletion candidate.
- `npm run check:routes`
- `npm run rag:verify:graph-embedding`
- `npm run verify:acumatica-sync-health`
- `npm run rag:verify:source-lifecycle`

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/vercel-crons-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/vercel-cron-deletion-proof-aai-660.md`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/vercel-cron-reference-check-after-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/route-check-after-vercel-cron-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/graph-embedding-after-vercel-cron-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-vercel-cron-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-vercel-cron-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings-after-vercel-cron-delete-aai-660.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/graph-embedding.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-manual-sync-aai-653.txt`

## Blockers

- None confirmed yet.

## Failure-Loud Guardrail

This task is blocked if any deletion candidate has an active Vercel schedule, active internal caller, missing Render/backend replacement proof, or failing verifier for the workflow it used to trigger.
