import test from "node:test";
import assert from "node:assert/strict";

import {
  chooseGeneratedMarkdown,
  getUploadRetryContentType,
} from "../publish-tutorial.ts";

test("chooseGeneratedMarkdown prefers the cleaned documentation draft", () => {
  assert.equal(
    chooseGeneratedMarkdown("# Draft body", "# Raw capture body"),
    "# Draft body",
  );
});

test("chooseGeneratedMarkdown falls back to generated capture markdown", () => {
  assert.equal(
    chooseGeneratedMarkdown("", "# Raw capture body"),
    "# Raw capture body",
  );
});

test("getUploadRetryContentType falls back for webm uploads", () => {
  assert.equal(getUploadRetryContentType("video/webm"), "application/octet-stream");
  assert.equal(getUploadRetryContentType("image/png"), null);
});
