# Training Resource Source — Recovery Status

Status: **Resolved** (2026-07-26, session S223 / ALL-17). The real source
landed on disk at `training-source/resources.js` (repo root, not committed —
see `.gitignore`). This directory's tooling has parsed, deduped, validated,
and seeded it into `training_role` / `training_topic` / `training_resource` /
`training_resource_role`.

## Real counts vs. the figures quoted in Linear

Linear's ALL-17 quoted "92 published + ~24 review" from memory. The actual
source file has:

- **92 raw items**: 68 `published`, 24 `review`
- **One genuine duplicate URL** (`seed-1` / `seed-77` — the same YouTube video
  re-added with re-punctuated title: "Reading Drawings — 10-Min Crash Course"
  vs "Reading Drawings: 10-Min Crash Course")
- **91 unique resources after dedupe**: 67 published, 24 review — this is
  what's actually seeded (`training_resource.url` is unique, so keeping both
  would either violate the constraint or require ON CONFLICT to silently
  drop one — instead `buildNormalizedLibrary` dedupes explicitly and reports
  the drop in `meta.duplicatesDropped`)
- 27 topics, 6 roles — both match Linear exactly

Live DB readback after applying `supabase/migrations/20260726195538_seed_training_resource_library.sql`
(project `lgveqfnpkxvzbnnwuled`): `role_count=6, topic_count=27,
resource_count=91, published_count=67, review_count=24,
distinct_url_count=91, resource_role_link_count=264`.

## Pipeline

- `parse-source-library.mjs` — the whole pipeline:
  - `extractWindowAssignedObject` — pulls the JSON object literal out of
    `window.ALLEATO_RESOURCES = {...};` (a browser-global assignment, not an
    ES module — real construction training content, not a template)
  - `mapResourceType` / `mapResourceLevel` — the DB's locked enums
    (`training_resource_type: video|course|doc`,
    `training_resource_level: intro|deep-dive`) don't match the source's
    richer vocabulary (`article|reference|podcast`, `all|deep`). Mapped:
    `article|reference|podcast → doc`, `all → intro`, `deep → deep-dive`.
    `training_resource_track` needed no mapping — it's an open `text` domain
    by deliberate design (see the T2 migration's own comment), and the real
    values (`pm`/`field`/`both`) already satisfy its format check.
  - `buildNormalizedLibrary` — combines the above, dedupes by URL (keep
    first, report drops), produces the shape in `resources.schema.json`
  - `validateResourceLibrary` — URL uniqueness, count checks, and
    referential integrity (every resource's `topicSlug`/`roleSlugs` must
    reference a real topic/role)
  - `buildSeedMigrationSql` — emits the idempotent seed migration
    (`jsonb_to_recordset` over embedded JSON, `on conflict ... do nothing`
    on every insert)
- `__fixtures__/parsed-source.fixture.mjs` — a small synthetic fixture in the
  *real* `{roles, topics, items}` shape, used only for the unit tests below.
  Not real business data.
- `__tests__/*.test.mjs` — `node --test` coverage for every seam above,
  written test-first (red confirmed before each implementation).

## Regenerating resources.json / the seed migration

```bash
node -e '
import("./scripts/training/source/parse-source-library.mjs").then(async (mod) => {
  const fs = await import("node:fs");
  const text = fs.readFileSync("training-source/resources.js", "utf8");
  const parsed = mod.extractWindowAssignedObject(text, "ALLEATO_RESOURCES");
  const library = mod.buildNormalizedLibrary(parsed, { sourceFile: "training-source/resources.js" });
  library.meta.generatedAt = new Date().toISOString();
  const result = mod.validateResourceLibrary(library, { expectedCounts: { total: 91, published: 67, review: 24, roles: 6, topics: 27 } });
  if (!result.valid) throw new Error(result.errors.join("; "));
  fs.writeFileSync("scripts/training/source/resources.json", JSON.stringify(library, null, 2) + "\n");
  fs.writeFileSync("supabase/migrations/<new-timestamp>_reseed.sql", mod.buildSeedMigrationSql(library));
});
'
```

`resources.json` and the applied migration are both idempotent (keyed on
url/slug), so re-running against an unchanged source is a no-op.
