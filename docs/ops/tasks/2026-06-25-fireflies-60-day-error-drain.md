# Fireflies 60-Day Error Drain

Date: 2026-06-25
Linear: AAI-665
Parent: AAI-636
Status: Complete

## Objective

Classify and drain Fireflies ingestion errors created inside the 60-day operational concern window.

Fireflies errors older than two months are historical and not active production-readiness blockers unless a user explicitly asks for historical reconstruction.

## Scope

- `fireflies_ingestion_jobs` rows created in the last 60 days with `stage='error'`
- Canonical Fireflies/pipeline retry paths
- Central finalization progress ledger

## Done Checklist

- [x] Create Linear issue before coding/provider operations.
- [x] Create task markdown before coding/provider operations.
- [x] Group active 60-day Fireflies errors by cause.
- [x] Identify deterministic exclusions/non-vectorizable rows.
- [x] Identify retryable transient rows.
- [x] Re-drive a bounded recoverable batch through canonical pipeline.
- [x] Update or create verifier/evidence for grouped causes and remaining blockers.
- [x] Run `npm run rag:verify:meetings`.
- [x] Update central AI/RAG finalization `TASKS.md`.
- [x] Publish code/docs/evidence if code/docs change.

## Evidence

- Initial 60-day shared queue grouping: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-60-day-error-groups-aai-665.json`
- Embedded Fireflies error-state repair: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-embedded-error-state-repair-aai-665.json`
- Raw-ingested stale-state repair: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-raw-ingested-state-repair-aai-665.json`
- Final Fireflies-scoped grouping: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/fireflies-60-day-error-groups-final-aai-665.json`
- Meeting verifier after final drain: `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/meetings-after-fireflies-60-day-final-drain-aai-665.txt`

Final verifier result: `npm run rag:verify:meetings` passed with 75/75 recent meetings covered, zero Fireflies-scoped error jobs, zero Fireflies-scoped raw-ingested jobs, and no warnings.

## Blockers

- None for Fireflies meeting rows inside the 60-day operational concern window.
- The original 1,600-row warning was measurement drift: `fireflies_ingestion_jobs` is a shared queue name and most rows were Teams/email/knowledge rows, not Fireflies meeting rows. The verifier now joins `rag_document_metadata` and filters to Fireflies/meeting records before reporting Fireflies backlog state.
- Remaining shared queue rows outside the Fireflies meeting scope should be handled by the Graph/Teams/Outlook one-week source freshness issues, not by this Fireflies drain.

## Failure-Loud Guardrail

Do not mass-update old historical rows. Do not mark unknown failures as successful. Every remaining active 60-day error class must have cause, detection gap, prevention step, and owner path.
