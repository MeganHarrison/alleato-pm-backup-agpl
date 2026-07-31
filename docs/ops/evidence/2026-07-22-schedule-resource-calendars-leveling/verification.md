# Phase 4B Verification

Task: ALL-5 / S218
Feature: Project-scoped resource calendars and preview-only resource leveling
Date: 2026-07-22
Decision: PASS with a documented repository-wide build/type baseline gap outside Phase 4B

## Verified Claims

1. A schedule manager can replace one existing project resource's sparse weekday and dated capacity facts atomically. The five-argument write RPC uses compare-and-swap; a stale version fails with SQLSTATE `40001` and HTTP 409.
2. Allocation, task-span availability, and leveling share the same precedence: project non-working zero, dated exception, weekday override, inherited 100 percent.
3. Capacity and leveling facts come from `get_schedule_resource_read_model(...)`, one PostgreSQL statement snapshot. Capacity write readback comes from the same write transaction.
4. Leveling is pure, deterministic, finite-horizon, delay-only, and preview-only. There is no Apply control, mutation endpoint, persistence table, or task-date write path.
5. New schedule revisions capture one immutable capacity snapshot for every snapshotted resource, while older revisions explicitly report unavailable capacity provenance.
6. Capacity is labeled as project capacity and does not claim cross-project availability.

## Database Evidence

- `20260722161757_schedule_resource_calendars.sql` adds normalized capacity tables, tenant-safe references, RLS/grants, guarded replacement, snapshot provenance/count equality, and immutability.
- `20260722172738_harden_schedule_resource_capacity_consistency.sql` adds compare-and-swap replacement, the coherent read-model RPC, and the project/date/resource exception index.
- `20260722183059_enforce_schedule_resource_read_range.sql` makes the 92-day project-wide read limit a database boundary and keeps the underlying coherent implementation private and non-executable to authenticated callers.
- `npm.cmd run db:migrations:verify-applied` passed for `20260722161757`, `20260722172738`, and `20260722183059`.
- `npm.cmd run db:types:check` passed after exact regeneration from the linked schema.
- `schema-readback.sql` passed for functions, fixed empty search paths, privileges, RLS, index, snapshot objects, provenance, and applied ledger versions.
- `mutation-probes.sql` passed inside a rollback-only transaction. Direct DML, unauthorized/inactive/cross-project/malformed/duplicate mutations, snapshot mutation, and stale compare-and-swap were rejected.
- `cleanup-readback.sql` returned zero temporary task, capacity-exception, and revision rows.

## Regression Tests

- Focused Jest: 13 suites passed, 85 tests passed. Coverage includes capacity precedence, deterministic allocation and leveling, all dependency relationships and lag, constraints, fixed reservations, finite horizon, coherent read-model parsing, CAS replacement, route validation/error mapping, stale-editor conflict, cross-chunk drift rejection, hook invalidation, dialog locking, panel retry/failure states, and task availability.
- Focused scheduling-engine coverage: 90.68% statements, 85.49% branches, 95.94% functions, and 93.69% lines.
- Targeted ESLint passed for the Phase 4B TypeScript/React files.
- `npm.cmd run guardrails:db-type-overrides` passed.
- The changed-route guardrail passed when invoked with `GUARDRAIL_ENFORCE_RAW_ERRORS=true`.

## Authenticated Browser Proof

- Auth setup passed and saved an ignored local session for the configured test user.
- Chromium E2E `frontend/tests/e2e/schedule/schedule-resource-capacity.spec.ts` passed: 1 test in 1.9 minutes after the development routes were compiled.
- The flow provisioned a uniquely identified person/resource for the worker, edited its project capacity, observed variable allocation, ran the no-write leveling preview, and deleted the isolated resource/membership/person during cleanup.
- Before/after assertions covered planned and forecast dates, constraints, duration, progress, status, and milestone state.
- Desktop and mobile screenshots are `schedule-project-capacity-desktop.png` and `schedule-project-capacity-mobile.png`.

## Negative and Failure-Loud Paths

- Missing or failed capacity reads do not silently substitute 100 percent.
- Explicit zero capacity remains a real working-day fact in task availability.
- Invalid ranges, percentages, duplicates, horizons, resource state, authorization, project scope, and stale editor versions return typed errors or visible diagnostics.
- Cycles, unresolved predecessors, hard-constraint conflicts, invalid/missing assignments, and finite-horizon exhaustion remain visible preview diagnostics.
- Saving a capacity profile invalidates any in-flight preview; dialog controls and dismissal remain locked during the save.
- Long task spans are fetched in 92-day chunks only when every chunk has the same profile set, IDs, versions, and weekday facts; cross-chunk drift fails visibly.

## Visual Review

- Desktop: capacity controls remain progressively disclosed within the canonical schedule resource panel; project-scope and preview-only labels are visible.
- Mobile: the same canonical page remains usable without introducing a second scheduling surface.
- The UI exposes no Apply action and does not imply enterprise-wide availability.

## Bounded Repository Baseline Gap

- A repository-wide `tsc --noEmit` completed and reported numerous existing errors in unrelated admin, AI, API, and library paths. No new Phase 4B-owned file was reported; the existing scheduling errors were in the pre-existing task field-update and trade-alert routes.
- A full production build attempt approached the 12 GiB heap ceiling and exited without a source diagnostic. This workstation constraint is recorded rather than presented as a passing build.
- Phase 4B release confidence comes from the clean focused suite, exact live-schema checks, rollback-only probes, authenticated E2E, cleanup readback, and independent code/React/database reviews.

## Manual Follow-up

- Update or close Linear issue ALL-5 manually. Active browser policy rejected `linear.app`; no alternate or indirect workaround was used.
- Cross-project enterprise capacity and project-keyed revision locking are separate future design phases.
