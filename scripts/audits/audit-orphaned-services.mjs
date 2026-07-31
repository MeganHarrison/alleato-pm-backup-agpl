#!/usr/bin/env node
// Audit: Orphaned services and lib utilities
// Finds exported symbols in frontend/src/services/ and frontend/src/lib/ with no importers.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this file's location, not a hardcoded absolute path.
const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const SRC = join(ROOT, "frontend/src");
const SERVICES_ROOT = join(SRC, "services");
const LIB_ROOT = join(SRC, "lib");

function walk(dir, out = []) {
  let entries;
  try {
    entries = readdirSync(dir, { withFileTypes: true });
  } catch {
    return out;
  }
  for (const ent of entries) {
    const full = join(dir, ent.name);
    if (ent.isDirectory()) {
      if (ent.name === "node_modules" || ent.name === ".next") continue;
      walk(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function isCodeFile(f) {
  return (
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.endsWith(".d.ts") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx") &&
    !f.endsWith(".spec.ts") &&
    !f.endsWith(".spec.tsx") &&
    !f.includes("/__tests__/")
  );
}

// Skip type-only files in lib
function isTypeOnlyFile(f) {
  const b = basename(f);
  return b.endsWith(".types.ts") || b === "types.ts" || b === "database.types.ts";
}

const serviceFiles = walk(SERVICES_ROOT).filter(isCodeFile);
const libFiles = walk(LIB_ROOT).filter((f) => isCodeFile(f) && !isTypeOnlyFile(f));

const targetFiles = [...serviceFiles, ...libFiles];

if (targetFiles.length === 0) {
  console.error(
    `ERROR: scanned 0 service/lib files under ${SERVICES_ROOT} + ${LIB_ROOT}. Broken audit (wrong/empty path), not a clean result.`,
  );
  process.exit(2);
}

function extractExports(content, file) {
  const exports = new Set();
  // export function Name
  for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  // export const Name =
  for (const m of content.matchAll(/export\s+const\s+(\w+)\s*[:=]/g)) {
    exports.add(m[1]);
  }
  // export class Name
  for (const m of content.matchAll(/export\s+class\s+(\w+)/g)) {
    exports.add(m[1]);
  }
  // export { a, b as c }
  for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim());
    for (const n of names) {
      if (n && /^[A-Za-z_]\w*$/.test(n)) exports.add(n);
    }
  }
  // export default
  if (/export\s+default\s/.test(content)) {
    const base = basename(file).replace(/\.(ts|tsx)$/, "");
    exports.add(`__default__:${base}`);
  }
  return exports;
}

const candidates = [];
for (const f of targetFiles) {
  let content;
  try {
    content = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  const exs = extractExports(content, f);
  if (exs.size === 0) {
    // file with no exports — record anyway as "file with no exports"
    candidates.push({ file: f, exportName: "<no exports>", isDefault: false, noExports: true });
    continue;
  }
  for (const ex of exs) {
    if (ex.startsWith("__default__:")) {
      candidates.push({ file: f, exportName: ex.slice("__default__:".length), isDefault: true });
    } else {
      candidates.push({ file: f, exportName: ex, isDefault: false });
    }
  }
}

const allSrc = walk(SRC).filter(isCodeFile);
const srcContents = new Map();
for (const f of allSrc) {
  try {
    srcContents.set(f, readFileSync(f, "utf8"));
  } catch {
    // skip
  }
}

function importMatchersFor(file) {
  const relFromSrc = relative(SRC, file).replace(/\.(ts|tsx)$/, "");
  const aliased = "@/" + relFromSrc;
  const base = basename(file).replace(/\.(ts|tsx)$/, "");
  // also handle index.ts folder imports
  let folderImport = null;
  if (basename(file).startsWith("index.")) {
    folderImport = "@/" + relative(SRC, file.replace(/\/index\.(ts|tsx)$/, ""));
  }
  return { aliased, base, folderImport };
}

const orphans = [];
for (const c of candidates) {
  const { file, exportName, isDefault, noExports } = c;
  const { aliased, base, folderImport } = importMatchersFor(file);

  let usage = 0;
  const aliasedEsc = aliased.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const baseEsc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const folderEsc = folderImport ? folderImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;

  // Path match: import from the file
  const pathRe = new RegExp(
    `from\\s+["'\`](${aliasedEsc}|[^"'\`]*?/${baseEsc}${folderEsc ? "|" + folderEsc : ""})["'\`]`
  );

  for (const [sfile, content] of srcContents) {
    if (sfile === file) continue;
    if (pathRe.test(content)) {
      if (noExports || isDefault) {
        usage++;
        break;
      }
      // verify the name appears too
      const nameRe = new RegExp(`\\b${exportName}\\b`);
      if (nameRe.test(content)) {
        usage++;
        break;
      }
    }
  }

  if (usage === 0) {
    orphans.push(c);
  }
}

console.log("=== Orphaned services / lib utils ===");
console.log(`Files scanned: ${targetFiles.length}`);
console.log(`Candidate exports: ${candidates.length}`);
console.log(`Orphaned: ${orphans.length}`);
console.log("");
for (const o of orphans) {
  const tag = o.isDefault ? " (default)" : o.noExports ? " (no exports)" : "";
  console.log(`${relative(ROOT, o.file)}\t${o.exportName}${tag}`);
}

process.exit(0);
