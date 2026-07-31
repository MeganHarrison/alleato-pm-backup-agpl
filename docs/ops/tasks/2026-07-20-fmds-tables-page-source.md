# Task: Source FM Global Tables Page from Dedicated ASRS Corpus

Status: Blocked/Deferred
Owner: Codex S197
Created: 2026-07-20
Task ID: AAI-1199
Linear Issue: [AAI-1199](https://linear.app/megankharrison/issue/AAI-1199/source-fm-global-tables-page-from-dedicated-asrs-corpus)
Related Handoff: `docs/ops/handoffs/2026-07-20-S197-fmds-tables-page-source.md`

## Objective

Make `/fm-global/fm_global_tables` render the updated FM Global code PDF table corpus from `fmds_tables` in the dedicated ASRS Supabase project.

## Scope

- Read-only data adapter, types, and table configuration for the authenticated FM Global tables directory and dashboard table tab.
- Explicit exclusion: public intake matching, corpus ingestion, and any ASRS schema migration.

## Source of Truth

- Canonical runtime/data owner: ASRS Supabase project `vqnnvpnoitqhijkztyhq`, `public.fmds_tables`.
- Existing shared primitives/services: `frontend/src/app/(main)/fm-global/fm_global_tables/page.tsx`, shared generic table factory, `frontend/src/lib/supabase/service.ts`.
- Deprecated or parallel paths: PM APP `fm_global_tables` for this page only; it remains in use by other flows until separately migrated.

Verification contract: Required

## Acceptance Criteria

- [ ] The tables directory and dashboard table tab read data only from the dedicated ASRS `fmds_tables` corpus.
- [ ] The page offers schema-appropriate search, filtering, sorting, and export.
- [ ] Missing credentials, query failures, and empty active corpus states surface a specific actionable failure.
- [ ] Targeted checks and an authenticated canonical-route browser artifact are recorded.

## Implementation Checklist

- [x] Inspect live ASRS table schema and corpus/revision status.
- [x] Add one server-only ASRS FMDS data adapter and tests.
- [x] Replace the page-local PM APP query/config with the adapter result.
- [x] Add a regression guard against returning to `fm_global_tables` on this route.
- [x] Replace the dashboard table tab's PM APP query/config with the same ASRS FMDS adapter.
- [ ] Capture desktop and mobile route evidence and post it to Linear.

## Integration and Verification

- [ ] Targeted static or unit checks pass.
- [ ] Live ASRS readback proves the selected corpus is available.
- [ ] Authenticated user-flow proof and screenshot are recorded.
- [ ] Evidence artifacts are recorded.
- [ ] Task-owned files are published and local `HEAD` equals `origin/main`.

## Failure-Loudly Contract

- Cause surfaced as: named ASRS configuration/query failure, or explicit empty-published-corpus state.
- Detection path: adapter error boundary, focused test, and live readback query.
- Recovery path: configure the ASRS server credential or publish/import the FMDS revision; do not fall back to stale PM APP data.

## Incident Learning

- Failure fingerprint: `N/A`
- Root cause: N/A
- Detection gap: N/A
- Prevention: Route-level source guard and explicit empty-corpus state.
- Guardrail evidence: Focused adapter/page test.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Task setup | This task file and AAI-1199 | Pass | Scope captured before implementation. |
| ASRS schema inspection | Service-role readback | Pass | `fmds_tables` has 58 rows for `FMDS0834` / `2026-04`; the 122-page PDF revision is currently `staging`, so the UI labels that state explicitly. |
| Focused tests | `pnpm --dir frontend exec jest src/lib/fmds/__tests__/fmds-tables.test.ts src/lib/fmds/__tests__/fmds-tables.server.test.ts --runInBand` | Pass | 4/4 tests: ASRS-only relations, revision filter, missing-secret failure, and FMDS config guard. |
| Targeted lint | `pnpm --dir frontend exec eslint` on page, adapter, and focused tests | Pass | No findings. |
| Vercel environment | `npx vercel env ls --scope the-alleato-group` | Pass | Added encrypted Production `SUPABASE_ASRS_URL` and `SUPABASE_ASRS_SECRET_KEY`; values were sourced locally and not logged. |
| Publish attempt | `npm run codex:finish -- --message "Source FM Global tables from ASRS corpus" --files <task-owned paths>` | Blocked | Current checkout is on `codex/accounting-dashboard-dark-style`, not `main`; the finish gate correctly refused to stage or commit. |

## Remaining Risk

- Publication and screenshot proof are blocked by the shared checkout being on the unrelated `codex/accounting-dashboard-dark-style` branch. Cause: concurrent sessions own the current branch/worktree; detection gap: task started before verifying branch ownership; prevention: verify `git branch --show-current` and worktree ownership before implementation. Owner: Codex S197; next action: transfer the scoped patch to an available `main` worktree, publish, then capture authenticated desktop/mobile production screenshots.

## Final Status

- [ ] All required checklist items are complete. Blocked: publication and canonical-route screenshot remain outstanding.
- [ ] Evidence is filled in.
- [ ] Incident learning is linked or explicitly N/A.
- [ ] Any deferred work has cause, detection gap, prevention step, owner, and next action.
