import assert from "node:assert/strict";
import test from "node:test";

import { buildNormalizedLibrary, validateResourceLibrary } from "../parse-source-library.mjs";
import { parsedSourceFixture as fixture } from "../__fixtures__/parsed-source.fixture.mjs";

test("validateResourceLibrary passes on a clean normalized fixture with matching expected counts", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const result = validateResourceLibrary(library, { expectedCounts: { total: 3, published: 2, review: 1, roles: 2, topics: 2 } });
  assert.equal(result.valid, true);
  assert.deepEqual(result.errors, []);
});

test("validateResourceLibrary flags a duplicate url", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const duplicated = { ...library, resources: [...library.resources, { ...library.resources[0] }] };
  const result = validateResourceLibrary(duplicated);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /duplicate url/i.test(error)));
});

test("validateResourceLibrary flags a resource referencing a topic slug that doesn't exist", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const broken = { ...library, resources: [{ ...library.resources[0], topicSlug: "no-such-topic" }, ...library.resources.slice(1)] };
  const result = validateResourceLibrary(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /no-such-topic/.test(error)));
});

test("validateResourceLibrary flags a resource referencing a role slug that doesn't exist", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const broken = {
    ...library,
    resources: [{ ...library.resources[0], roleSlugs: ["no-such-role"] }, ...library.resources.slice(1)],
  };
  const result = validateResourceLibrary(broken);
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /no-such-role/.test(error)));
});

test("validateResourceLibrary flags a count mismatch against expectedCounts", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const result = validateResourceLibrary(library, { expectedCounts: { published: 92, review: 24 } });
  assert.equal(result.valid, false);
  assert.ok(result.errors.some((error) => /published/.test(error)));
  assert.ok(result.errors.some((error) => /review/.test(error)));
});
