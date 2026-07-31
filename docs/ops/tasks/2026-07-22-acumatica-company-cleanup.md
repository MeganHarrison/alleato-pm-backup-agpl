# Task: Acumatica company cleanup

Status: In Progress
Owner: Codex S212
Created: 2026-07-22
Task ID: AAI-1245
Linear Issue: [AAI-1245](https://linear.app/megankharrison/issue/AAI-1245/purge-unreferenced-non-acumatica-companies-with-relationship-safe-sync)
Related Handoff: `docs/ops/handoffs/2026-07-22-S212-acumatica-company-cleanup.md`

## Objective

Delete every company that is not Acumatica-backed and has no live relationship to any other record, then enforce the same relationship-safe cleanup after successful Acumatica company projections.

## Scope

- `companies` cleanup function, Acumatica sync integration, focused contract tests, and production data cleanup.
- Preserve every company with an Acumatica vendor/customer identity or any incoming company foreign-key reference, including project directory and commitment links.
- Excludes merging duplicates or deleting Acumatica-backed companies.

## Source of Truth

- Canonical runtime/data owner: `backend/src/services/acumatica_sync.py` and Supabase `public.companies`.
- Existing shared service: `AcumaticaFinancialSyncService.sync_all`.
- Relationship owner: live Postgres foreign-key catalog where `confrelid = public.companies`.

Verification contract: Required

## Acceptance Criteria

- [x] Unlinked, non-Acumatica companies are removed from production.
- [x] Any company referenced by another record is retained regardless of its reference action.
- [x] Acumatica vendor and customer identities are retained.
- [x] Cleanup runs only after both vendor and customer projections succeed and reports its outcome.
- [x] Failure-loudly behavior is defined.

## Implementation Checklist

- [x] Create a catalog-driven database cleanup function and migration.
- [x] Invoke the cleanup through the canonical Acumatica sync owner.
- [x] Add focused regression tests for sync ordering and failure behavior.
- [x] Apply the migration and execute the production cleanup.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [x] Live pre/post inventory proves that only eligible rows were deleted.
- [x] Evidence artifacts are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: the sync payload includes a `company_cleanup` result; an RPC failure marks the run partial failure and is logged with the cause.
- Detection path: `acumatica_sync_runs` cleanup record, sync response, and focused contract test.
- Recovery path: repair the referenced constraint/data issue and rerun the canonical Acumatica sync; the cleanup is idempotent.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: the Acumatica sync projected source companies but had no canonical reconciliation step for manual/unlinked directory rows.
- Detection gap: no catalog-driven candidate inventory or post-sync cleanup result existed.
- Prevention: dynamic foreign-key graph check with a successful-projection gate and regression tests.
- Guardrail evidence: `backend/tests/test_acumatica_company_cleanup.py` plus the production idempotence and permission readback in `docs/ops/evidence/2026-07-22-aai-1245-company-cleanup/verification.md`.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Live fault localization | Supabase FK and company inventory query | Passed | 773 companies, 527 vendor-linked, 35 incoming FK paths observed before mutation. |
| Task setup | This task file | Passed | Scope and done gate captured before implementation. |
| Focused regression | `PYTHONPATH=backend pytest -q backend/tests/test_acumatica_company_cleanup.py backend/tests/test_acumatica_customer_projection.py` | Passed | 11 tests passed; projection-order and loud-skip contracts included. |
| Migration ledger | `npm run db:migrations:verify-applied -- <two task migrations>` | Passed | Both remote ledger entries match local files. |
| Production cleanup | `select count(*) from public.purge_unlinked_non_acumatica_companies()` | Passed | First invocation deleted 52; post-readback found 721 remaining companies and 0 candidates. |
| Idempotence and permission | Function readback | Passed | Second invocation deleted 0; service role can execute, anonymous/authenticated roles cannot. |
| Canonical route | Linear AAI-1245 screenshot attachment | Passed | Authenticated production Company Directory capture attached to the task comment. |

## Remaining Risk

- A non-FK textual/external reference is intentionally not a relationship attachment; only actual database relationships protect a row. Owner: database model; next action: review any future company relationship as an FK.

## Final Status

- [ ] All required checklist items are complete. Publication/deploy verification remains.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
