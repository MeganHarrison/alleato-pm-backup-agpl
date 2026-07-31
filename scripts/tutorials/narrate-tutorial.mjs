#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { dirname, resolve } from "node:path";
import { spawnSync } from "node:child_process";

const ELEVENLABS_ENDPOINT = "https://api.elevenlabs.io/v1/text-to-speech";
const DEFAULT_MODEL_ID = "eleven_multilingual_v2";

function fail(message) {
  throw new Error(`Tutorial narration failed: ${message}`);
}

export function buildNarrationCues(manifest) {
  if (!Array.isArray(manifest.steps)) fail("manifest has no recorded steps.");
  const cues = manifest.steps
    .map((step, index) => ({
      index: index + 1,
      startSeconds: Number(step.capturedAtSeconds),
      text: String(step.narration || "").trim(),
      title: String(step.title || `Step ${index + 1}`),
    }))
    .filter((cue) => cue.text);

  if (!cues.length) fail("manifest has no narration cues. Add narration to tutorial.step options and recapture.");
  for (const cue of cues) {
    if (!(Number.isFinite(cue.startSeconds) && cue.startSeconds >= 0)) {
      fail(`cue ${cue.index} (${cue.title}) is missing a valid capturedAtSeconds value. Recapture before narration.`);
    }
  }
  return cues.sort((left, right) => left.startSeconds - right.startSeconds);
}

export function probeDuration(filePath) {
  const result = spawnSync(
    "ffprobe",
    ["-v", "error", "-show_entries", "format=duration", "-of", "default=noprint_wrappers=1:nokey=1", filePath],
    { encoding: "utf8" },
  );
  if (result.error) fail(`ffprobe is unavailable (${result.error.message}).`);
  if (result.status !== 0) fail(`ffprobe could not read ${filePath} (${result.stderr.trim() || "unknown error"}).`);
  return Number.parseFloat(result.stdout.trim());
}

function runFfmpeg(args) {
  const result = spawnSync("ffmpeg", ["-y", ...args], { encoding: "utf8" });
  if (result.error) fail(`ffmpeg is unavailable (${result.error.message}).`);
  if (result.status !== 0) fail(`ffmpeg could not assemble narrated video (${result.stderr.trim() || "unknown error"}).`);
}

async function synthesizeCue({ apiKey, voiceId, text, outputPath }) {
  const response = await fetch(`${ELEVENLABS_ENDPOINT}/${encodeURIComponent(voiceId)}`, {
    method: "POST",
    headers: {
      "content-type": "application/json",
      "xi-api-key": apiKey,
    },
    body: JSON.stringify({
      text,
      model_id: process.env.ELEVENLABS_MODEL_ID || DEFAULT_MODEL_ID,
      voice_settings: { stability: 0.5, similarity_boost: 0.75 },
    }),
  });
  if (!response.ok) fail(`ElevenLabs rejected narration cue with HTTP ${response.status}. Check ELEVENLABS_API_KEY, --voice-id, and account access.`);
  writeFileSync(outputPath, Buffer.from(await response.arrayBuffer()));
  const duration = probeDuration(outputPath);
  if (!(Number.isFinite(duration) && duration > 0)) fail(`ElevenLabs returned an unplayable audio cue at ${outputPath}.`);
  return duration;
}

function assertNoOverlaps(cues) {
  for (let index = 0; index < cues.length - 1; index += 1) {
    const cue = cues[index];
    const next = cues[index + 1];
    if (cue.startSeconds + cue.durationSeconds > next.startSeconds) {
      fail(
        `cue ${cue.index} (${cue.title}) runs ${(cue.startSeconds + cue.durationSeconds - next.startSeconds).toFixed(2)} seconds into cue ${next.index}. ` +
        "Shorten the narration or recapture with more time between steps; overlapping voiceovers are not mixed silently.",
      );
    }
  }
}

