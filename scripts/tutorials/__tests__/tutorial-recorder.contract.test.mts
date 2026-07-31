import assert from "node:assert/strict";
import test from "node:test";

import {
  closeTutorialContext,
  formatCalendarButtonName,
  persistRecordedVideo,
} from "../tutorial-recorder.ts";

test("formatCalendarButtonName matches the accessible calendar day label", () => {
  assert.equal(
    formatCalendarButtonName(new Date("2026-08-01T12:00:00")),
    "Saturday, August 1st, 2026",
  );
});

test("formatCalendarButtonName handles ordinal exceptions", () => {
  assert.equal(
    formatCalendarButtonName(new Date("2026-08-11T12:00:00")),
    "Tuesday, August 11th, 2026",
  );
  assert.equal(
    formatCalendarButtonName(new Date("2026-08-23T12:00:00")),
    "Sunday, August 23rd, 2026",
  );
});

test("closeTutorialContext returns a timeout result instead of hanging after artifacts", async () => {
  const result = await closeTutorialContext(
    { close: () => new Promise<void>(() => undefined) },
    5,
  );

  assert.deepEqual(result, { error: null, timedOut: true });
});

test("closeTutorialContext preserves a cleanup failure for the runner warning", async () => {
  const result = await closeTutorialContext(
    { close: async () => { throw new Error("context close failed"); } },
    100,
  );

  assert.equal(result.timedOut, false);
  assert.equal(result.error?.message, "context close failed");
});

test("persistRecordedVideo waits for Playwright saveAs before publishing the asset", async () => {
  const calls: string[] = [];
  const video = {
    saveAs: async (targetPath: string) => {
      calls.push(`save:${targetPath}`);
    },
    delete: async () => {
      calls.push("delete");
    },
  };

  const result = await persistRecordedVideo("/tmp/tutorial-video", video);

  assert.deepEqual(result, { file: "session.webm", mimeType: "video/webm" });
  assert.deepEqual(calls, ["save:/tmp/tutorial-video/session.webm", "delete"]);
});
