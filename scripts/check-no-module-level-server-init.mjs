#!/usr/bin/env node
/**
 * Guardrail: Server-side files MUST NOT initialize env-var-dependent clients
 * at the module level (top of file, outside a function).
 *
 * Why: Module-level initialization runs when Next.js IMPORTS the file during
 * `next build` page-data collection. If a required env var is absent in CI,
 * the build crashes with a cryptic error that takes hours to trace.
 *
 * Pattern that triggers this check (any of these at the top level of a file
 * that is NOT marked "use client"):
 *   const x = new SomeClass(process.env.SECRET_KEY)
 *   const x = new SomeClass({ secret: process.env.SECRET_KEY })
 *
 * Correct pattern — lazy singleton getter:
 *   let _client: SomeClass | null = null;
 *   function getClient() {
 *     if (!_client) _client = new SomeClass(process.env.SECRET_KEY!);
 *     return _client;
 *   }
 *
 * Exit 1 if violations; exit 0 if clean.
 */

import { readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = fileURLToPath(new URL(".", import.meta.url));
const ROOT = join(__dirname, "..");
const SRC_DIR = join(ROOT, "frontend/src");

// Patterns that indicate a module-level client being created with env vars.
// These are conservative — we only flag clear cases, not all const assignments.
const MODULE_LEVEL_INIT_PATTERNS = [
  // new SomeClient(process.env.XXX) at column 0-2 (i.e. not inside a function)
  /^(?:export\s+)?const\s+\w+\s*=\s*new\s+\w+\s*\(\s*(?:process\.env\.|{[^}]*process\.env\.)/m,
  // new SomeClient({ secret: process.env.XXX }) at top level
  /^(?:export\s+)?const\s+\w+\s*=\s*new\s+\w+\s*\(\s*{[^}]*process\.env\.[A-Z_]+/m,
];

// Env var names that are secrets (not NEXT_PUBLIC_*). Only these matter —
// public vars are safe to read at build time.
const SECRET_ENV_PATTERN = /process\.env\.(?!NEXT_PUBLIC_)[A-Z][A-Z0-9_]+/;

function walk(dir) {
  const entries = readdirSync(dir, { withFileTypes: true });
  const files = [];
  for (const entry of entries) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === "__tests__") continue;
      files.push(...walk(full));
    } else if (
      entry.isFile() &&
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".test.ts") &&
      !entry.name.endsWith(".spec.ts") &&
      !entry.name.endsWith(".test.tsx") &&
      !entry.name.endsWith(".spec.tsx")
    ) {
      files.push(full);
    }
  }
  return files;
}

const files = walk(SRC_DIR);
const violations = [];

for (const file of files) {
  const content = readFileSync(file, "utf8");

  // Skip client components — they can't access server env vars anyway
  if (content.startsWith('"use client"') || content.startsWith("'use client'")) continue;
  if (content.includes('"use client"') && content.indexOf('"use client"') < 100) continue;

  // Check for module-level init patterns that also reference a secret env var
  for (const pattern of MODULE_LEVEL_INIT_PATTERNS) {
    const match = content.match(pattern);
    if (match && SECRET_ENV_PATTERN.test(match[0])) {
      violations.push({ file: relative(ROOT, file), match: match[0].trim() });
      break;
    }
  }
}

if (violations.length === 0) {
  console.log("✅ no-module-level-server-init: no unsafe module-level client initializations found");
  process.exit(0);
}

console.error("❌ no-module-level-server-init: server clients initialized at module level");
console.error("   These run during `next build` when env vars are absent → build crash.");
console.error("");
console.error("   Use a lazy singleton getter instead:");
console.error("     let _client: SomeClient | null = null;");
console.error("     function getClient() {");
console.error("       if (!_client) _client = new SomeClient(process.env.SECRET_KEY!);");
console.error("       return _client;");
console.error("     }");
console.error("");
console.error("   Violations:");
for (const { file, match } of violations) {
  console.error(`     ${file}`);
  console.error(`       → ${match.slice(0, 120)}`);
}
process.exit(1);
