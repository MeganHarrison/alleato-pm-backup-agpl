# Service data router: executive adoption

Status: Partial — bounded slice complete; full typecheck pending

## Scope

Migrate the daily recap link and on-demand progress-report assembly modules to
the typed `serviceDb.from(table)` interface. Preserve public behavior and keep
the existing accounting adoption slice separate.

## Checklist

- [x] Confirm both modules use only PM-App table access.
- [x] Replace direct PM-App client construction.
- [x] Add router coverage for the executive tables.
- [x] Run focused Jest, ESLint, route, and diff checks.
- [x] Run the full frontend typecheck and classify failures.
- [x] Record evidence and remaining router adoption work.

## Failure-loudly guardrail

The router must preserve table-specific row typing and must continue to route
RAG tables to the RAG adapter without PM-App fallback. The existing router tests
cover the fail-loud missing-RAG path; this slice adds PM-App table coverage.

## Evidence

- Focused Jest: `pnpm --dir frontend exec jest --runTestsByPath
  src/lib/supabase/__tests__/service-db.test.ts --runInBand` — 8 tests passed.
- Focused ESLint: passed for the two migrated modules, router, and router test.
- Route check: `npm run check:routes` — passed.
- Diff check: `git diff --check` — passed.
- Full frontend typecheck: delegated; no global pass is claimed.
- Full frontend typecheck: `cd frontend && npm run typecheck` — failed on
  unrelated AI communication-tool fields, progress-report signal/server types,
  task deduplication, and existing route/Supabase typing issues. None of the
  executive adoption files or `service-db.ts` appeared in the failure set.

## Remaining

- Classify the delegated full typecheck result when available.
- Continue adoption in small PM-App-only slices; retain direct factories for
  auth, RPC, storage, whole-client, and RAG-specific callers.
