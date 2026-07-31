import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";

import { validateTrainingPacket } from "../validate-training-packet.mjs";

function fixture() {
  const dir = mkdtempSync(path.join(os.tmpdir(), "training-packet-"));
  mkdirSync(path.join(dir, "screenshots"));
  writeFileSync(path.join(dir, "screenshots", "01-step.png"), "png");
  writeFileSync(path.join(dir, "session.webm"), "video");
  for (const file of ["example.md", "documentation-draft.md", "documentation-input.json", "source-brief.md"]) writeFileSync(path.join(dir, file), "content");
  const manifestPath = path.join(dir, "manifest.json");
  writeFileSync(manifestPath, JSON.stringify({ slug: "example", video: { file: "session.webm" }, steps: [{ screenshot: "screenshots/01-step.png", sourceUrl: "http://localhost:3001/1034/example" }] }));
  return { dir, manifestPath };
}

test("validateTrainingPacket accepts a complete playable packet", () => {
  const { manifestPath } = fixture();
  const result = validateTrainingPacket({ manifestPath, probeVideo: () => 12.72 });
  assert.equal(result.screenshotCount, 1);
  assert.equal(result.videoDurationSeconds, 12.72);
});

test("validateTrainingPacket rejects login-route captures", () => {
  const { manifestPath } = fixture();
  const raw = JSON.parse(readFileSync(manifestPath, "utf8"));
  raw.steps[0].sourceUrl = "http://localhost:3001/auth/login";
  writeFileSync(manifestPath, JSON.stringify(raw));
  assert.throws(() => validateTrainingPacket({ manifestPath, probeVideo: () => 12.72 }), /blocked route/i);
});

test("validateTrainingPacket rejects unfinalized video", () => {
  const { manifestPath } = fixture();
  assert.throws(() => validateTrainingPacket({ manifestPath, probeVideo: () => Number.NaN }), /not finalized or playable/i);
});
