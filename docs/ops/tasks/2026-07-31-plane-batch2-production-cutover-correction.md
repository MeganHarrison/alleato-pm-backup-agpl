# Task: Plane Batch 2 production cutover correction

Status: In progress
Owner: S20260731-PLANE-BATCH2-CORRECTION
Created: 2026-07-31
Task ID: AAI-1292 follow-up
Linear Issue: AAI-1292

Delivery lane: High-risk

## Objective

Correct the production Supabase target and migration-version collision found by
the authenticated release proof, remove legacy Tasks destinations from Plane
Home, expose the completed Stickies surface, and repair dead Plane shell links.

## Acceptance contract

- The six approved Plane Batch 2 migrations are applied atomically to the
  Supabase project embedded in the production bundle.
- Every migration has a unique production-ledger version and the repository
  contains those exact versioned files.
- Favorites and Recents returns HTTP 200 in an authenticated production session.
- Plane Home task rows open `/:projectId/plane/work-items?peek=:taskId`; no Home
  work-item link targets the legacy `/:projectId/tasks` composition.
- `/:projectId/plane/stickies` is a supported, linked, functional surface.
- `/:projectId/plane` and the Home project-settings link resolve without 404s.
- Focused tests, changed-file lint, route-conflict checks, an independent review,
  exact AGPL publication, production deployment, and authenticated browser proof
  all pass before retirement is considered.

## Incident learning

- Cause: the production JavaScript bundle identifies PM APP project
  `lgveqfnpkxvzbnnwuled`, while the first migration apply targeted a different
  accessible Supabase project. The real production ledger also already used two
  proposed migration timestamp versions for unrelated changes.
- Detection gap: database-object checks were run against the selected migration
  project, but the release gate did not compare that project with the Supabase
  project embedded in the deployed client bundle or check remote version
  collisions before apply.
- Prevention: the migration files are re-versioned against the production ledger;
  focused filename-contract tests own the versions; production verification must
  identify the deployed Supabase host and query its ledger before every future
  migration batch.

## Evidence

| Check | Result |
| --- | --- |
| Production bundle Supabase host | `lgveqfnpkxvzbnnwuled.supabase.co` |
| Pre-apply object readback | All five new domain tables/access RPC absent |
| Six-migration transaction dry run | Passed |
| Atomic production apply | Passed for versions `20260731231000` through `20260731231500` |
| Ledger/object/RLS/anon readback | Passed; six exact versions present, required objects exist, RLS enabled, anonymous CRUD denied |
| Repository ledger verifier | Passed independently for all six re-versioned migration files |
| Live Favorites/Recents API after apply | HTTP 200 with `{"items":[]}` |
| Focused Jest | 11 suites, 57 tests passed |
| Follow-up navigation Jest | 4 suites, 25 tests passed |
| Shell navigation Vitest | 1 file, 3 tests passed |
| Changed-file ESLint | Passed with zero errors |
| Route conflicts | Passed |

## Remaining release gates

- [ ] Independent review passes.
- [ ] Exact AGPL mirror is published.
- [ ] Corrective commit is pushed to production `main`.
- [ ] Vercel is Ready for the exact corrective commit.
- [ ] Home task click, Stickies, base breadcrumb, and setup destination pass in production.
- [ ] Corrected desktop/mobile screenshots are captured.
- [ ] User explicitly accepts the replacement before legacy composition retirement.
