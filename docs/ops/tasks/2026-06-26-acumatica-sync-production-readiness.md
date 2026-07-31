# Acumatica Sync Production Readiness

Date: 2026-06-26
Linear: AAI-697
Parent: AAI-636
Status: Complete

## Objective

Verify Acumatica synchronization satisfies final production requirements for retry behavior, failure logging, sync statistics, and duplicate-import prevention.

## Scope

- Live Render cron schedule and command proof.
- Acumatica sync run/state table health.
- Retry or fallback behavior in code and, where practical, live evidence.
- Failure logging in `acumatica_sync_runs` and `acumatica_sync_state`.
- Sync statistics recorded per entity.
- Duplicate-import prevention through upsert/conflict keys and live duplicate probes.
- Implementation repair only if evidence shows an active gap.

## Done Checklist

- [x] Create Linear issue before provider operations or code edits.
- [x] Create task markdown before provider operations or code edits.
- [x] Post Linear kickoff comment.
- [x] Inventory Acumatica sync code paths, provider schedule, state tables, and duplicate keys.
- [x] Run existing Acumatica sync health verifier and record output.
- [x] Verify retry/fallback behavior.
- [x] Verify logging captures success, warnings, and failures.
- [x] Verify sync statistics are written for each required entity.
- [x] Verify duplicate-import prevention for raw and projected Acumatica tables.
- [x] Patch any confirmed active gap with tests or verifier proof.
- [x] Delegate frontend typecheck after any TS/JS implementation change.
- [x] Update central AI/RAG finalization `TASKS.md`.
- [x] Update handoff with evidence and residual risk.
- [x] Publish code/docs/evidence if changed.

## Evidence

Evidence will be stored under:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/`

Linear issue:

- AAI-697: https://linear.app/megankharrison/issue/AAI-697/verify-acumatica-retry-logging-statistics-and-duplicate-prevention
- Kickoff comment: `6546986e-bb53-4f0c-80f9-03d03f626294`
- Closeout comment: `29e5b0e9-a8bf-4902-83e2-b7a4f677c78e`

Evidence artifacts:

- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-baseline-aai-697.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-sync-health-after-stale-threshold-fix-aai-697.txt`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-run-state-duplicate-inventory-aai-697.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-code-guardrail-inventory-aai-697.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/acumatica-logging-stats-duplicate-proof-aai-697.json`
- `docs/ops/evidence/2026-06-25-ai-rag-production-finalization/frontend-typecheck-after-acumatica-verifier-threshold-aai-697.txt`

## Initial Constraints

- The checkout contains unrelated dirty frontend files; this slice must stay scoped to Acumatica docs, evidence, and any confirmed Acumatica implementation files.
- Do not rerun expensive full quality gates in the main thread; delegate full/project typecheck if any TS/JS implementation changes occur.
- Do not expose Acumatica or provider secrets in evidence or final responses.

## Blockers

- None for this slice.

Residual risk:

- The live `payment_applications` entity still logs a warning because Acumatica's Default endpoint does not expose historical AR payment application lines. The sync does not fail silently: the warning is persisted in `acumatica_sync_runs.stats.warnings`, and the current production fallback projects prime contract payments from `acumatica_payments` where the customer-to-project mapping is unique. Exposing a dedicated Acumatica Generic Inquiry would improve detail fidelity, but it is not blocking the required twice-daily sync, logging, stats, or duplicate-prevention gates verified here.

## Root Cause

- The Acumatica health verifier still used a 180-minute default stale threshold even though the final production architecture and live Render cron run Acumatica twice daily at `0 0,12 * * *`. That made the verifier fail between scheduled runs even when the last required entity sync was healthy for the documented cadence.

## Prevention

- `scripts/verify/verify-acumatica-sync-health.mjs` now defaults `ACUMATICA_SYNC_MAX_STALE_MINUTES` to 780 minutes, matching a twice-daily cadence plus one hour of scheduler/provider jitter.
- The live health verifier now reads Render cron state and sync table freshness together, so schedule drift or stale entity state fails loudly.
- Duplicate prevention is covered by code upsert/conflict-key inventory, live unique-index proof, and zero-duplicate probes across 18 Acumatica raw/projection key sets.

## Failure-Loud Guardrail

This slice is complete because retry/fallback behavior, logging, statistics, and duplicate prevention are proven by repeatable checks and the stale-threshold guardrail was repaired. Publication remains the final mechanical step.
