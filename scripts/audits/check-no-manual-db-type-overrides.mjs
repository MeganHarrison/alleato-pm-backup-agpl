#!/usr/bin/env node

/**
 * Blocks local type overrides that pretend generated Supabase table types have
 * extra columns. Those overrides hide real schema drift and can reintroduce
 * runtime-only failures when code writes columns that do not exist remotely.
 *
 * Allowed location for intentionally extended response/computed types:
 *   - frontend/src/types/database-extensions.ts
 *
 * Forbidden examples:
 *   type Foo = Database["public"]["Tables"]["bar"]["Row"] & { made_up?: string }
 *   type FooBase = Database["public"]["Tables"]["bar"]["Insert"];
 *   type Foo = FooBase & { made_up?: string };
 */

import fs from "node:fs";
import path from "node:path";

const REPO_ROOT = path.join(import.meta.dirname, "..", "..");
const FRONTEND_SRC = path.join(REPO_ROOT, "frontend", "src");
const ALLOWLIST = new Set([
  path.join("frontend", "src", "types", "database-extensions.ts"),
]);

const SCAN_EXT = /\.(ts|tsx)$/;
const DIRECT_OVERRIDE_RE =
  /Database\["public"\]\["Tables"\]\["[^"]+"\]\["(?:Row|Insert|Update)"\]\s*&\s*\{/m;
const BASE_ALIAS_RE =
  /type\s+([A-Za-z0-9_]+Base)\s*=\s*Database\["public"\]\["Tables"\]\["[^"]+"\]\["(?:Row|Insert|Update)"\]/g;
const PENDING_TYPES_COMMENT_RE =
  /pending\s+db\s+types?\s+regen|run\s+`?npm run db:types`?\s+after/i;

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, out);
      continue;
    }
    if (SCAN_EXT.test(entry.name)) out.push(full);
  }
  return out;
}

function rel(filePath) {
  return path.relative(REPO_ROOT, filePath).replace(/\\/g, "/");
}

function shouldScan(filePath) {
  const relative = rel(filePath);
  if (ALLOWLIST.has(relative)) return false;
  return (
    relative.startsWith("frontend/src/lib/db/") ||
    relative.startsWith("frontend/src/app/api/")
  );
}

function findLineNumber(source, index) {
  return source.slice(0, index).split("\n").length;
}

function scanFile(filePath) {
  const source = fs.readFileSync(filePath, "utf8");
  const violations = [];

  if (DIRECT_OVERRIDE_RE.test(source)) {
    violations.push({
      line: findLineNumber(source, source.search(DIRECT_OVERRIDE_RE)),
      reason: "direct intersection override on generated Database table type",
    });
  }

  for (const match of source.matchAll(BASE_ALIAS_RE)) {
    const alias = match[1].replace(/[$()*+.?[\\\]^{|}]/g, "\\$&");
    const chainedOverride = new RegExp(`type\\s+[A-Za-z0-9_]+\\s*=\\s*${alias}\\s*&\\s*\\{`, "m");
    const chainedMatch = chainedOverride.exec(source);
    if (chainedMatch) {
      violations.push({
        line: findLineNumber(source, chainedMatch.index),
        reason: `intersection override via ${match[1]}`,
      });
    }
  }

  const pendingMatch = PENDING_TYPES_COMMENT_RE.exec(source);
  if (pendingMatch) {
    violations.push({
      line: findLineNumber(source, pendingMatch.index),
      reason: 'comment suggests shipping with stale generated DB types',
    });
  }

  return violations;
}

function main() {
  const files = walk(FRONTEND_SRC).filter(shouldScan);
  const violations = [];

  for (const file of files) {
    for (const violation of scanFile(file)) {
      violations.push({
        file: rel(file),
        ...violation,
      });
    }
  }

  if (violations.length === 0) {
    console.log("No manual Supabase table type overrides found in guarded write surfaces.");
    return;
  }

  console.error("");
  console.error("ERROR: Manual Supabase table type overrides found.");
  console.error("These hide schema drift and allow writes to nonexistent DB columns.");
  console.error("");
  for (const violation of violations) {
    console.error(`  ${violation.file}:${violation.line}  ${violation.reason}`);
  }
  console.error("");
  console.error("Fix:");
  console.error("  1. Regenerate types with `npm run db:types` from repo root.");
  console.error("  2. Remove local Row/Insert/Update intersections in mapper/API files.");
  console.error("  3. If the field is computed or joined, move the extension into frontend/src/types/database-extensions.ts.");
  console.error("");
  process.exit(1);
}

main();
