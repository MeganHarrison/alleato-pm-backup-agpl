#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const repoRoot = resolve(import.meta.dirname, "..", "..");
const routePath = "frontend/src/lib/ai/chat-handler.ts";
const content = readFileSync(resolve(repoRoot, routePath), "utf8");

const featureFlagIndex = content.indexOf("const featureRequestPacketRequest = shouldCaptureFeatureRequest(lastUserContent)");
const streamIndex = content.indexOf("const stream = createUIMessageStream");
const fastPathIndex = content.indexOf("if (featureRequestPacketRequest)");
const promptAssemblyIndex = content.indexOf("assembleSystemPrompt({");
const streamTextIndex = content.indexOf("const result = streamText({");
const oldInlineCaptureIndex = content.indexOf("if (shouldCaptureFeatureRequest(lastUserContent))");

const failures = [];

if (featureFlagIndex === -1) {
  failures.push("feature request packet detection is not computed before stream execution");
}

if (fastPathIndex === -1) {
  failures.push("feature request packet fast path is missing");
}

if (featureFlagIndex > streamIndex) {
  failures.push("feature request packet detection moved inside the stream instead of before it");
}

if (fastPathIndex > promptAssemblyIndex) {
  failures.push("feature request packet fast path runs after full prompt assembly");
}

if (fastPathIndex > streamTextIndex) {
  failures.push("feature request packet fast path runs after streamText");
}

if (oldInlineCaptureIndex !== -1) {
  failures.push("old inline feature request capture still exists on the long model path");
}

for (const required of [
  "Feature request packet capture timed out before a durable packet could be confirmed.",
  "deterministicFastPath: true",
  "I stopped at packet capture so this turn does not time out",
  "writeAssistantWidgetParts(",
  "return;",
]) {
  if (!content.includes(required)) {
    failures.push(`missing fast-path contract marker: ${required}`);
  }
}

if (failures.length > 0) {
  console.error("AI feature request fast-path verification failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("AI feature request fast-path verification passed.");
