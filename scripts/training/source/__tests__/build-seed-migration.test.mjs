import assert from "node:assert/strict";
import test from "node:test";

import { buildNormalizedLibrary, buildSeedMigrationSql } from "../parse-source-library.mjs";
import { parsedSourceFixture as fixture } from "../__fixtures__/parsed-source.fixture.mjs";

test("buildSeedMigrationSql produces a single transaction with four idempotent insert statements", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const sql = buildSeedMigrationSql(library);

  assert.ok(sql.includes("\nbegin;\n"), "expected a leading transaction start (after the descriptive header comment)");
  assert.match(sql, /commit;\s*$/);
  assert.match(sql, /insert into public\.training_role[\s\S]*on conflict \(slug\) do nothing/);
  assert.match(sql, /insert into public\.training_topic[\s\S]*on conflict \(slug\) do nothing/);
  assert.match(sql, /insert into public\.training_resource\s*\([\s\S]*on conflict \(url\) do nothing/);
  assert.match(sql, /insert into public\.training_resource_role[\s\S]*on conflict \(resource_id, role_id\) do nothing/);
});

test("buildSeedMigrationSql embeds every role/topic slug and casts the locked enum columns", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const sql = buildSeedMigrationSql(library);

  assert.ok(sql.includes('"slug":"project-manager"'));
  assert.ok(sql.includes('"slug":"superintendent"'));
  assert.ok(sql.includes('"slug":"reading-reviewing-drawings"'));
  assert.ok(sql.includes('"slug":"safety-management"'));
  assert.match(sql, /resource_type::public\.training_resource_type/);
  assert.match(sql, /level::public\.training_resource_level/);
  assert.match(sql, /status::public\.training_resource_status/);
});

test("buildSeedMigrationSql embeds the resolved (already-mapped) type/level for each resource, not the raw source value", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const sql = buildSeedMigrationSql(library);

  // The article-type, deep-level fixture item must appear as doc/deep-dive, never as article/deep.
  assert.ok(sql.includes('"resource_type":"doc"'));
  assert.ok(sql.includes('"level":"deep-dive"'));
  assert.ok(!sql.includes('"resource_type":"article"'));
  assert.ok(!sql.includes('"level":"deep"'));
});

test("buildSeedMigrationSql rejects building from an invalid library instead of emitting broken SQL", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const broken = { ...library, resources: [...library.resources, { ...library.resources[0] }] }; // duplicate url
  assert.throws(() => buildSeedMigrationSql(broken), /duplicate url/i);
});
