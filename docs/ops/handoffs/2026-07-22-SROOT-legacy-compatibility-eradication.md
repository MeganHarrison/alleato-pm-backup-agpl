# Legacy compatibility eradication — batch two handoff

Status: Pending Review
Task: LEGACY-COMPATIBILITY-ERADICATION
Owner: Codex SROOT-LEGACY-COMPAT-R2-0722

1) Session ID: SROOT-LEGACY-COMPAT-R2-0722
2) Task ID: LEGACY-COMPATIBILITY-ERADICATION
3) Linear issue: Unavailable (no Linear connector is configured in this session)
4) Linear URL: Unavailable (no Linear connector is configured in this session)
5) Current status: In Progress — published migration batch; task remains open.
6) Files changed (absolute paths): /Users/meganharrison/.codex/isolated-workspaces/sroot-legacy-compat-r2-0722-legacy-compatibility-eradication-5e507c/supabase/migrations/20260722133000_canonicalize_drawing_annotation_storage.sql and the drawing/budget-code files listed below.
7) Commands run and outcome (pass/fail counts): Pass: migration apply, ledger repair, ledger verification, postflight, route check; partial: 27 focused assertions passed and 5 suites blocked by repository Jest/date-fns ESM transform configuration.
8) Evidence artifacts (screenshot/video/report/log paths): Supabase remote migration ledger for 20260722133000; /tmp/drawing_annotation_preflight.sql; /tmp/drawing_annotation_postflight.sql.
9) Recommended next action (one line): Continue controlled runtime archive/stale-tool migration, then resolve the independent Jest and database-inventory configuration blockers before task closeout.
10) Handoff file path: docs/ops/handoffs/2026-07-22-SROOT-legacy-compatibility-eradication.md
11) Migration ledger evidence: `npm run db:migrations:verify-applied -- supabase/migrations/20260722133000_canonicalize_drawing_annotation_storage.sql` passed after linked remote ledger repair.

## Scope

- Replace the misleading `legacyCostCodeId` alias with the canonical `costCodeId` contract.
- Remove the retired dual drawing-markup storage contract after a live preflight.

## Evidence

- `20260722133000_canonicalize_drawing_annotation_storage.sql` was applied directly to the linked production database and marked applied in the remote migration ledger.
- Preflight: 30 rows; zero null, noncanonical, XFDF, or external-payload rows.
- Postflight: 30 rows; zero null or noncanonical payloads.
- `npm run check:routes`: pass.
- One focused batch was run: 27 budget/contract assertions passed. Five drawing suites were blocked before execution by the repository Jest/date-fns ESM transform configuration (`Unexpected token 'export'` from `date-fns/index.js`), not by an assertion failure.

## Changed Files

- `supabase/migrations/20260722133000_canonicalize_drawing_annotation_storage.sql`
- Canonical drawing annotation API/types/store/overlay/viewer/workspace and fixtures.
- Budget-code API and its frontend callers/tests.

## Remaining Risk and Next Step

The database-inventory generator fails loudly on four unrelated missing schedule table definitions in `docs/architecture/tables.yaml`, so its generated output has not been hand-edited. Continue with the remaining stale-tool and archive-runtime migration, then resolve the independent inventory/Jest configuration debt before marking the full task complete.

## Current Status

- The migration and canonical caller contracts are published to `origin/main`.
- The task is still in progress; no completion screenshot is claimed or required at this checkpoint.

## Known Pitfalls

- Do not regenerate or hand-edit the database inventory until its unrelated schedule-table schema drift is resolved.
- Do not treat the focused Jest transform failure as a source assertion failure.

## Linear Updates

Kickoff comment: Unavailable — no Linear connector is configured in this session.
