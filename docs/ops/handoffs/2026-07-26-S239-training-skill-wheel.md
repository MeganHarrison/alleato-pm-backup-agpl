# S239/S240 Handoff: ALL-28 Persisted Skill Wheel

Status: In Progress
Delivery lane: High-risk

## Ownership

- Skill Wheel migration, generated Supabase types, `/training/growth`,
  training feature components, focused tests, task/evidence files.
- S240 owns the additive database trigger that rejects malformed, stale,
  incomplete, or non-canonical score snapshots at the write boundary.

## Acceptance Contract

See `docs/ops/tasks/2026-07-26-training-skill-wheel.md`.

## Work Summary

- Regenerated the live public-schema Supabase types before database work and confirmed `training_role.id` is UUID.
- Added canonical role/core skill definitions, per-user dated check-ins, own-user RLS, unique user/role/date upserts, and exact seed assertions.
- Added `/training/growth`, shared training navigation/hub entry, live current/target wheel, importance × gap focus ranking, 30/60/90 cadence, history, and canonical API/date-field integrations.
- Added explicit recovery for expired auth, future dates, stale skill libraries, invalid snapshots, database failures, and missing server readback.
- Local process startup exposed three empty Vercel Supabase production variables; repaired each individually from the governed Supabase project and marked them sensitive.

## Verification

- Focused Jest: 7 suites / 18 tests passed.
- Focused ESLint: 0 errors / 0 warnings.
- Route conflict check, Impeccable complexity audit, and `git diff --check`: passed.
- Local Next server reached Ready on port 3319; unauthenticated route redirect boundary returned 307.
- Full TypeScript check completed with 8 GB heap and failed on unrelated repository debt only; no task-owned Skill Wheel path appeared in diagnostics.

## Migration Ledger Evidence

- Exact linked-ledger verification passed for version `20260726232000`.
- Live readback confirmed RLS on both tables, eight expected policies, five core skills, and 48 role skills across six roles.
- First migration attempt rolled back atomically because PostgreSQL rejects a subquery in a column default; the durable migration uses `default auth.uid()` and was then applied successfully.
- Additive migration `20260727002000` installs the canonical snapshot validation trigger; exact ledger verification and post-apply canonical/malformed direct-write probes passed.

## Independent Review

Approved after rework: no remaining P0–P2 findings. Initial review caught and drove fixes for the auth redirect, per-role restoration truncation, and direct-write self-corruption path.

## Remaining Risk

- Reviewer P3: the database trigger uses session `current_date` while the app uses Alleato Eastern business date. The app path is consistent and covered; only direct PostgREST writes around rollover could differ.
- Remaining release proof: production deployment, authenticated save/reload DB readback, and desktop/mobile screenshots.
- Existing repository-wide TypeScript debt remains outside ALL-28 ownership.
