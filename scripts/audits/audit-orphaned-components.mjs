#!/usr/bin/env node
// Audit: Orphaned components
// Finds .tsx components in frontend/src/components (excluding ui/) with no importers.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this file's location (scripts/audits/x.mjs → ../../..),
// not a hardcoded absolute path that silently scans nothing on another machine/clone.
const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const SRC = join(ROOT, "frontend/src");
const COMPONENTS_ROOT = join(SRC, "components");

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
    f.endsWith(".tsx") &&
    !f.endsWith(".test.tsx") &&
    !f.endsWith(".spec.tsx") &&
    !f.includes("/__tests__/")
  );
}

// Exclude components/ui (shadcn primitives)
const componentFiles = walk(COMPONENTS_ROOT).filter(
  (f) => isCodeFile(f) && !f.startsWith(join(COMPONENTS_ROOT, "ui") + "/")
);

// Fail loudly instead of reporting "0 orphans" when the scan path is wrong —
// a zero-file scan is a broken audit, not a clean codebase.
if (componentFiles.length === 0) {
  console.error(
    `ERROR: scanned 0 component files under ${COMPONENTS_ROOT}. ` +
      `The path is wrong or empty — this is a broken audit, not a clean result.`,
  );
  process.exit(2);
}

function extractComponentExports(content, file) {
  const exports = new Set();
  // export function PascalCase
  for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+([A-Z]\w*)/g)) {
    exports.add(m[1]);
  }
  // export const PascalCase =
  for (const m of content.matchAll(/export\s+const\s+([A-Z]\w*)\s*[:=]/g)) {
    exports.add(m[1]);
  }
  // export { PascalCase }
  for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim());
    for (const n of names) {
      if (n && /^[A-Z]\w*$/.test(n)) exports.add(n);
    }
  }
  // export default — use filename
  if (/export\s+default\s/.test(content)) {
    const base = basename(file).replace(/\.tsx$/, "");
    exports.add(`__default__:${base}`);
  }
  return exports;
}

const candidates = [];
for (const f of componentFiles) {
  let content;
  try {
    content = readFileSync(f, "utf8");
  } catch {
    continue;
  }
  const exs = extractComponentExports(content, f);
  if (exs.size === 0) {
    candidates.push({ file: f, exportName: "<no component exports>", isDefault: false, noExports: true });
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

const allSrc = walk(SRC).filter(
  (f) =>
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.endsWith(".d.ts") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx") &&
    !f.endsWith(".spec.ts") &&
    !f.endsWith(".spec.tsx") &&
    !f.includes("/__tests__/")
);

const srcContents = new Map();
for (const f of allSrc) {
  try {
    srcContents.set(f, readFileSync(f, "utf8"));
  } catch {
    // skip
  }
}

function importMatchersFor(file) {
  const relFromSrc = relative(SRC, file).replace(/\.tsx$/, "");
  const aliased = "@/" + relFromSrc;
  const base = basename(file).replace(/\.tsx$/, "");
  let folderImport = null;
  if (basename(file) === "index.tsx") {
    folderImport = "@/" + relative(SRC, file.replace(/\/index\.tsx$/, ""));
  }
  return { aliased, base, folderImport };
}

// Group by file so we only check import-path once per file
const byFile = new Map();
for (const c of candidates) {
  if (!byFile.has(c.file)) byFile.set(c.file, []);
  byFile.get(c.file).push(c);
}

const orphans = [];

for (const [file, cs] of byFile) {
  const { aliased, base, folderImport } = importMatchersFor(file);
  const aliasedEsc = aliased.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const baseEsc = base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const folderEsc = folderImport ? folderImport.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") : null;

  // Check if the FILE is imported at all (by path)
  const pathRe = new RegExp(
    `from\\s+["'\`](${aliasedEsc}|[^"'\`]*?/${baseEsc}${folderEsc ? "|" + folderEsc : ""})["'\`]`
  );

  let fileImported = false;
  const importerContents = [];
  for (const [sfile, content] of srcContents) {
    if (sfile === file) continue;
    if (pathRe.test(content)) {
      fileImported = true;
      importerContents.push(content);
    }
  }

  if (!fileImported) {
    // All exports in this file are orphaned
    for (const c of cs) orphans.push(c);
    continue;
  }

  // File is imported; now check each named export individually
  for (const c of cs) {
    if (c.isDefault || c.noExports) continue; // file imported + default/no-exports -> assume used
    const nameRe = new RegExp(`\\b${c.exportName}\\b`);
    let found = false;
    for (const content of importerContents) {
      if (nameRe.test(content)) {
        found = true;
        break;
      }
    }
    if (!found) orphans.push(c);
  }
}

console.log("=== Orphaned components ===");
console.log(`Component files scanned: ${componentFiles.length}`);
console.log(`Candidate exports: ${candidates.length}`);
console.log(`Orphaned: ${orphans.length}`);
console.log("");
for (const o of orphans) {
  const tag = o.isDefault ? " (default)" : o.noExports ? " (no exports)" : "";
  console.log(`${relative(ROOT, o.file)}\t${o.exportName}${tag}`);
}

process.exit(0);
