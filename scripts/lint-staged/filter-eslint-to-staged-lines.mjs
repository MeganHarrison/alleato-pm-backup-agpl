#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const [jsonPath, ...frontendRelativeFiles] = process.argv.slice(2);

if (!jsonPath || frontendRelativeFiles.length === 0) {
  console.error("usage: filter-eslint-to-staged-lines.mjs <eslint-json> <file>...");
  process.exit(2);
}

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, "..", "..");
const frontendDir = path.join(repoRoot, "frontend");
const changedLinesByFile = new Map();

function stagedLinesFor(frontendRelativeFile) {
  const repoRelativeFile = path.join("frontend", frontendRelativeFile);
  let diff = "";

  try {
    diff = execFileSync(
      "git",
      ["diff", "--cached", "--unified=0", "--", repoRelativeFile],
      { cwd: repoRoot, encoding: "utf8", maxBuffer: 64 * 1024 * 1024 }
    );
  } catch (error) {
    console.error(`Failed to read staged diff for ${repoRelativeFile}`);
    process.exit(2);
  }

  const lines = new Set();
  const hunkPattern = /^@@ -\d+(?:,\d+)? \+(\d+)(?:,(\d+))? @@/;

  for (const line of diff.split("\n")) {
    const match = line.match(hunkPattern);
    if (!match) continue;

    const start = Number(match[1]);
    const count = match[2] === undefined ? 1 : Number(match[2]);
    for (let offset = 0; offset < count; offset += 1) {
      lines.add(start + offset);
    }
  }

  return lines;
}

for (const frontendRelativeFile of frontendRelativeFiles) {
  const absoluteFile = path.join(frontendDir, frontendRelativeFile);
  changedLinesByFile.set(absoluteFile, stagedLinesFor(frontendRelativeFile));
}

const eslintResults = JSON.parse(fs.readFileSync(jsonPath, "utf8"));
const blockingMessages = [];

for (const result of eslintResults) {
  const changedLines = changedLinesByFile.get(result.filePath);
  if (!changedLines) continue;

  for (const message of result.messages) {
    if (message.severity !== 2) continue;
    if (message.fatal || !message.line || changedLines.has(message.line)) {
      blockingMessages.push({
        filePath: result.filePath,
        line: message.line,
        column: message.column,
        ruleId: message.ruleId,
        message: message.message,
      });
    }
  }
}

if (blockingMessages.length === 0) {
  console.log("Strict design lint found no new errors on staged changed lines.");
  process.exit(0);
}

let currentFile = "";
for (const message of blockingMessages) {
  if (message.filePath !== currentFile) {
    currentFile = message.filePath;
    console.error(`\n${currentFile}`);
  }
  console.error(
    `  ${message.line}:${message.column}  error  ${message.message}  ${message.ruleId}`
  );
}

console.error(`\n${blockingMessages.length} new strict lint error(s) on staged changed lines.`);
process.exit(1);
