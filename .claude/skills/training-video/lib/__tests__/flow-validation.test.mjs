import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  resolveFlowAssetPath,
  validateFlow,
} from "../flow-validation.mjs";

test("validates required date and upload actions", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "training-video-flow-"));
  const flowPath = path.join(root, "flow.json");
  const workbookPath = path.join(root, "estimate.xlsx");
  fs.writeFileSync(workbookPath, "fixture");

  assert.doesNotThrow(() =>
    validateFlow(
      {
        steps: [
          { required: true, date: { label: "Start Date", value: "2026-08-03" } },
          {
            required: true,
            upload: { selector: 'input[type="file"]', path: "estimate.xlsx" },
            expectText: "selected",
            expectTexts: ["01-3120", "$1,250.00"],
          },
        ],
      },
      flowPath,
    ),
  );
  assert.equal(resolveFlowAssetPath(flowPath, "estimate.xlsx"), workbookPath);
});

test("rejects malformed or impossible dates and missing upload assets", () => {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "training-video-flow-"));
  const flowPath = path.join(root, "flow.json");

  assert.throws(
    () =>
      validateFlow(
        {
          steps: [
            { date: { label: "Start Date", value: "2026-02-30" } },
            { upload: { selector: 'input[type="file"]', path: "missing.xlsx" } },
          ],
        },
        flowPath,
      ),
    /YYYY-MM-DD[\s\S]*does not exist/,
  );
});

test("rejects empty or non-string expected-text assertions", () => {
  assert.throws(
    () => validateFlow({ steps: [{ expectTexts: ["Mapped", ""] }] }, "flow.json"),
    /non-empty array of non-empty strings/,
  );
});

test("rejects flow names that could escape the output directory", () => {
  for (const name of ["../victim", "nested/video", "video.mp4", ""]) {
    assert.throws(
      () => validateFlow({ name, steps: [{ pause: 1 }] }, "flow.json"),
      /safe output basename/,
    );
  }
});