function muxNarration({ videoPath, cues, outputPath }) {
  const inputs = ["-i", videoPath, ...cues.flatMap((cue) => ["-i", cue.audioFile])];
  const filters = cues.map((cue, index) => {
    const delayMs = Math.round(cue.startSeconds * 1_000);
    return `[${index + 1}:a]adelay=${delayMs}|${delayMs}[cue${index}]`;
  });
  const mixed = cues.map((_, index) => `[cue${index}]`).join("");
  filters.push(`${mixed}amix=inputs=${cues.length}:duration=longest:dropout_transition=0[narration]`);
  runFfmpeg([
    ...inputs,
    "-filter_complex", filters.join(";"),
    "-map", "0:v:0",
    "-map", "[narration]",
    "-c:v", "copy",
    "-c:a", "libopus",
    "-shortest",
    outputPath,
  ]);
  const duration = probeDuration(outputPath);
  if (!(Number.isFinite(duration) && duration > 0)) fail(`narrated video is not playable after ffmpeg output (${outputPath}).`);
  return duration;
}

function parseArgs(argv) {
  const options = { manifestPath: "", voiceId: process.env.ELEVENLABS_VOICE_ID || "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--voice-id") options.voiceId = argv[++index] || "";
    else if (!options.manifestPath) options.manifestPath = arg;
    else fail(`unexpected argument ${arg}.`);
  }
  if (!options.manifestPath) fail("usage: npm run tutorial:narrate -- <manifest.json> --voice-id <ElevenLabs voice id>");
  if (!options.voiceId) fail("voice ID is required. Pass --voice-id or set ELEVENLABS_VOICE_ID.");
  return options;
}

export async function renderNarratedTutorial({ manifestPath, voiceId, apiKey = process.env.ELEVENLABS_API_KEY }) {
  if (!apiKey) fail("ELEVENLABS_API_KEY is not available to this process. Configure it in the runtime environment; do not add it to source artifacts.");
  const absoluteManifestPath = resolve(manifestPath);
  if (!existsSync(absoluteManifestPath)) fail(`manifest is missing at ${absoluteManifestPath}.`);
  const outputDir = dirname(absoluteManifestPath);
  const manifest = JSON.parse(readFileSync(absoluteManifestPath, "utf8"));
  const videoFile = manifest.video?.file?.trim();
  if (!videoFile) fail("manifest has no walkthrough video.");
  const videoPath = resolve(outputDir, videoFile);
  if (!existsSync(videoPath) || !(probeDuration(videoPath) > 0)) fail(`manifest video is not playable (${videoPath}). Recapture before rendering narration.`);

  const cueDir = resolve(outputDir, "narration-audio");
  mkdirSync(cueDir, { recursive: true });
  const cues = buildNarrationCues(manifest);
  for (const cue of cues) {
    cue.audioFile = resolve(cueDir, `${String(cue.index).padStart(2, "0")}.mp3`);
    cue.durationSeconds = await synthesizeCue({ apiKey, voiceId, text: cue.text, outputPath: cue.audioFile });
  }
  assertNoOverlaps(cues);

  const outputPath = resolve(outputDir, "narrated.webm");
  const durationSeconds = muxNarration({ videoPath, cues, outputPath });
  const narrationPath = resolve(outputDir, "narration.json");
  writeFileSync(narrationPath, `${JSON.stringify({ voiceId, durationSeconds, cues }, null, 2)}\n`);
  manifest.narratedVideo = { file: "narrated.webm", mimeType: "video/webm", narrationFile: "narration.json" };
  writeFileSync(absoluteManifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
  return { narrationPath, outputPath, cueCount: cues.length, durationSeconds };
}

if (process.argv[1] && resolve(process.argv[1]) === resolve(new URL(import.meta.url).pathname)) {
  renderNarratedTutorial(parseArgs(process.argv.slice(2)))
    .then((result) => console.log(JSON.stringify(result, null, 2)))
    .catch((error) => {
      console.error(error instanceof Error ? error.message : error);
      process.exitCode = 1;
    });
}
