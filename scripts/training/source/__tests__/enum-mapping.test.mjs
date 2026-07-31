import assert from "node:assert/strict";
import test from "node:test";

import { mapResourceLevel, mapResourceType } from "../parse-source-library.mjs";

test("mapResourceType passes through the DB-locked values unchanged", () => {
  assert.equal(mapResourceType("video"), "video");
  assert.equal(mapResourceType("course"), "course");
  assert.equal(mapResourceType("doc"), "doc");
});

test("mapResourceType folds article/reference/podcast into doc (locked contract is video|course|doc only)", () => {
  assert.equal(mapResourceType("article"), "doc");
  assert.equal(mapResourceType("reference"), "doc");
  assert.equal(mapResourceType("podcast"), "doc");
});

test("mapResourceType throws loudly on a genuinely unrecognized type instead of silently defaulting", () => {
  assert.throws(() => mapResourceType("interactive-lab"), /unrecognized.*type.*interactive-lab/i);
});

test("mapResourceLevel maps 'all' to 'intro' and 'deep' to 'deep-dive'", () => {
  assert.equal(mapResourceLevel("all"), "intro");
  assert.equal(mapResourceLevel("deep"), "deep-dive");
});

test("mapResourceLevel throws loudly on a genuinely unrecognized level", () => {
  assert.throws(() => mapResourceLevel("expert"), /unrecognized.*level.*expert/i);
});
