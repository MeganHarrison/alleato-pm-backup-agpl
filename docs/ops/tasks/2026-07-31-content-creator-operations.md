# Task: Content Creator Operations

Status: Complete
Owner: Codex SCONTENT0731
Created: 2026-07-31
Task ID: AAI-1303
Linear Issue: [AAI-1303](https://linear.app/megankharrison/issue/AAI-1303/add-creator-operations-and-engagement-to-content-studio)
Related Handoff: `docs/ops/handoffs/2026-07-31-SCONTENT0731-content-creator-operations.md`

## Objective

Make Content Studio a truthful creator operations surface where authors can
see catalog distribution, isolate governance work, update multiple records,
and understand real tracked learner engagement without leaving `/content`.

## Scope

- Add secure aggregate engagement and bulk governance database contracts.
- Add catalog tab counts, governance and engagement columns, creator filters,
  saved views, and shared bulk editing to the canonical unified table.
- Simplify the create-content menu to the compact shared dropdown pattern.
- Excludes a new analytics dashboard, generic document page-view tracking,
  and a second content editor.

## Source of Truth

- Canonical runtime/data owner: `knowledge_content_item` plus existing learning
  progress, enrollment, and course-item tables.
- Existing shared primitives/services:
  `frontend/src/components/tables/unified/unified-table-page.tsx`,
  `frontend/src/lib/learning/`, and `/content`.
- Deprecated or parallel paths: no new parallel catalog or dashboard.

Delivery lane: High-risk

Verification contract: Required

## Acceptance Criteria

- [x] Every content destination tab shows its catalog count.
- [x] Creators can filter to governance attention, their content, lifecycle,
      and engagement state.
- [x] The table shows review state and real tracked engagement, including an
      explicit `Not tracked` state instead of false zeroes.
- [x] Shared row selection and bulk editing update display area, owner,
      reviewer, and next review date through one admin-only RPC.
- [x] Saved views and column controls reuse the canonical table owner.
- [x] Database functions fail loudly for anonymous, unauthorized, invalid,
      missing, or oversized mutation requests.
- [x] Desktop and mobile authenticated screenshots prove the creator layout.

## Implementation Checklist

- [x] Files/modules to change are listed before edits.
- [x] Shared abstraction owns cross-cutting behavior.
- [x] Errors are specific and actionable.
- [x] Database, authentication, permission, and delivery contracts are handled.

Task-owned paths:

- `docs/ops/tasks/2026-07-31-content-creator-operations.md`
- `docs/ops/handoffs/2026-07-31-SCONTENT0731-content-creator-operations.md`
- `docs/ops/evidence/2026-07-31-content-creator-operations/`
- `supabase/migrations/20260731180000_add_content_creator_operations.sql`
- `supabase/migrations/20260731210000_align_content_creator_operations.sql`
- `frontend/src/types/database.types.ts`
- `frontend/src/components/dev-tools/page-schema-fk.generated.ts`
- `frontend/src/lib/learning/{types,data-access,server}.ts`
- `frontend/src/app/(main)/content/{page,actions}.tsx`
- `frontend/src/features/content-studio/content-catalog-table.tsx`
- `frontend/src/features/content-studio/content-catalog-operations.ts`
- `frontend/src/features/content-studio/content-create-menu.tsx`
- `frontend/src/features/content-studio/__tests__/content-catalog-table.test.ts`

## Integration and Verification

- [x] Focused catalog tests pass.
- [x] Refreshed Supabase types match the applied remote schema.
- [x] Remote migration ledger and SQL readback prove the new functions.
- [x] Anonymous and invalid bulk mutation probes fail with actionable errors.
- [x] Authenticated creator flow proves filters, selection, and bulk dialog.
- [x] Desktop and 390px screenshots are recorded.
- [x] Independent high-risk review passes after four corrections.
- [x] Task-owned files are published to `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: server action and database errors name the rejected field,
  value, permission, missing catalog row, or tracking state.
- Detection path: focused tests, remote SQL/function readback, negative probes,
  and the visible `Not tracked`/empty engagement states.
- Recovery path: correct the selected value or permissions and retry the same
  bulk operation; no partial catalog update is committed.

## Incident Learning

- Failure fingerprint: N/A
- Root cause: the first migration used the broader learning-admin predicate,
  review dates were treated as instants, and labels lacked durable formatting.
- Detection gap: initial tests inspected source strings instead of behavior.
- Prevention: executable date/engagement/manager tests plus live function-definition,
  permission, negative-mutation, and migration-ledger readback.
- Guardrail evidence: 7 focused tests and `database-readback.mjs` pass.

## Evidence

| Check       | Command / artifact | Result      | Notes                                                     |
| ----------- | ------------------ | ----------- | --------------------------------------------------------- |
| Focused tests | Jest content catalog test | Pass | 7 tests cover tabs, bulk wiring, dates, engagement, and managers. |
| Changed lint | ESLint on task paths | Pass | 0 errors; one known thin-page shell heuristic warning. |
| Schema gate | `npm run db:types:check` | Pass | Generated types match the linked schema. |
| Database | `database-readback.mjs` | Pass | Both ledgers present; auth, grants, negative SQL states, and date normalization verified. |
| Browser | `browser-proof.json` and PNGs | Pass | Final authenticated desktop, bulk dialog, and 390px layout; no page errors. One unrelated desktop console 500 remains unlocalized and is recorded as residual risk. |
| Typecheck | no-timeout repo check | Scoped pass | No diagnostics in task paths; unrelated repository-wide debt remains. |
| Review | Independent high-risk review | Pass with low residual risk | Four findings resolved; action/RPC wiring remains integration-tested rather than unit-mocked. |

## Remaining Risk

- Generic SOP and documentation page views are not instrumented yet. The table
  must label those items `Not tracked` until a reusable content-view event is
  added at the reader boundary.
- The final route renders 200 and remains usable, but the browser proof records
  one unlocalized desktop console 500. Independent review did not block this
  slice because the content route, table, and bulk dialog all passed.

## Final Status

- [x] All implementation and verification checklist items are complete.
- [x] Evidence is filled in.
- [x] Incident learning is recorded.
- [x] Deferred generic reader instrumentation is explicitly recorded above.
