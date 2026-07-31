#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { execFileSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const registryPath = path.join(repoRoot, "config/ai-runtime-owners.json");
const registry = JSON.parse(fs.readFileSync(registryPath, "utf8"));
const strict = process.argv.includes("--strict");
const errors = [];
const warnings = [];
const required = [
  "id",
  "owner",
  "runtime",
  "trigger",
  "models",
  "paths",
  "tracking_status",
  "budget_status",
  "provider_policy",
  "deployment_state",
];
const groups = registry.callsite_groups || [];
const ids = new Set();
const registeredPaths = new Set();
const renderText = fs.readFileSync(path.join(repoRoot, "render.yaml"), "utf8");
const renderBlocks = new Map(
  renderText
    .split(/\n(?=  - type: )/)
    .map((block) => [block.match(/\n?\s+name:\s+([^\s#]+)/)?.[1], block])
    .filter(([name]) => name),
);

for (const group of groups) {
  for (const field of required) {
    if (group[field] == null || group[field] === "") {
      errors.push(`${group.id || "<missing-id>"}: missing ${field}`);
    }
  }
  if (ids.has(group.id)) errors.push(`duplicate callsite group id: ${group.id}`);
  ids.add(group.id);
  for (const relativePath of group.paths || []) {
    registeredPaths.add(relativePath);
    if (!fs.existsSync(path.join(repoRoot, relativePath))) {
      errors.push(`${group.id}: registered path does not exist: ${relativePath}`);
    }
  }
  const scheduled = /cron|schedule/i.test(`${group.runtime} ${group.trigger}`);
  if (
    scheduled &&
    group.deployment_state === "active" &&
    ["unmetered", "usage_returned_not_persisted"].includes(group.tracking_status)
  ) {
    warnings.push(`${group.id}: active scheduled AI work is not durably metered`);
  }
  if (
    group.deployment_state === "active" &&
    ["unmetered", "partial", "usage_returned_not_persisted"].includes(group.tracking_status)
  ) {
    warnings.push(`${group.id}: active coverage debt (${group.tracking_status})`);
  }
  if (
    group.deployment_state === "active" &&
    group.provider_policy === "gateway_required"
  ) {
    for (const serviceName of group.render_services || []) {
      const block = renderBlocks.get(serviceName);
      if (!block) {
        errors.push(`${group.id}: Render service is missing: ${serviceName}`);
        continue;
      }
      for (const key of [
        "AI_GATEWAY_API_KEY",
        "AI_GATEWAY_REQUIRED",
        "PIPELINE_DAILY_MODEL_BUDGET_USD",
        "PIPELINE_BUDGET_REQUIRED",
      ]) {
        if (!block.includes(`- key: ${key}`)) {
          errors.push(`${group.id}: ${serviceName} is missing ${key}`);
        }
      }
    }
  }
}

const backendBlock = renderBlocks.get("alleato-backend") || "";
if (
  !/- key: OPENAI_API_KEY\s*\n\s+value: " "/.test(backendBlock)
) {
  errors.push(
    "alleato-backend: OPENAI_API_KEY must have an explicit blank service override while legacy raw SDK callsites remain",
  );
}

const scanRoots = ["backend/src", "frontend/src", "project-intelligence", "agents"];
const pattern =
  String.raw`OpenAI\(|new OpenAI|ChatOpenAI|\.chat\.completions\.create|\.embeddings\.create|api\.openai\.com|generateText\(|streamText\(|generateObject\(|embedMany\(|experimental_generateSpeech`;
let matches = "";
try {
  matches = execFileSync(
    "rg",
    ["-l", "-g", "*.{py,ts,tsx,js,mjs}", pattern, ...scanRoots],
    { cwd: repoRoot, encoding: "utf8" },
  );
} catch (error) {
  if (error.status !== 1) throw error;
}
const discovered = matches.split(/\r?\n/).filter(Boolean);
for (const relativePath of discovered) {
  if (
    relativePath.includes("/__tests__/") ||
    relativePath.includes("/tests/") ||
    relativePath.endsWith(".test.ts") ||
    relativePath === "frontend/src/instrumentation.ts"
  ) {
    continue;
  }
  if (!registeredPaths.has(relativePath)) {
    errors.push(`unregistered production AI callsite: ${relativePath}`);
  }
}

console.log(`AI spend ownership: ${groups.length} groups, ${registeredPaths.size} registered paths`);
for (const warning of warnings) console.warn(`WARN ${warning}`);
for (const error of errors) console.error(`ERROR ${error}`);
if (errors.length || (strict && warnings.length)) process.exit(1);
