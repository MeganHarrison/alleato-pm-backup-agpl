# Acumatica Payment Application Health

Status: Complete
Owner: Codex
Linear: AAI-1007
Linear URL: https://linear.app/megankharrison/issue/AAI-1007/fix-acumatica-payment-application-source-sync-critical
Started: 2026-07-07

## Objective

Resolve the remaining global source-sync critical for Acumatica payment application history without hiding incomplete financial data.

## Scope

- Capture current live failure evidence for `acumatica_financial_sync`.
- Trace the exact Acumatica payment application code path and health projection.
- Determine whether an existing configured endpoint/entity can provide payment applications.
- If an endpoint can be configured, update configuration through available provider tooling and verify read-back.
- If no provider endpoint exists, make the failure state precise, actionable, and scoped so operators understand this is an external Acumatica exposure blocker, not a RAG/source-sync failure.
- Add focused regression tests for any health/read-model or sync behavior change.
- Verify live health behavior after the change.
- Push task-owned files to `origin/main`.

## Out Of Scope

- Creating the Acumatica Generic Inquiry inside Acumatica if no CLI/API credential or endpoint supports it.
- Changing financial rollup semantics beyond payment application availability/status reporting.
- RAG ingestion, embeddings, Teams, Outlook, or project intelligence changes.
- Touching unrelated dirty frontend/docs work.

## Checklist

- [x] Linear issue created.
- [x] Live failure evidence captured.
- [x] Code path and provider/config assumptions traced.
- [x] Root cause classified as code/config/provider exposure.
- [x] Fix or explicit blocked-state behavior implemented.
- [x] Focused tests added or updated.
- [x] Focused tests pass.
- [x] Live verification captured.
- [x] Evidence section filled.
- [x] Task-owned files pushed to `origin/main`.

## Evidence

- Initial live state:
  - `get_source_sync_health()` returned `status degraded`.
  - Acumatica alert was `critical source_sync_error acumatica_financial_sync`.
  - Acumatica source row had `status='critical'`, `failedEntities=['customers','payment_applications']`, and `lastSuccessAt='2026-07-07T01:52:38.677794+00:00'`.
- Row-level sync-state evidence:
  - `payment_applications`: `status='warning'`, `last_success_at='2026-07-07T01:52:37.598584+00:00'`, `last_stats.errors=0`, `last_stats.projected=43`.
  - `customers`: `status='warning'`, `last_stats.errors=0`; warning was a dropped optional field (`Phone1`) with active field set preserved.
  - `ap_payment_applications`: `status='success'`, `fetched=1522`, `upserted=1522`, `projected=1400`.
  - `acumatica_payment_applications` table has 1705 rows.
  - `acumatica_payments` table has 411 rows.
- Root cause:
  - `backend/src/services/acumatica_sync.py` correctly records `EntitySyncResult.warnings` as `status='warning'` with `last_success_at` and `errors=0`.
  - `backend/src/services/health/source_sync_health.py` incorrectly treated any `last_error` text as a failed Acumatica state, even when the entity status was warning and the sync had a current success timestamp.
  - The provider exposure blocker remains real: Acumatica Default endpoint `Payment.ApplicationHistory` fails on BQL delegate fields, `DocumentsToApply` does not expose historical AR application lines for this tenant, and no matching OData/GI entity set currently exists. The code already lists candidate GI names and directs setting `ACUMATICA_AR_PAYMENT_APPLICATIONS_ENTITY` when exposed.
- Code change:
  - `_acumatica_sync_source()` now separates `failed_states` (`status='failed'`) from `warning_states` (`status='warning'` or warning text).
  - Failed entities remain critical.
  - Warning entities produce source status `warning`, `warningEntities`, and a warning alert, not a critical failed source.
- Focused tests:
  - `PYTHONPATH=backend python3 -m pytest backend/tests/test_source_sync_health.py backend/tests/test_acumatica_payment_applications_sync.py -q`
  - Result: `27 passed, 2 warnings in 0.12s`.
- Final live verification:
  - `STATUS degraded`
  - Only Acumatica alert: `warning source_sync_error acumatica_financial_sync`.
  - Acumatica source row: `status='warning'`.
  - `failedEntities=[]`.
  - `warningEntities=['customers','payment_applications']`.
  - `itemsSynced=3677`.

## Notes

- Do not suppress the critical unless the financial data path is either repaired or the blocker is narrowed to an explicit external Acumatica exposure action.
- The current result is narrowed, not suppressed: the alert remains visible as a warning until the Acumatica GI/entity is exposed and configured.
