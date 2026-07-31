# Service data router: accounting adoption

Status: Partial — bounded slice complete; broader adoption deferred

## Scope

Adopt `serviceDb.from(table)` in the three PM-App accounting modules that use
only service-role table access. Preserve their existing public interfaces and
fail-loud error behavior.

## Checklist

- [x] Confirm `serviceDb` has a real PM-App adapter and typed table registry.
- [x] Confirm the selected modules do not use auth, RPC, storage, or client-wide behavior.
- [x] Replace direct PM-App client construction in the three scoped modules.
- [x] Add or update focused tests for the migrated modules and router behavior.
- [x] Run focused unit checks and route/diff guardrails.
- [x] Run the full frontend typecheck and classify unrelated baseline failures.
- [x] Record changed files, evidence, and remaining adoption work.

## Evidence

- Architecture review: `/tmp/architecture-review-20260713.html`
- Router implementation: `frontend/src/lib/supabase/service-db.ts`
- Router tests: `frontend/src/lib/supabase/__tests__/service-db.test.ts`
- Current full typecheck has unrelated baseline failures in feedback inbox,
  training docs, drawing annotations, AI communication tools, and other files.
- Focused test: `pnpm --dir frontend exec jest --runTestsByPath
  src/lib/supabase/__tests__/service-db.test.ts --runInBand` — 7 tests passed.
- Focused lint: `pnpm --dir frontend exec eslint
  src/lib/accounting/payment-guardrails.ts
  src/lib/accounting/acumatica-ap-bills.ts
  src/lib/accounting/acumatica-actuals.ts
  src/lib/supabase/__tests__/service-db.test.ts` — passed.
- Router typing repair: `serviceDb.from(table)` now preserves the table-specific
  `PostgrestQueryBuilder` row type; this removed the adoption-specific errors in
  `acumatica-actuals.ts` and `acumatica-ap-bills.ts`.
- Full typecheck: `cd frontend && npm run typecheck` — failed on unrelated
  source-sync `metadata_id` nullability, missing `drawing_annotations` generated
  relation, AI SDK export drift, and missing progress-report fields. The two
  Acumatica modules were not present in the final failure set.

## Changed files

- `frontend/src/lib/supabase/service-db.ts`
- `frontend/src/lib/supabase/__tests__/service-db.test.ts`
- `frontend/src/lib/accounting/payment-guardrails.ts`
- `frontend/src/lib/accounting/acumatica-ap-bills.ts`
- `frontend/src/lib/accounting/acumatica-actuals.ts`

## Remaining adoption work

Continue in small PM-App-only slices. Do not mechanically replace callers that
need `.auth`, `.rpc`, `.storage`, a whole client, or a RAG adapter. Preserve the
compatibility factories until all genuine exceptions are inventoried.

## Failure-loudly guardrail

The router must continue to select the PM-App adapter by table membership and
must never fall back to the PM-App adapter for a RAG table when RAG configuration
is missing. Focused router tests cover both project selection and missing-RAG
failure behavior.
