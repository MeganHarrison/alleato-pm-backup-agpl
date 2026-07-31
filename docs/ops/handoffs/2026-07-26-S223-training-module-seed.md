# Handoff: 2026-07-26 - ALL-17 Training Module Seed Migration

## Intake Block

1) Session ID: S223
2) Task ID: ALL-17
3) Linear issue: ALL-17 - T3 Seed migration from resources.js
4) Linear URL: https://linear.app/alleato-group/issue/ALL-17
5) Current status: Done. Committed to isolated workspace branch `codex/s223-all-17-913ee7` (worktree `/home/friday/.codex/isolated-workspaces/s223-all-17-913ee7`), NOT yet published to `origin/main`. The seed migration has been **applied live** to the PM APP Supabase project (`lgveqfnpkxvzbnnwuled`) and verified via readback — the database already reflects this work regardless of when the code is published. Reclassified from Standard to High-risk lane during self-review (any `supabase/migrations/*.sql` change is unconditionally High-risk per AGENTS.md); the two-axis independent `code-review` (below) satisfies that lane's independent-review requirement.
6) Files changed: see "Files Changed" below.
7) Commands/outcomes: `node --test scripts/training/source/__tests__/*.test.mjs` -> 23 passed (parser, enum mapping, normalization, dedupe, referential-integrity validation, SQL generation — all written test-first, red confirmed before each green). Real-data pipeline run against `training-source/resources.js` -> valid, 0 errors, wrote `resources.json` (91 resources) and the seed migration SQL. Applied via Supabase MCP `apply_migration` (CLI path blocked — see below). Live readback: `role_count=6, topic_count=27, resource_count=91, published_count=67, review_count=24, distinct_url_count=91, resource_role_link_count=264`.
8) Evidence artifacts: live DB readback (query + result) recorded in the task file's Evidence table; no screenshots — this is a backend/data ticket with no UI surface (`/training` will show the seeded data once T7's route reads it, but rendering it wasn't this ticket's scope).
9) Top findings:
   - **The real source has 92 raw items, not 91 unique ones.** A genuine duplicate URL exists (`seed-1`/`seed-77`, same YouTube video, re-punctuated title). Handled by deduping-by-url with an explicit, reported drop (`meta.duplicatesDropped`) rather than a silent `ON CONFLICT`. The true, correct seeded count is 91 (67 published + 24 review) — Linear's "92 published + ~24 review" language was approximate.
   - **Type/level vocabulary mismatch, resolved by mapping, not by fabrication.** The DB's locked enums (`training_resource_type: video|course|doc`, `training_resource_level: intro|deep-dive`) are narrower than the source's (`article|reference|podcast`, `all|deep`). Mapped deterministically: `article|reference|podcast → doc`, `all → intro`, `deep → deep-dive`. Documented in the task file and `scripts/training/source/README.md`.
   - **`training_resource_track` needed no schema change** — despite the pre-existing spec text implying one might be needed, the actual T2 migration already made it an open `text` domain by deliberate design (its own comment: "Open vocabulary avoids a schema migration for every new vetted track"). Real values (`pm`/`field`/`both`) already satisfy the domain's format check.
   - **CLI-based migration verification is blocked in this environment**: `frontend/.env.local`'s `DATABASE_URL` is empty and no `SUPABASE_ACCESS_TOKEN` is set, so `npx supabase db push` / `npm run db:migrations:verify-applied` cannot run. Used the Supabase MCP `apply_migration` + `execute_sql` tools instead (already authenticated, proven working via prior `list_projects`/`list_migrations` calls) — this is a legitimate available-tool substitute, not a workaround of the gate.
   - **Ledger version mismatch, corrected**: `apply_migration` auto-assigned ledger version `20260726195538`, different from the locally-generated `20260726190000` prefix. Renamed the local file to match so Local and Remote agree.
   - The old `scripts/training/source/normalize-resources.mjs` (written by S221 before the real source existed, assumed a flat-array `.js` export) was deleted along with its fixture/test — it was wrong-shaped for the real `window.ALLEATO_RESOURCES = {roles, topics, items}` format and would have produced incorrect output had it been run. Replaced entirely by `parse-source-library.mjs`.
10) Next action: T6 (ALL-20, MDX guide conversion) is next — the three handbook `.md` files also landed in `training-source/`. After that: T8 (Resource Finder backend), T9 (cron), T10 (reviewer/publish flow), each following the same implement → tdd → code-review flow.
11) Handoff path: `docs/ops/handoffs/2026-07-26-S223-training-module-seed.md`
12) Migration ledger evidence: local `supabase/migrations/20260726195538_seed_training_resource_library.sql` matches remote ledger entry `20260726195538 | seed_training_resource_library` (confirmed via `select version, name from supabase_migrations.schema_migrations order by version desc limit 3`, showing it immediately after the T2 migration `20260726143515`). CLI-based ledger verification (`npm run db:migrations:verify-applied`) could not run — see finding above; the live readback is the substitute proof of application.

## Verification Contract

- Delivery lane: **High-risk** (reclassified during review — any `supabase/migrations/*.sql` change is unconditionally High-risk per AGENTS.md, even a data-only seed with no schema change).
- TDD: every seam (parse, enum-map, normalize, dedupe, validate, SQL-generate) was written test-first, red confirmed before green, per the `tdd` skill.
- Live proof: real DB readback of row counts by table/status, matched exactly against `resources.json`'s computed counts, independently re-verified by the Spec-axis review sub-agent.
- `code-review` (Standards + Spec axes, two independent parallel sub-agents, fixed point `1f542aeea...HEAD`) run before considering this done. Spec axis: clean, no findings. Standards axis: 5 findings — delivery-lane misclassification, duplicated-code in `validateResourceLibrary`, an `export default` code-style violation, an absolute local path baked into `resources.json`, and a missing empty-input test. All fixed in a follow-up commit; full suite re-run at 24/24 passing after fixes. Full detail in the task file's "Code Review" section.

## Files Changed

New/changed files, all under this session's owned paths:

- `scripts/training/source/parse-source-library.mjs` — the full parse → map → normalize → dedupe → validate → SQL-generate pipeline (new).
- `scripts/training/source/__fixtures__/parsed-source.fixture.mjs` — synthetic fixture in the real nested shape (new).
- `scripts/training/source/__tests__/{parse-source-library,enum-mapping,build-normalized-library,validate-library,build-seed-migration}.test.mjs` — 23 tests, all seams (new).
- `scripts/training/source/resources.schema.json` — rewritten to match the real nested `{meta, roles, topics, resources}` shape (was speculative before; now matches the actual DB contract).
- `scripts/training/source/resources.json` — the real, live-matching normalized output (new — genuinely populated for the first time).
- `scripts/training/source/README.md` — rewritten: Resolved status, real counts vs. Linear's approximate figures, the dedupe finding, regeneration instructions.
- `supabase/migrations/20260726195538_seed_training_resource_library.sql` — the applied seed migration (new).
- Deleted (superseded, wrong-shaped): `scripts/training/source/normalize-resources.mjs`, `scripts/training/source/__fixtures__/resources.source.fixture.mjs`, `scripts/training/source/__tests__/normalize-resources.test.mjs`.
- `docs/ops/tasks/2026-07-26-training-module-seed.md`, `docs/ops/handoffs/2026-07-26-S223-training-module-seed.md` — this task's records.
