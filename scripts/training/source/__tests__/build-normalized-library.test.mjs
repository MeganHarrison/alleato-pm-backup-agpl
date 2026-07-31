import assert from "node:assert/strict";
import test from "node:test";

import { buildNormalizedLibrary } from "../parse-source-library.mjs";
import { parsedSourceFixture as fixture } from "../__fixtures__/parsed-source.fixture.mjs";

test("buildNormalizedLibrary handles an empty source (no roles, topics, or items) without throwing", () => {
  const library = buildNormalizedLibrary({ roles: [], topics: [], items: [] }, { sourceFile: "empty" });
  assert.deepEqual(library.roles, []);
  assert.deepEqual(library.topics, []);
  assert.deepEqual(library.resources, []);
  assert.deepEqual(library.meta.counts, { total: 0, published: 0, review: 0, archived: 0, roles: 0, topics: 0 });
  assert.deepEqual(library.meta.rawCounts, { total: 0, published: 0, review: 0, archived: 0 });
  assert.deepEqual(library.meta.duplicatesDropped, []);
});

test("buildNormalizedLibrary carries roles and topics through as slug/name pairs", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  assert.deepEqual(library.roles, [
    { slug: "project-manager", name: "Project Manager" },
    { slug: "superintendent", name: "Superintendent" },
  ]);
  assert.deepEqual(library.topics, [
    { slug: "reading-reviewing-drawings", name: "Reading & Reviewing Drawings" },
    { slug: "safety-management", name: "Safety Management" },
  ]);
});

test("buildNormalizedLibrary maps each resource to the DB-locked shape", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const changeOrder = library.resources.find((resource) => resource.url.includes("change-order"));

  assert.ok(changeOrder, "expected the article-type fixture item to normalize");
  assert.equal(changeOrder.title, "Writing a Change Order");
  assert.equal(changeOrder.type, "doc"); // article -> doc
  assert.equal(changeOrder.level, "deep-dive"); // deep -> deep-dive
  assert.equal(changeOrder.track, "pm");
  assert.equal(changeOrder.status, "review");
  assert.equal(changeOrder.provider, "Workyard");
  assert.equal(changeOrder.topicSlug, "reading-reviewing-drawings");
  assert.deepEqual(changeOrder.roleSlugs, ["project-manager", "superintendent"]);
  assert.equal(changeOrder.description, "Detailed guide on writing change orders");
  assert.equal(changeOrder.publishedAt, null); // review rows are not published yet
});

test("buildNormalizedLibrary sets publishedAt from dateAdded for published resources and null description for blank notes", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  const crashCourse = library.resources.find((resource) => resource.url.includes("example1"));

  assert.equal(crashCourse.status, "published");
  assert.equal(crashCourse.publishedAt, "2026-07-24T00:00:00.000Z");
  assert.equal(crashCourse.description, null);
});

test("buildNormalizedLibrary preserves counts by status, and rawCounts equals counts when there are no duplicate urls", () => {
  const library = buildNormalizedLibrary(fixture, { sourceFile: "fixture" });
  assert.deepEqual(library.meta.counts, {
    total: 3,
    published: 2,
    review: 1,
    archived: 0,
    roles: 2,
    topics: 2,
  });
  assert.deepEqual(library.meta.rawCounts, { total: 3, published: 2, review: 1, archived: 0 });
  assert.deepEqual(library.meta.duplicatesDropped, []);
});

test("buildNormalizedLibrary dedupes items sharing a url, keeps the first occurrence, and reports the drop loudly instead of silently", () => {
  const nearDuplicateItem = {
    ...fixture.items[0],
    id: "seed-77",
    title: "Reading Drawings: 10-Min Crash Course", // different punctuation, same url
  };
  const sourceWithDuplicate = { ...fixture, items: [...fixture.items, nearDuplicateItem] };

  const library = buildNormalizedLibrary(sourceWithDuplicate, { sourceFile: "fixture" });

  // Only 3 resources make it through — the duplicate is dropped, not double-counted.
  assert.equal(library.resources.length, 3);
  assert.equal(
    library.resources.filter((resource) => resource.url === fixture.items[0].url).length,
    1,
  );
  assert.equal(library.resources.find((resource) => resource.url === fixture.items[0].url).sourceId, "seed-1");

  // rawCounts reflects the source file as-is (4 items); counts reflects the deduped result (3).
  assert.equal(library.meta.rawCounts.total, 4);
  assert.equal(library.meta.counts.total, 3);

  assert.deepEqual(library.meta.duplicatesDropped, [
    {
      url: fixture.items[0].url,
      keptSourceId: "seed-1",
      droppedSourceId: "seed-77",
      droppedTitle: "Reading Drawings: 10-Min Crash Course",
    },
  ]);
});
