# ALL-5 Schedule Resources and Assignments Evidence

Status: Complete - Pushed
Session: S217
Date: 2026-07-22

## Verified product behavior

- A schedule manager can replace a persisted task's complete assignment set atomically with multiple active project-directory people and whole-number allocation percentages.
- Assignment changes are saved separately and do not move planned or forecast task dates or dual-write legacy assignee fields.
- The collapsed canonical resource-load panel uses the saved project calendar, forecast-date precedence, fixed 100-percent person capacity, and deterministic daily aggregation.
- The authenticated E2E showed one person at 150 percent for three working days, surfaced 50 percent overallocation, edited an assignment through the task modal, and verified both test tasks kept their original dates.
- A schedule revision captured the live resource and assignment facts with count equality. Service-role mutation attempts returned PostgreSQL `42501`; the E2E then cleared assignments and removed its tasks, revision, and newly materialized resources.

## Database evidence

- Migration: `supabase/migrations/20260722121917_schedule_resources_and_assignments.sql`.
- Linked ledger: `20260722121917` is applied.
- `readback.sql` and `linked-readback-output.md`: four new tables have RLS; exact policy predicates and grants are present; authenticated receives SELECT only; service role receives live-table DML but snapshot SELECT only; RPC owner/ACL/fixed-search-path facts, 22 constraints, 13 live-table indexes, and four immutability triggers are persisted.
- `mutation-probes.sql` and `linked-mutation-probes-output.md`: linked execution exited 0. Rollback-only probes rejected authenticated direct DML, a non-manager assignment RPC, an actual task outside project 67, an actual inactive person, an actual inactive membership, and owner-level snapshot update/truncate attempts.
- Existing revisions retain `resource_context_provenance = not_available`; new revisions record `captured`. Historical allocations are never reconstructed.

## Automated verification

- New Phase 4A unit/integration coverage: eight suites, 33 tests passed, including deterministic resource and task-hierarchy pagination beyond 500 rows and bounded people-ID chunks.
- Existing task-modal regression coverage: five suites, 11 tests passed.
- Hardened engine/editor/panel subset after review fixes: three suites, 15 tests passed.
- Final authenticated Playwright E2E: one test passed in 3.3 minutes against a clean cold-started `http://127.0.0.1:3217/67/schedule` and the linked Supabase project.
- Exact linked-schema type generation and the no-manual-table-overrides guard both pass.
- The current checkout cannot resolve the pre-existing `eslint-plugin-react-hooks` package for a fresh targeted ESLint run; the independent review's prior lint evidence remains recorded.
- Targeted ESLint exits 0. A final full-repo TypeScript attempt emitted no diagnostics before its bounded 15-minute termination at about 4.5 GB working memory.
- Route build contracts pass. Direct Next production builds at 7 GB and 12 GB were resource-limited during compile and emitted no task-owned source/TypeScript diagnostic.
- Independent React/UI, TypeScript/JavaScript, final code, and database reviews: APPROVE after all findings were repaired. The database reviewer independently reran the exact schema gates, service/API tests, linked readback, and rollback probes.

## Screenshots

- `schedule-resource-load-desktop.png`: authenticated canonical desktop route showing 150-percent allocation and 50-percent overallocation on all three selected working days.
- `schedule-resource-load-mobile.png`: authenticated 390-by-844 layout showing the same resource table in its horizontal-scroll container.
- `schedule-task-assignments-desktop.png`: canonical task modal scrolled to the independently saved assignment editor with two people and explicit percentages.

## Known unrelated repository state

- The full repository TypeScript check is not globally green; the remaining diagnostics predate ALL-5, including `frontend/src/components/scheduling/schedule-lookahead.tsx`.
- Exact type regeneration proved legacy `submittal_documents` and submittal AI-review cache fields are absent; their stale runtime compatibility calls were removed and the current review-run tables remain authoritative.
- Snapshot capture extends the existing global `SHARE`-lock pattern across shared schedule tables; a project-scoped consistency strategy remains operational follow-up before high-concurrency usage.
- Browser console noise from missing local Velt/Agentation development configuration is unrelated to scheduling; no ALL-5-owned console error appeared in the verified flow.
