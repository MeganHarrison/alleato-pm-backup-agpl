#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { spawnSync } from "node:child_process";

import { validateResult } from "../verification/verification-contract.mjs";

const repoRoot = process.cwd();

function parseArgs(argv) {
  const options = { strict: false, handoffs: [], changedFrom: "" };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === "--strict") options.strict = true;
    else if (arg === "--changed-from") options.changedFrom = argv[++index] || "";
    else if (arg.startsWith("--")) throw new Error(`Unknown argument: ${arg}`);
    else options.handoffs.push(arg);
  }
  return options;
}

function changedHandoffs(ref) {
  const result = spawnSync("git", ["diff", "--name-only", `${ref}...HEAD`], {
    cwd: repoRoot,
    encoding: "utf8",
  });
  if (result.status !== 0) throw new Error(result.stderr?.trim() || `Unable to diff against ${ref}`);
  return result.stdout.split(/\r?\n/).filter((file) => /^docs\/ops\/handoffs\/[^/]+\.md$/.test(file));
}

export function resolveHandoffsForChangedFiles(changedFiles, rootDir = repoRoot) {
  const handoffDir = path.join(rootDir, "docs/ops/handoffs");
  const allHandoffs = fs.existsSync(handoffDir)
    ? fs.readdirSync(handoffDir).filter((file) => file.endsWith(".md")).map((file) => `docs/ops/handoffs/${file}`)
    : [];
  const selected = new Set(changedFiles.filter((file) => /^docs\/ops\/handoffs\/[^/]+\.md$/.test(file)));
  const candidates = changedFiles.filter((file) =>
    /^docs\/ops\/tasks\/[^/]+\.md$/.test(file) ||
    /^scripts\/verification\//.test(file) ||
    /^scripts\/templates\/verification-manifest\.example\.json$/.test(file) ||
    /^docs\/ops\/evidence\//.test(file) ||
    /^tests\/agent-browser-runs\//.test(file) ||
    [
      "scripts/ops/codex-finish.mjs",
      "scripts/ops/check-review-queue-verification.mjs",
      "scripts/ops/verification-closeout-policy.mjs",
      ".github/workflows/guardrail-pr-check.yml",
      "docs/ops/orchestration/review-queue.md",
    ].includes(file),
  );
  const orphaned = [];
  for (const candidate of candidates) {
    const matches = allHandoffs.filter((handoff) => {
      const text = fs.readFileSync(path.join(rootDir, handoff), "utf8");
      if (text.includes(candidate)) return true;
      const referencedPaths = [...text.matchAll(/(?:^|\s|`)((?:scripts|docs|tests)\/[^\s`|,)]+(?:\/(?:\s|`|$)|\.(?:json|md|txt|webm|png)))/g)].map((match) => match[1].replace(/\/$/, ""));
      return referencedPaths.some((referencedPath) => {
        const referencedAbsolutePath = path.join(rootDir, referencedPath);
        if (!fs.existsSync(referencedAbsolutePath)) return false;
        if (fs.statSync(referencedAbsolutePath).isDirectory()) return candidate.startsWith(`${referencedPath}/`);
        try {
          return fs.readFileSync(referencedAbsolutePath, "utf8").includes(candidate);
        } catch {
          return false;
        }
      });
    });
    if (matches.length === 0) orphaned.push(candidate);
    matches.forEach((match) => selected.add(match));
  }
  return { handoffs: [...selected], orphaned };
}

function field(text, label) {
  const match = text.match(new RegExp(`^\\s*(?:\\d+\\)\\s*)?${label}:\\s*(.+?)\\s*$`, "im"));
  return match?.[1]?.trim().replace(/^`|`$/g, "") || "";
}

function firstTaskPath(text) {
  const match = text.match(/(?:^|\s|`)(docs\/ops\/tasks\/[^\s`|,)]+\.md)/);
  return match?.[1] || "";
}

function readJson(file) {
  if (!fs.existsSync(file)) throw new Error(`File not found: ${path.relative(repoRoot, file)}`);
  return JSON.parse(fs.readFileSync(file, "utf8"));
}

export function checkHandoff(handoffPath, { strict = false, rootDir = repoRoot } = {}) {
  const absoluteHandoff = path.resolve(rootDir, handoffPath);
  if (!fs.existsSync(absoluteHandoff)) return { errors: [`${handoffPath}: handoff file not found`], warnings: [] };
  const text = fs.readFileSync(absoluteHandoff, "utf8");
  const taskPath = field(text, "Task file") || firstTaskPath(text);
  const taskId = field(text, "Task ID");
  if (!taskPath) {
    return { errors: strict ? [`${handoffPath}: no related task file found`] : [], warnings: strict ? [] : [`${handoffPath}: no related task file found`] };
  }

  const absoluteTask = path.resolve(rootDir, taskPath);
  if (!fs.existsSync(absoluteTask)) return { errors: [`${handoffPath}: related task file not found: ${taskPath}`], warnings: [] };
  const taskText = fs.readFileSync(absoluteTask, "utf8");
  const taskFileId = field(taskText, "Task ID");
  if (!taskFileId) {
    const message = `${handoffPath}: related task file has no Task ID`;
    return strict ? { errors: [message], warnings: [] } : { errors: [], warnings: [message] };
  }
  if (!taskId) {
    const message = `${handoffPath}: handoff has no Task ID`;
    return strict ? { errors: [message], warnings: [] } : { errors: [], warnings: [message] };
  }
  if (taskId !== taskFileId) {
    return { errors: [`${handoffPath}: handoff Task ID ${taskId} does not match task file Task ID ${taskFileId}`], warnings: [] };
  }
  const contract = taskText.match(/^Verification contract:\s*(Required|Not applicable)\s*$/im)?.[1];
  if (!contract) {
    const message = `${handoffPath}: task has no Verification contract metadata`;
    return strict ? { errors: [message], warnings: [] } : { errors: [], warnings: [message] };
  }
  if (contract.toLowerCase() === "not applicable") return { errors: [], warnings: [] };

  const manifestPath = field(text, "Verification manifest");
  const resultPath = field(text, "Verification result");
  const errors = [];
  if (!manifestPath || !resultPath) {
    errors.push(`${handoffPath}: Required task must declare Verification manifest and Verification result`);
    return { errors, warnings: [] };
  }
  try {
    const manifest = readJson(path.resolve(rootDir, manifestPath));
    const result = readJson(path.resolve(rootDir, resultPath));
    if (result.status !== "PASS") errors.push(`${handoffPath}: review acceptance requires result status PASS, got ${result.status || "missing"}`);
    errors.push(...validateResult({ manifest, result, rootDir, expectedTaskId: taskId }).map((error) => `${handoffPath}: ${error}`));
  } catch (error) {
    errors.push(`${handoffPath}: ${error.message}`);
  }
  return { errors, warnings: [] };
}

if (import.meta.url === `file://${process.argv[1]}`) {
  try {
    const options = parseArgs(process.argv.slice(2));
    const changedFiles = options.changedFrom ? changedHandoffs(options.changedFrom) : [];
    const resolved = options.changedFrom ? resolveHandoffsForChangedFiles(changedFiles) : { handoffs: options.handoffs, orphaned: [] };
    const handoffs = resolved.handoffs;
    if (resolved.orphaned.length > 0) {
      console.error("Review-queue verification failed:");
      resolved.orphaned.forEach((file) => console.error(`- Changed verification artifact has no linked handoff: ${file}`));
      process.exit(1);
    }
    if (handoffs.length === 0) {
      console.log("Review-queue verification: no handoffs selected.");
      process.exit(0);
    }
    const errors = [];
    const warnings = [];
    for (const handoff of handoffs) {
      const result = checkHandoff(handoff, { strict: options.strict });
      errors.push(...result.errors);
      warnings.push(...result.warnings);
    }
    warnings.forEach((warning) => console.warn(`Warning: ${warning}`));
    if (errors.length > 0) {
      console.error("Review-queue verification failed:");
      errors.forEach((error) => console.error(`- ${error}`));
      process.exit(1);
    }
    console.log(`Review-queue verification passed: ${handoffs.length} handoff(s).`);
  } catch (error) {
    console.error(`Review-queue verification could not run: ${error.message}`);
    process.exit(2);
  }
}
