#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const ACTIVE_BACKEND_URL = "alleato-backend-rbnj.onrender.com";
const SEARCH_ROOTS = [
  ".env",
  ".env.example",
  "backend",
  "frontend",
  "scripts",
  "docs",
  "claude-memory-compiler-main",
  ".claude",
  ".vercel",
  "frontend/.vercel",
  "frontend/.env.local",
  "supabase",
  "render.yaml",
];
const IGNORED_DIRS = new Set([
  ".git",
  "node_modules",
  ".next",
  "playwright-report",
  "test-results",
  "coverage",
]);
const IGNORED_EXTENSIONS = new Set([".png", ".jpg", ".jpeg", ".webp", ".gif", ".webm", ".pdf"]);

function* walk(target) {
  if (!fs.existsSync(target)) return;
  const stat = fs.statSync(target);
  if (stat.isDirectory()) {
    if (IGNORED_DIRS.has(path.basename(target))) return;
    for (const entry of fs.readdirSync(target)) {
      yield* walk(path.join(target, entry));
    }
    return;
  }
  if (stat.isFile() && !IGNORED_EXTENSIONS.has(path.extname(target))) yield target;
}

const failures = [];
const renderHostPattern = /https?:\/\/([a-z0-9-]+\.onrender\.com)(?=[/?#"`'\s)]|$)/gi;

for (const root of SEARCH_ROOTS) {
  for (const filePath of walk(root)) {
    const content = fs.readFileSync(filePath, "utf8");
    for (const match of content.matchAll(renderHostPattern)) {
      const host = match[1];
      if (host !== ACTIVE_BACKEND_URL) {
        failures.push(`${filePath}: contains non-active Render backend host ${host}`);
      }
    }
  }
}

if (process.env.PYTHON_BACKEND_URL && !process.env.PYTHON_BACKEND_URL.includes(ACTIVE_BACKEND_URL)) {
  failures.push(
    `PYTHON_BACKEND_URL must point at ${ACTIVE_BACKEND_URL}; found ${process.env.PYTHON_BACKEND_URL}`,
  );
}

if (process.env.BACKEND_URL && !process.env.BACKEND_URL.includes(ACTIVE_BACKEND_URL)) {
  failures.push(`BACKEND_URL must point at ${ACTIVE_BACKEND_URL}; found ${process.env.BACKEND_URL}`);
}

if (failures.length > 0) {
  console.error("Active backend URL guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log(`Active backend URL guardrail passed: ${ACTIVE_BACKEND_URL}`);
