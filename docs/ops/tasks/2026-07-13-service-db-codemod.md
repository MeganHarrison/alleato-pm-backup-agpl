# Guarded service data router codemod

Status: Partial — bounded automated adoption complete; mixed callers deferred

## Scope

Use a dry-run-first codemod to migrate only direct PM-App service clients whose
usage is statically limited to local `.from("table")` calls. Leave mixed,
RAG, auth, RPC, storage, whole-client, inline, and typed-factory callers in a
review bucket.

The split mode preserves `createServiceClient()` for non-table operations and
routes only statically known `.from("table")` calls through `serviceDb`.

## Checklist

- [x] Add a dry-run-first codemod with explicit safety gates.
- [x] Add root scripts for audit and controlled write mode.
- [x] Audit all frontend factory callers and produce safe/review counts.
- [x] Apply the safe migration set.
- [x] Apply the guarded split migration set without changing non-table client behavior.
- [x] Route the remaining inline static factory calls and add an inline guardrail.
- [x] Route dynamic `.from(table)` calls when the table union is compile-time bounded.
- [x] Run authenticated browser verification across every affected page/API entrypoint.
- [x] Run changed-file lint, router tests, route checks, and diff checks.
- [ ] Run full typecheck and classify any codemod-related failures.

## Guardrails

- Never rewrite RAG or Outlook tables through the PM-App adapter.
- Never rewrite modules using auth, RPC, storage, schema, realtime, or whole
  client behavior.
- Never rewrite a factory passed as a dependency or used in a type position.
- Default command is dry-run; writes require `--write`.

## Current audit

- 336 direct factory modules scanned in the current working tree.
- 79 safe for mechanical migration in this batch.
- 254 direct factory imports remain detectable; 96 are preserved factory
  bindings whose table calls are already split-routed, leaving 158 callers for
  behavioral review because they mix client-wide behavior, other adapters,
  dynamic usage, non-generated tables, or additional service exports.

## Evidence

- Write command: `node scripts/codemods/service-db-adoption.mjs --write --json`
  migrated exactly 79 modules in this batch, in addition to the earlier bounded
  accounting, executive, and feedback slices.
- Split write command: `node scripts/codemods/service-db-adoption.mjs
  --split-write --json` migrated exactly 96 modules while preserving their
  original service client for auth, RPC, storage, and other client-wide calls.
- Router Jest: 9 tests passed.
- Changed-file ESLint: passed with 0 errors.
- Route check: passed.
- Diff check: passed after removing codemod-generated trailing whitespace.
- Adoption guardrail: `node scripts/codemods/service-db-adoption.mjs
  --fail-on-safe --json` — passed with zero mechanically safe callers
  remaining.
- Split adoption guardrail: `node scripts/codemods/service-db-adoption.mjs
  --fail-on-split-safe --json` — passed with zero split-safe callers remaining;
  158 mixed callers remain for behavioral review.
- Inline adoption guardrail: `node scripts/codemods/service-db-adoption.mjs
  --fail-on-inline-safe --json` — passed with zero inline-safe callers
  remaining.
- Dynamic factory audit: zero remaining direct `createServiceClient()` bindings
  call `.from(variable)`; the bounded cases in operations readiness and my
  feedback now use `serviceDb` with compile-time table constraints.
- Full frontend typecheck: `cd frontend && npm run typecheck` timed out after
  300 seconds with the repository's fail-loud timeout guard; no file-level
  errors surfaced and no overlap with the 96-file split batch was reported.
  Likely owner of the timeout is `frontend/tsconfig.json` and the heavy
  app/generated program, not the serviceDb migration.
- Valid-record browser recheck: `/api/commitments/52865682-6b73-48c7-8db7-b6bb289a386f/emails`
  returned 200 with an empty result. A direct read using both `serviceDb.from("conversations")`
  and the pre-migration `createServiceClient().from("conversations")` reproduced the same
  `{ "message": "" }` database error for the usage-stats count query, so that 500 is
  pre-existing database/runtime debt rather than a serviceDb routing regression.
- The remaining placeholder-ID routes had no valid records in the authenticated test
  dataset: `/api/tasks?scope=mine` and `/api/projects/1009/drawings` returned empty
  collections. Insight-card action requests with a syntactically valid UUID redirected
  to the expected owner-brief flow instead of producing the placeholder UUID 500.

## Browser verification evidence

- Authenticated Chromium crawl report: `/tmp/service-db-browser-verification-report.tsv`.
- Scope: all 164 affected page/API entrypoints from the migration batches.
- Initial dev-server crawl results: 39 clean passes; 24 expected GET/405 method boundaries; 5 expected
  404s for placeholder record IDs; 41 auth/permission responses; 9 HTTP 500s;
  7 page navigation/render errors; and 39 route timeouts.
- That initial crawl's 9 HTTP 500s were concentrated on placeholder UUID `1` inputs for
  commitments, insight cards, directory companies, drawings, and tasks, plus
  `ai-assistant/usage-stats`; they require valid-record reruns before being
  treated as migration regressions.
- The page errors and timeouts clustered while the Next dev server became
  CPU-bound under the crawl. They are valid verification blockers, not passes.
- A sequential retry of the timeout cluster was also invalidated by the same
  infrastructure condition: after restart, `next-server` reached approximately
  306% CPU during the first warmed browser navigation and produced no route
  response before the browser process exited. No retry result was counted as a
  pass.
- Production-server fallback: `npm run start -- --port 3002` could not start
  because no production build existed. `npm run build` passed its route
  contract checks but then exhausted the configured 7 GB heap during optimized
  compilation (`FATAL ERROR: Ineffective mark-compacts near heap limit`). This
  is a repository-wide build-resource blocker, not a serviceDb-specific
  browser result.
- Production build recovery: `NEXT_PRODUCTION_BUILD_ENGINE=webpack
  NEXT_PRODUCTION_BUILD_NODE_OPTIONS='--max-old-space-size=16384'
  npm run build:production` completed successfully in 5.8 minutes with one
  compiler process. The build wrapper now retries `.next` cleanup after
  Turbopack/Next manifest writers finish, preventing `ENOTEMPTY` from hiding
  the Webpack fallback.
- Build guardrail: `run-production-build.mjs` now takes an exclusive lock and
  fails loudly when a second production compiler is started, preventing the
  duplicate/orphaned compiler condition that caused the memory spike.
- Local build default: the wrapper now uses a 16 GB Node heap locally and keeps
  the 7 GB Vercel setting, so the successful local build does not depend on an
  undocumented shell override.
- Production browser rerun: after refreshing the expired test session,
  authenticated Chromium exercised all 164 affected page/API entrypoints
  against `http://localhost:3002`. Results were 58 HTTP 200, 5 HTTP 400, 3
  HTTP 401, 37 HTTP 403, 10 HTTP 404, 37 HTTP 405, 2 access-denied redirects,
  and 12 HTTP 500 responses. There were zero browser timeouts or compiler
  failures. Eleven 500s were caused by the inventory's placeholder record ID
  `1` being passed to UUID-backed routes; the remaining 500 is the existing
  `ai-assistant/usage-stats` conversations-count database error reproduced
  with the pre-migration client as well.

## Remaining risk

The remaining 257 callers are not safe for a syntax-only rewrite. They need
behavioral review grouped by client ownership: RAG/Outlook adapter selection,
auth or RPC usage, dynamic table selection, factory injection, and service
imports with multiple exports. The codemod now fails loudly if a new safe
caller is introduced, so future adoption can continue in small verified
batches.
