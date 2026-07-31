# Graph Teams Outlook One-Week Queue Classification

Date: 2026-06-25
Linear: AAI-668
Parent: AAI-636
Status: Complete

## Objective

Classify and repair active Graph/Teams/Outlook queue rows inside the one-week operational concern window.

Outlook email and Teams message backlog errors older than one week are historical and not active production-readiness blockers unless a user explicitly asks for historical reconstruction.

## Scope

- Shared `fireflies_ingestion_jobs` rows created in the last 7 days for Outlook email, Microsoft Teams messages, Microsoft Graph, and related SharePoint/Graph documents.
- Canonical Microsoft Graph sync and embedding retry paths.
- Source-specific RAG and source lifecycle verifiers.
- Central finalization progress ledger.

## Done Checklist

- [x] Create Linear issue before coding/provider operations.
- [x] Create task markdown before coding/provider operations.
- [x] Group active one-week shared queue rows by source, stage, and cause.
- [x] Identify Outlook email rows needing retry or state repair.
- [x] Identify Teams message rows needing retry or state repair.
- [x] Identify SharePoint/Graph document rows that should move to the SharePoint/PDF workstream instead of Outlook/Teams.
- [x] Re-drive or repair bounded recoverable rows through canonical pipeline paths only.
- [x] Run `npm run rag:verify:source-specific`.
- [x] Run `npm run rag:verify:source-lifecycle`.
- [x] Update central AI/RAG finalization `TASKS.md`.
- [x] Publish code/docs/evidence if code/docs change.

## Evidence

- One-week shared queue grouping: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/graph-teams-outlook-one-week-queue-aai-668.json`
- Source-specific verifier: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-specific-one-week-graph-aai-668.txt`
- Source lifecycle verifier: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/source-lifecycle-one-week-graph-aai-668.txt`

Results:

- One-week shared queue rows for Outlook/Teams/Graph: `0`.
- `npm run rag:verify:source-specific`: pass.
- `npm run rag:verify:source-lifecycle`: pass.
- Outlook lifecycle: 516 recent sources, 448 embedding-required, embedded ratio 1.0, lifecycle ratio 1.0, project disposition ratio 1.0.
- Teams lifecycle: 293 recent sources, 187 embedding-required, embedded ratio 1.0, lifecycle ratio 1.0, project disposition ratio 1.0.
- Recent Outlook/Teams failures in lifecycle evidence are terminal `skipped_low_content`, not retryable backlog.

## Blockers

- None for Outlook/Teams shared queue rows inside the one-week operational concern window.
- SharePoint document processing remains a separate workstream because this queue audit found no active one-week SharePoint/Graph shared queue rows and the final-state requirements for SharePoint include OCR/image extraction validation beyond Outlook/Teams freshness.

## Failure-Loud Guardrail

Do not mass-update old historical rows. Do not treat a shared queue row as Outlook or Teams without source metadata proof. Every remaining active one-week error class must have cause, detection gap, prevention step, and owner path.
