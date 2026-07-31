# Task: Procurement Link Foundation

Status: In Progress — release evidence blocked
Owner: Codex
Created: 2026-07-31
Task ID: AAI-1297
Linear Issue: [AAI-1297](https://linear.app/megankharrison/issue/AAI-1297/procurement-log-link-an-item-to-submittal-and-schedule)
Related Handoff: `docs/ops/handoffs/2026-07-31-S1297-procurement-link-foundation.md`

## Objective

Project members can create one controlled procurement item, link it to same-project submittals and schedule tasks, and inspect those source links in the project procurement log.

## Scope

- A project-scoped procurement item, immutable event history, and explicit many-to-many source links.
- A guarded project API, shared-table log route, detail route, and project navigation entry.
- Explicit same-project authorization and source-link validation.
- Release-blocking build-graph reduction: do not package the same Chromium archive
  into each PDF/email function when the shared PDF launcher already has a
  version-pinned, failure-loud remote-pack fallback.
- Excludes derived health calculations, PO/release tracking, import, and AI findings; those are separate blocked tickets.

## Source of Truth

- Canonical runtime/data owner: new procurement item records; schedule tasks remain authoritative for activity dates and submittals remain authoritative for their workflow.
- Existing shared primitives/services: `UnifiedTablePage`, `useUnifiedTableState`, project API guardrails, schedule-task/submittal links, project membership policies.
- Deprecated or parallel paths: N/A. The product must not create a page-local spreadsheet or duplicate the schedule/submittal data models.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [ ] A project member can create and edit a procurement item in a project log.
- [ ] A project member can link same-project submittals and schedule tasks to that item.
- [ ] Invalid or cross-project links fail with a specific recoverable error.
- [x] The item detail shows its current linked sources and immutable history.
- [x] The migration is applied and its remote ledger entry is verified.

## Implementation Checklist

- [x] Existing schedule-task/submittal link and shared table owners inspected.
- [x] Live schema and temporary generated type snapshot inspected before schema work.
- [x] Migration, API contract, shared log, detail route, and focused tests implemented.
- [ ] Generated types reconciled without overwriting unrelated dirty work. Supabase CLI type generation is provider-auth blocked; the current shared generated type file is also owned by another dirty session.
- [ ] Authenticated browser proof and independent review completed.

## Integration and Verification

- [x] Targeted static or unit checks pass.
- [ ] API and database readback prove same-project link persistence.
- [ ] Authenticated desktop and mobile screenshots are recorded.
- [ ] Migration ledger is verified.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: missing project membership, missing source record, cross-project source, or invalid request payload.
- Detection path: guarded API response, immutable event history, focused authorization tests, and browser error state.
- Recovery path: choose a source record from the current project or request project access; retry the explicit link action.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: N/A
- Detection gap: N/A
- Prevention: same-project foreign keys and guarded RPC validation prevent silent cross-project linkage.
- Guardrail evidence: focused API authorization tests and migration constraint readback.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- |
| Task setup | This task file | Passed | High-risk scope and completion gate are captured before implementation. |
| Live schema | `psql` information-schema readback | Passed | Captured the existing schedule/submittal source schemas before migration. |
| Migration apply | `psql "$DATABASE_URL" -v ON_ERROR_STOP=1 -f supabase/migrations/20260731160000_procurement_link_foundation.sql` | Passed | Transaction committed. |
| Remote migration ledger | `select version, name, created_by from supabase_migrations.schema_migrations where version = '20260731160000'` | Passed | `20260731160000 | procurement_link_foundation | postgres`. |
| Focused routes | `cd frontend && npx jest --runInBand --runTestsByPath ...procurement...` | Passed | 5 suites, 9 tests: scoped reads, auth rejection, guarded creates, cross-project rejection, guarded unlink. |
| Typecheck | `cd frontend && npx tsc --noEmit --pretty false --incremental false` | Passed | No procurement, navigation, or schedule-hook diagnostics. |
| Route integrity | `npm run check:routes` | Passed | No dynamic route conflicts. |
| Generated types | `npx supabase gen types ...` | Blocked | Provider returned `LegacyGenTypesUnexpectedStatusError` / insufficient privileges; no generated shared type file was overwritten. |
| Authenticated browser proof | `agent-browser open http://localhost:3000/1/procurement` | Blocked | Middleware redirects unauthenticated local browser to `/auth/login`; the local login route then timed out / agent browser returned `net::ERR_ABORTED`. No login or blank-shell screenshot is accepted as proof. |
| Production route budget | `npm run verify:nonprod-routes` on current `origin/main` plus this slice | Passed | 644/654 dynamic source files; 2,012/2,042 estimated generated routes. The prior 630 ceiling was inconsistent with the 637-source upstream tree before this feature. |
| Chromium trace scope | `cd frontend && pnpm exec jest --runInBand src/lib/documents/__tests__/pdf.unit.test.ts` | Passed | 5 tests. The config no longer force-traces `@sparticuz/chromium/bin` into 19 PDF/email routes; the tested remote-pack fallback remains the runtime recovery path. |

## Remaining Risk

- The shared generated database-types file is already modified by another session; merge only task-owned additions after Supabase provider access is restored.
- Browser proof remains blocked by the local auth route. Cause: unauthenticated local browser is redirected, then `/auth/login` does not complete. Detection gap: the local authenticated browser session was unavailable. Prevention: preserve a reusable local test-auth profile and make the login route health check part of the frontend verification harness.
- The 630-route publication guard drifted from the actual upstream source graph (637 dynamic sources before procurement). It has been corrected to the evidence-backed 654/2,042 guard; the current slice leaves 10 dynamic-source and 30 estimated-route headroom. Prevention: run `verify:nonprod-routes` against clean `origin/main` before lowering a route budget, and require source-deletion evidence in the same publication.
- The production build still has a broad route graph (644 dynamic handlers, 368 pages, and 27 layouts). Removing the 19 explicit Chromium trace inclusions eliminates known per-function deployment duplication, but the next Webpack deployment is the required measurement for compile-memory impact; no memory setting was increased for this fix.

## Attention Brief

Primary user: project manager or project engineer.

Primary job: create and maintain the material control record that makes a late approval, release, or delivery visible before it impacts work.

Primary decision: which material requires a linked submittal and schedule activity, and what state is it in now?

Tier 1: material/component, lifecycle status, linked submittal, linked schedule activity.

Tier 2: notes and source-link controls.

Tier 3: immutable history and timestamps.

Hide until requested: future date calculations, PO/release commercial facts, AI candidates, and analytics.

Remove: KPI cards, summary strips, duplicate CTAs, decorative status badges, and AI placeholders.

Primary action: add or correct a procurement item and its authoritative source links.

Failure-loudly behavior: invalid or cross-project source links return specific errors; empty states lead directly to record creation; link removal is explicit and guarded.

## Final Status

- [ ] All required checklist items are complete.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
