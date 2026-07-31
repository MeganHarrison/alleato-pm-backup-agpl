#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const DIMENSIONS = {
  decisionFirstHierarchy: 20,
  actionCompletion: 20,
  evidenceConfidence: 15,
  informationDiscipline: 15,
  workflowContinuity: 10,
  responsiveKeyboard: 10,
  designSystemAccessibility: 10,
};
const SKILLS = new Set([
  "impeccable",
  "interface-design",
  "premium-frontend-design",
  "Frontend Responsive Design Standards",
]);

function fail(message) {
  throw new Error(`[daily-brief-benchmark] ${message}`);
}

function requireFile(value, label) {
  if (typeof value !== "string" || !value.trim()) fail(`${label} is required.`);
  if (!path.isAbsolute(value)) fail(`${label} must be an absolute artifact path.`);
  if (!fs.existsSync(value)) fail(`${label} does not exist: ${value}`);
}

function validate(manifest) {
  if (!SKILLS.has(manifest.skill)) fail(`Unknown skill '${manifest.skill}'.`);
  if (!/^[A-D]$/.test(String(manifest.candidate ?? ""))) fail("candidate must be A, B, C, or D.");
  if (manifest.canonicalRoute !== "/daily-brief") fail("canonicalRoute must be /daily-brief.");
  if (typeof manifest.baseCommit !== "string" || !/^[0-9a-f]{7,40}$/i.test(manifest.baseCommit)) fail("baseCommit must be a Git SHA.");
  requireFile(manifest.desktopScreenshot, "desktopScreenshot");
  requireFile(manifest.mobileScreenshot, "mobileScreenshot");
  requireFile(manifest.interactionTranscript, "interactionTranscript");
  if (!Array.isArray(manifest.automaticFailures)) fail("automaticFailures must be an array.");
  if (manifest.automaticFailures.length) fail(`automatic failures present: ${manifest.automaticFailures.join(", ")}`);

  let total = 0;
  for (const [key, maximum] of Object.entries(DIMENSIONS)) {
    const value = manifest.score?.[key];
    if (!Number.isInteger(value) || value < 0 || value > maximum) fail(`score.${key} must be an integer from 0 to ${maximum}.`);
    total += value;
  }
  if (total < 80) fail(`score ${total}/100 is below the 80-point promotion threshold.`);
  return total;
}

const [command, manifestPath] = process.argv.slice(2);
if (command !== "validate" || !manifestPath) {
  console.error("Usage: node scripts/design-benchmark/daily-brief.mjs validate <candidate.json>");
  process.exit(1);
}

try {
  const absoluteManifestPath = path.resolve(manifestPath);
  const manifest = JSON.parse(fs.readFileSync(absoluteManifestPath, "utf8"));
  const total = validate(manifest);
  console.log(`[daily-brief-benchmark] PASS candidate=${manifest.candidate} skill=${manifest.skill} score=${total}/100`);
} catch (error) {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
}
