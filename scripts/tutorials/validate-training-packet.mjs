#!/usr/bin/env node

import { existsSync, readFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const BLOCKED_ROUTE_PATTERNS = ["/auth/login", "/access-denied"];
const REQUIRED_SUPPORT_ARTIFACTS = [
  "documentation-draft.md",
  "documentation-input.json",
  "source-brief.md",
];

function fail(message) {
  throw new Error(`Training packet validation failed: ${message}`);
}

export function validateTrainingPacket({ manifestPath, requireDocsScreenshots = false, probeVideo = probeVideoDuration }) {
  const absoluteManifestPath = resolve(manifestPath);
  if (!existsSync(absoluteManifestPath)) fail(`manifest is missing at ${absoluteManifestPath}.`);
  const outputDir = dirname(absoluteManifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));

  if (!manifest.slug?.trim()) fail("manifest slug is missing.");
  if (!Array.isArray(manifest.steps) || manifest.steps.length === 0) fail("manifest has no recorded steps.");

  const tutorialMarkdown = resolve(outputDir, `${manifest.slug}.md`);
  if (!existsSync(tutorialMarkdown)) fail(`tutorial markdown is missing at ${tutorialMarkdown}.`);
  for (const name of REQUIRED_SUPPORT_ARTIFACTS) {
    const filePath = resolve(outputDir, name);
    if (!existsSync(filePath)) fail(`required artifact is missing at ${filePath}.`);
  }

  for (const [index, step] of manifest.steps.entries()) {
    if (!step.screenshot?.trim()) fail(`step ${index + 1} is missing a screenshot path.`);
    const screenshotPath = resolve(outputDir, step.screenshot);
    if (!existsSync(screenshotPath)) fail(`step ${index + 1} screenshot is missing at ${screenshotPath}.`);
    const sourceUrl = String(step.sourceUrl || "");
    if (!sourceUrl) fail(`step ${index + 1} is missing a source URL.`);
    if (BLOCKED_ROUTE_PATTERNS.some((pattern) => sourceUrl.includes(pattern))) {
      fail(`step ${index + 1} captured blocked route ${sourceUrl}. Refresh auth or permissions and recapture.`);
    }
    if (requireDocsScreenshots && isFullAppViewport(screenshotPath)) {
      fail(`step ${index + 1} screenshot is a full-app viewport (${screenshotPath}). Recapture with --docs-screenshots.`);
    }
  }

  const videoFile = manifest.video?.file?.trim();
  if (!videoFile) fail("manifest walkthrough video is missing.");
  const videoPath = resolve(outputDir, videoFile);
  if (!existsSync(videoPath)) fail(`walkthrough video is missing at ${videoPath}.`);
  const duration = probeVideo(videoPath);
  if (!(Number.isFinite(duration) && duration > 0)) {
    fail(`walkthrough video is not finalized or playable (${videoPath}). Re-run capture; ffprobe duration must be greater than zero.`);
  }

  return {
    outputDir,
    manifest,
    screenshotCount: manifest.steps.length,
    videoPath,
    videoDurationSeconds: duration,
  };
}

export function probeVideoDuration(videoPath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", videoPath],
    { encoding: "utf8" },
  );
  if (result.error) fail(`ffprobe is unavailable while checking ${videoPath}: ${result.error.message}`);
  if (result.status !== 0) fail(`ffprobe could not read ${videoPath}: ${result.stderr.trim() || "unknown error"}`);
  return Number.parseFloat(result.stdout.trim());
}

function isFullAppViewport(filePath) {
  const result = spawnSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", filePath], { encoding: "utf8" });
  if (result.status !== 0) fail(`could not inspect screenshot dimensions for ${filePath}.`);
  const width = Number(result.stdout.match(/pixelWidth:\s*(\d+)/)?.[1]);
  const height = Number(result.stdout.match(/pixelHeight:\s*(\d+)/)?.[1]);
  return width === 1440 && height === 1000;
}

function parseArgs(argv) {
  const options = { manifestPath: "", requireDocsScreenshots: false };
  for (const arg of argv) {
    if (arg === "--require-docs-screenshots") options.requireDocsScreenshots = true;
    else if (!options.manifestPath) options.manifestPath = arg;
    else fail(`unexpected argument ${arg}.`);
  }
  if (!options.manifestPath) fail("usage: node scripts/tutorials/validate-training-packet.mjs <manifest.json> [--require-docs-screenshots]");
  return options;
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  try {
    const options = parseArgs(process.argv.slice(2));
    console.log(JSON.stringify(validateTrainingPacket(options), null, 2));
  } catch (error) {
    console.error(error instanceof Error ? error.message : error);
    process.exitCode = 1;
  }
}
