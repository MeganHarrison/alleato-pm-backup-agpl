# Provider Schedule Reconciliation

Date: 2026-06-25
Session: S91
Linear: AAI-653
Parent: AAI-636
Status: Complete for AAI-653 Gate; Broader Finalization Continues

## Objective

Reconcile production provider schedules against the final AI data pipeline and RAG target architecture, proving which schedules are active production ownership, which should be restored, and which disabled or stale cron surfaces are deletion candidates.

## Scope

- Render services/jobs for Acumatica, RAG health, AI provider health, Microsoft assistant checks, and backend scheduler ownership.
- Vercel cron configuration and registered cron state.
- Repo route/import/provider-schedule proof for cron routes before deletion or migration.
- No schedule deletion or provider-state change until ownership proof is recorded.

## Done Checklist

- [x] Create task markdown before implementation/provider changes.
- [x] Refresh live Render schedule/service state.
- [x] Refresh live Vercel cron state.
- [x] Compare live state and repo config against the final architecture document.
- [x] Classify each mismatch as restore, migrate, delete, or verify-current.
- [x] Record proof required before deleting disabled Vercel cron routes.
- [x] Execute safe provider/code changes only when ownership is proven.
- [x] Verify provider read-back after any changes.
- [x] Update AAI-637 handoff and Linear with evidence.

## Evidence

- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/render-services-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/vercel-crons-aai-653.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-schedule-patch-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-resume-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-render-trigger-run-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-manual-sync-aai-653.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-manual-sync-aai-653.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/render-db-guard-env-updates-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/render-health-cron-resume-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/render-health-cron-trigger-runs-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/outlook-bclymer-delta-redrive-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/microsoft-assistant-health-after-outlook-redrive-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-redrive-missing-after-health-resume-aai-653.json`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings-after-redrive-aai-653.txt`
- `/Users/meganharrison/Documents/alleato-pm/docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-after-provider-reconcile-aai-653.txt`

## Current Findings

- Render Graph, Teams, Fireflies, source health, email digest, RFI email ingest, and Graph subscription reconciliation schedules are active.
- Vercel Graph sync, Graph embed, and Acumatica cron registrations are disabled; their route files remain deletion candidates after replacement proof and route/import checks.
- Acumatica schedule now matches the target architecture: twice daily (`0 0,12 * * *`) in repo config, verifier contract, and live Render.
- Live Render Acumatica cron is unsuspended, and manual guarded sync completed successfully.
- `npm run verify:acumatica-sync-health` passes after the guarded manual sync.
- RAG health, AI provider health, and Microsoft Executive Assistant fallback crons are unsuspended and immediate runs were triggered.
- `npm run rag:verify:render-ai` passes.
- Microsoft Executive Assistant health passes after bounded `bclymer@alleatogroup.com` Outlook delta redrive persisted 24 rows.
- Meeting vectorization health passes after re-driving two new missing Fireflies meetings through canonical `run_full_pipeline`.
- Source lifecycle health passes after the provider reconciliation and Fireflies re-drive.
- Remaining cleanup: delete or migrate disabled Vercel cron routes only after route/import/provider/database-write proof is packaged in the cleanup slice.

## Failure-Loud Guardrail

This task fails loudly if a required scheduled fallback is suspended, if duplicate cron ownership exists without a decommission plan, or if a disabled route is deleted without route/import/provider/database-write proof that it is not production-owned.
