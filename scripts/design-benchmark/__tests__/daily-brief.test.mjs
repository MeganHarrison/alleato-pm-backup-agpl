import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const runner = fileURLToPath(new URL("../daily-brief.mjs", import.meta.url));

function fixture(overrides = {}) {
  const root = fs.mkdtempSync(path.join(os.tmpdir(), "daily-brief-benchmark-"));
  const artifacts = ["desktop.png", "mobile.png", "transcript.md"].map((name) => {
    const file = path.join(root, name);
    fs.writeFileSync(file, "fixture");
    return file;
  });
  const manifestPath = path.join(root, "candidate.json");
  fs.writeFileSync(manifestPath, JSON.stringify({
    candidate: "A",
    skill: "impeccable",
    baseCommit: "abcdef1",
    canonicalRoute: "/daily-brief",
    desktopScreenshot: artifacts[0],
    mobileScreenshot: artifacts[1],
    interactionTranscript: artifacts[2],
    score: {
      decisionFirstHierarchy: 18,
      actionCompletion: 18,
      evidenceConfidence: 13,
      informationDiscipline: 13,
      workflowContinuity: 8,
      responsiveKeyboard: 8,
      designSystemAccessibility: 8,
    },
    automaticFailures: [],
    ...overrides,
  }));
  return { root, manifestPath };
}

test("accepts an evidence-backed candidate at the promotion threshold", () => {
  const { root, manifestPath } = fixture();
  try {
    const output = execFileSync("node", [runner, "validate", manifestPath], { encoding: "utf8" });
    assert.match(output, /PASS candidate=A skill=impeccable score=86\/100/);
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});

test("rejects candidates that include an automatic failure", () => {
  const { root, manifestPath } = fixture({ automaticFailures: ["dead control"] });
  try {
    assert.throws(
      () => execFileSync("node", [runner, "validate", manifestPath], { encoding: "utf8", stdio: "pipe" }),
      /automatic failures present: dead control/,
    );
  } finally {
    fs.rmSync(root, { recursive: true, force: true });
  }
});
