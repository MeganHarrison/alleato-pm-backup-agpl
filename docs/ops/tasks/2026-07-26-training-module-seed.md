# Task: T3 — Seed migration from resources.js (ALL-17)

Status: Done
Owner: Session S223
Created: 2026-07-26
Task ID: ALL-17
Linear Issue: ALL-17 (https://linear.app/alleato-group/issue/ALL-17)
Related Handoff: `docs/ops/handoffs/2026-07-26-S223-training-module-seed.md`

## Objective

Import the recovered `training-source/resources.js` (92 items: 68 published +
24 review, 27 topics, 6 roles) into `training_role` / `training_topic` /
`training_resource` / `training_resource_role`, matching the locked schema
from `supabase/migrations/20260726143515_create_training_resource_library.sql`.
Idempotent, keyed on URL.

## Spec section this implements

`specs/training-module-spec.md` → "Data Contract" (table shapes, closed enums)
and the ALL-17 Linear description. Two real-data facts the spec didn't (and
couldn't) anticipate, discovered by reading the actual source file:

1. **`type` mismatch.** DB enum `training_resource_type` is locked to
   `video | course | doc`. Real source has 6 raw values:
   `video`(17), `course`(2), `doc`(1), `article`(68), `reference`(3),
   `podcast`(1). Decision: map `article|reference|podcast → doc` (all are
   non-video, non-course written/audio content). Recorded here, not silent.
2. **`level` mismatch.** DB enum `training_resource_level` is locked to
   `intro | deep-dive`. Real source has `all`(77), `deep`(15). Decision:
   `all → intro`, `deep → deep-dive`.
3. **`track` — no mismatch.** The DB column is an open `text` domain (not a
   closed enum) by deliberate design (see the migration's own comment:
   "Open vocabulary avoids a schema migration for every new vetted track").
   Real values `pm`/`field`/`both` already satisfy the domain's format check.
   No schema change needed for T3.

## Seams under test (tdd)

1. `extractWindowAssignedObject(sourceText, globalName)` — pulls the JSON
   object literal out of `window.ALLEATO_RESOURCES = {...};` via balanced-brace
   extraction, `JSON.parse`s it. Pure function.
2. `mapResourceType(raw)` / `mapResourceLevel(raw)` — the two enum mappings
   above. Pure functions; throw on truly unrecognized input (fail loud, not
   silent-default).
3. `buildNormalizedLibrary(parsedSource)` — combines 1+2 plus slug/url/status/
   track/provider/description passthrough into the shape
   `{ meta, roles, topics, resources }` matching `resources.schema.json`.
4. `validateResourceLibrary(library, { expectedCounts })` — already existed
   from S221; extended to also check every `resource.topicId`/`resource.roles`
   reference a real topic/role (referential integrity), not just URL
   uniqueness + counts.
5. `buildSeedMigrationSql(library, { timestamp })` — emits the final `.sql`
   migration text: idempotent `insert ... on conflict (slug|url) do nothing`
   for roles/topics/resources/resource_role, using `jsonb_array_elements` over
   an embedded JSON literal rather than 125 hand-written INSERT statements.

Seam 6 (not unit-tested — infra/integration): apply the generated migration to
the live Supabase project and read back row counts.

## Implementation Checklist

- [x] Seam 1: red test → green implementation
- [x] Seam 2: red test → green implementation
- [x] Seam 3: red test → green implementation
- [x] Seam 4: red test → green implementation
- [x] Seam 5: red test → green implementation
- [x] Run the full pipeline against the real `training-source/resources.js`;
      produce `scripts/training/source/resources.json`
- [x] Generate `supabase/migrations/20260726195538_seed_training_resource_library.sql`
- [x] Apply the migration (Supabase MCP `apply_migration`); verify via live
      readback. **One real-data surprise found and handled**: the raw source
      has 92 items but one is a genuine duplicate URL (`seed-1` /
      `seed-77`, same YouTube video, re-punctuated title) — added a seam
      (dedupe-by-url, keep first, report every drop in
      `meta.duplicatesDropped`) rather than let `ON CONFLICT` silently eat it.
      True unique count is **91** (67 published + 24 review), confirmed live:
      `role_count=6, topic_count=27, resource_count=91, published_count=67,
      review_count=24, distinct_url_count=91, resource_role_link_count=264`.
- [x] `code-review` self-review (Standards + Spec axes) before calling this done

Delivery lane: High-risk

Verification contract: Required

## Delivery Lane Note

**Reclassified from Standard during self-review.** AGENTS.md's "Delivery
Lanes and Evidence" table puts any schema/migration change in the High-risk
row unconditionally, and gate 1A explicitly triggers on any
`supabase/migrations/*.sql` file — this ticket is a data migration, not a
schema change, but the gate does not carve out that distinction, so it
applies. High-risk requires: task + explicit acceptance contract (the seams
list above), focused regression tests (23 `node --test` cases, all
seam-scoped), end-to-end proof (live DB readback), and independent review.
The independent review requirement is satisfied by the two-axis `code-review`
run below — a genuinely separate pair of sub-agents that re-ran the test
suite and the live DB query themselves rather than trusting this session's
claims.

## Migration Ledger Evidence

- Local file: `supabase/migrations/20260726195538_seed_training_resource_library.sql`.
- Applied via Supabase MCP `apply_migration` (project `lgveqfnpkxvzbnnwuled`, PM APP)
  since the CLI path was blocked: `frontend/.env.local`'s `DATABASE_URL` is empty
  and no `SUPABASE_ACCESS_TOKEN` is set in this environment (`npx supabase db
  push --dry-run` failed with "Access token not provided"). The MCP tool
  auto-assigned ledger version `20260726195538` (not my locally-generated
  `20260726190000` prefix) — renamed the local file to match so Local and
  Remote agree, per CLAUDE.md's migration gate.
- Remote ledger readback: `select version, name from
  supabase_migrations.schema_migrations order by version desc limit 3` shows
  `20260726195538 | seed_training_resource_library` immediately after
  `20260726143515 | create_training_resource_library` (the T2 schema
  migration) — confirms correct ordering and application.
- `npm run db:migrations:verify-applied` (the repo's standard CLI-based check)
  was not run — it shells out to the Supabase CLI, which is blocked by the
  same missing access token. The live readback below is the substitute proof.

## Evidence

| Check | Command / artifact | Result | Notes |
| --- | --- | --- | --- |
| Seam unit tests | `node --test scripts/training/source/__tests__/*.test.mjs` | 23 passed | Parser, enum mapping, normalization, dedupe, validation, SQL generation — all red→green. |
| Real-data pipeline run | ad-hoc Node script invoking `parse-source-library.mjs` against `training-source/resources.js` | `valid: true`, 0 errors | Produced `scripts/training/source/resources.json` (91 resources) and the seed migration SQL. |
| Live DB readback | `select count(*) ... from public.training_role/training_topic/training_resource/training_resource_role` | `role_count=6, topic_count=27, resource_count=91, published_count=67, review_count=24, distinct_url_count=91, resource_role_link_count=264` | Matches `resources.json`'s `meta.counts` exactly. Proves the T3 acceptance criterion ("row counts vs resources.js") against the real corrected (deduped) figures, not the raw 92. |
| Migration ledger | `select version, name from supabase_migrations.schema_migrations ...` | `20260726195538 \| seed_training_resource_library` present, correctly ordered after T2 | CLI-based `db:migrations:verify-applied` blocked (see above); this readback is the substitute. |

## Code Review (Standards + Spec, two independent sub-agents)

Fixed point: `1f542aeea` (tip before this session's commit) → `HEAD` (`7296c9189`).

**Spec axis: clean.** The reviewer independently re-ran `node --test
scripts/training/source/__tests__/*.test.mjs` (23/23 passed) and re-ran the
live Supabase query itself, getting the same counts claimed above. Confirmed:
idempotency (`ON CONFLICT` on every insert), enum mappings match the T2
migration's actual enum definitions, dedupe-by-URL is a real tested seam (not
a post-hoc rationalization), and the diff's scope is limited to the seed
pipeline (no creep). No findings.

**Standards axis: 5 findings, all fixed except one accepted-as-is:**

1. **Delivery-lane misclassification** (was Standard, should be High-risk per
   AGENTS.md's migration gate) — fixed, see "Delivery lane" above.
2. **Duplicated Code**: `validateResourceLibrary`'s `actualCounts` re-derived
   the same shape `countByStatus()` already computes — fixed, now reuses it.
3. **Code-style violation**: the fixture used `export default` instead of a
   named export (`.claude/rules/shared/code-style.md`: "Prefer named exports
   over default exports") — fixed (`parsedSourceFixture` named export; three
   test files updated).
4. **Reproducibility issue**: `resources.json`'s `meta.sourceFile` baked in
   this session's local absolute path — fixed, regenerated with the
   repo-relative `training-source/resources.js`.
5. **Test-coverage gap**: no empty-input test — added one
   (`buildNormalizedLibrary` with empty roles/topics/items); passed
   immediately (the `.map`/`.filter`-based implementation already handled it
   correctly), kept as a regression guard.

All fixes verified: `node --test scripts/training/source/__tests__/*.test.mjs`
→ 24/24 passed after the fixes (23 original + 1 new empty-input test).
