# Service data router: feedback matcher adoption

Status: In progress

## Scope

Move `frontend/src/lib/admin-feedback/tool-matcher.ts` from direct PM-App client
construction to the typed `serviceDb.from("procore_tools")` seam. Preserve the
matcher and list/get behavior.

## Checklist

- [x] Confirm the module uses only PM-App table access.
- [x] Replace direct PM-App client construction.
- [x] Add PM-App router coverage for `procore_tools`.
- [x] Run focused Jest, ESLint, route, and diff checks.
- [x] Run or classify the full frontend typecheck.

## Failure-loudly guardrail

Keep the existing explicit null/empty behavior when the tool table cannot be
loaded. Routing must still be table-driven through the PM-App adapter.

## Evidence

- Focused Jest: `pnpm --dir frontend exec jest --runTestsByPath
  src/lib/supabase/__tests__/service-db.test.ts --runInBand` — 9 tests passed.
- Focused ESLint, route check, and `git diff --check` — passed.
- Latest full typecheck classified unrelated AI, progress-report, task, and
  route/Supabase errors; this module and `service-db.ts` were not reported.
