#!/usr/bin/env node
// Audit: Orphaned hooks
// Finds exported hooks in frontend/src/hooks/ with no importers elsewhere in frontend/src.

import { readdirSync, readFileSync } from "node:fs";
import { join, relative, basename } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this file's location, not a hardcoded absolute path.
const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const SRC = join(ROOT, "frontend/src");
const HOOKS_ROOT = join(SRC, "hooks");

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

const hookFiles = walk(HOOKS_ROOT).filter(
  (f) =>
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.endsWith(".d.ts") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx") &&
    !f.endsWith(".spec.ts") &&
    !f.endsWith(".spec.tsx") &&
    !f.includes("/__tests__/")
);

if (hookFiles.length === 0) {
  console.error(
    `ERROR: scanned 0 hook files under ${HOOKS_ROOT}. Broken audit (wrong/empty path), not a clean result.`,
  );
  process.exit(2);
}

// Extract exports per hook file
function extractExports(content, file) {
  const exports = new Set();
  // export function useXxx
  for (const m of content.matchAll(/export\s+(?:async\s+)?function\s+(use[A-Z]\w*)/g)) {
    exports.add(m[1]);
  }
  // export const useXxx =
  for (const m of content.matchAll(/export\s+const\s+(use[A-Z]\w*)\s*[:=]/g)) {
    exports.add(m[1]);
  }
  // export { useXxx, useYyy } (re-exports)
  for (const m of content.matchAll(/export\s*\{([^}]+)\}/g)) {
    const names = m[1].split(",").map((s) => s.trim().split(/\s+as\s+/).pop().trim());
    for (const n of names) {
      if (/^use[A-Z]/.test(n)) exports.add(n);
    }
  }
  // export default — record file's basename as a pseudo-name
  if (/export\s+default\s/.test(content)) {
    const base = basename(file).replace(/\.(ts|tsx)$/, "");
    // Default exports are referenced by importer-chosen name; we'll use file path as the key instead
    exports.add(`__default__:${base}`);
  }
  return exports;
}

// Collect all candidate exports
const candidates = []; // { file, exportName, isDefault }
for (const hf of hookFiles) {
  let content;
  try {
    content = readFileSync(hf, "utf8");
  } catch {
    continue;
  }
  const exs = extractExports(content, hf);
  for (const ex of exs) {
    if (ex.startsWith("__default__:")) {
      candidates.push({ file: hf, exportName: ex.slice("__default__:".length), isDefault: true });
    } else {
      candidates.push({ file: hf, exportName: ex, isDefault: false });
    }
  }
}

// Read all other source files
const allSrc = walk(SRC).filter(
  (f) =>
    (f.endsWith(".ts") || f.endsWith(".tsx")) &&
    !f.endsWith(".d.ts") &&
    !f.includes("/__tests__/") &&
    !f.endsWith(".test.ts") &&
    !f.endsWith(".test.tsx") &&
    !f.endsWith(".spec.ts") &&
    !f.endsWith(".spec.tsx")
);

const srcContents = new Map();
for (const f of allSrc) {
  try {
    srcContents.set(f, readFileSync(f, "utf8"));
  } catch {
    // skip
  }
}

// Build an import-path matcher for a given hook file:
// path like @/hooks/use-foo or relative ../hooks/use-foo
function importPathsFor(file) {
  // frontend/src/hooks/use-foo.ts -> @/hooks/use-foo
  const relFromSrc = relative(SRC, file).replace(/\.(ts|tsx)$/, "");
  const aliased = "@/" + relFromSrc;
  const bare = relFromSrc; // might also appear as "hooks/use-foo" (unlikely)
  const base = basename(file).replace(/\.(ts|tsx)$/, "");
  return { aliased, base };
}

const orphans = [];
const maybe = [];

for (const c of candidates) {
  const { file, exportName, isDefault } = c;
  const { aliased, base } = importPathsFor(file);
  let usage = 0;
  let witness = null;

  // build regexes
  // 1) Import from the module path where this export is used (named or default)
  const pathEsc = aliased.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const importPathRe = new RegExp(`from\\s+["'\`](${pathEsc}|[^"'\`]*?${base.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")})["'\`]`);

  // 2) For named exports: also require the name appears in that file
  for (const [sfile, content] of srcContents) {
    if (sfile === file) continue;
    if (importPathRe.test(content)) {
      if (isDefault) {
        usage++;
        witness = sfile;
        break;
      } else {
        // Check the export name also appears (import { useXxx } or destructure)
        const nameRe = new RegExp(`\\b${exportName}\\b`);
        if (nameRe.test(content)) {
          usage++;
          witness = sfile;
          break;
        }
      }
    }
    // Also support barrel imports: `from "@/hooks"` and then `useXxx` referenced
    if (!isDefault) {
      if (/from\s+["'`]@\/hooks["'`]/.test(content)) {
        const nameRe = new RegExp(`\\b${exportName}\\b`);
        if (nameRe.test(content)) {
          usage++;
          witness = sfile;
          break;
        }
      }
    }
  }

  if (usage === 0) {
    orphans.push({ file, exportName, isDefault });
  }
}

console.log("=== Orphaned hooks ===");
console.log(`Hook files scanned: ${hookFiles.length}`);
console.log(`Candidate exports: ${candidates.length}`);
console.log(`Orphaned: ${orphans.length}`);
console.log("");
for (const o of orphans) {
  const tag = o.isDefault ? " (default)" : "";
  console.log(`${relative(ROOT, o.file)}\t${o.exportName}${tag}`);
}

process.exit(0);
