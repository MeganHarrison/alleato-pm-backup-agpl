import assert from "node:assert/strict";
import test from "node:test";

import { parseArgs } from "../prepare-authenticated-browser.mjs";

test("auth compatibility entrypoint accepts the historical base URL and route", () => {
  const options = parseArgs([
    "--base-url",
    "https://projects.alleatogroup.com",
    "--route",
    "/43/schedule",
    "--session",
    "schedule-proof",
  ]);

  assert.equal(
    options.targetUrl,
    "https://projects.alleatogroup.com/43/schedule",
  );
  assert.equal(options.owner, "schedule-proof");
});
