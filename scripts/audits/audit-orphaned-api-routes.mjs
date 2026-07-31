#!/usr/bin/env node
// Audit: Orphaned API routes
// Finds route.ts files under frontend/src/app/api that have no callers in frontend/src.
// Pure static analysis. Reports (route file, derived URL pattern) for possibly-orphaned routes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this file's location, not a hardcoded absolute path.
const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const SRC = join(ROOT, "frontend/src");
const API_ROOT = join(SRC, "app/api");

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
      if (ent.name === "node_modules" || ent.name === ".next" || ent.name === "__tests__") continue;
      walk(full, out);
    } else if (ent.isFile()) {
      out.push(full);
    }
  }
  return out;
}

function routeFileToPath(file) {
  // frontend/src/app/api/foo/[id]/bar/route.ts -> /api/foo/[id]/bar
  const rel = relative(join(SRC, "app"), file);
  const withoutFile = rel.replace(/\/route\.ts$/, "");
  return "/" + withoutFile;
}

function toSegments(urlPattern) {
  // Strip /api prefix and return array of segments, marking params
  const parts = urlPattern.split("/").filter(Boolean);
  return parts;
}

// Gather all route files
const allFiles = walk(API_ROOT);
const routeFiles = allFiles.filter((f) => f.endsWith("/route.ts") || f.endsWith("/route.tsx"));

if (routeFiles.length === 0) {
  console.error(
    `ERROR: scanned 0 route files under ${API_ROOT}. Broken audit (wrong/empty path), not a clean result.`,
  );
  process.exit(2);
}

// Gather all source files to search (excluding the route files themselves and tests)
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

// Read all source file contents once (small enough)
const srcContents = new Map();
for (const f of allSrc) {
  try {
    srcContents.set(f, readFileSync(f, "utf8"));
  } catch {
    // skip unreadable
  }
}

// For each route, build a regex and search
const orphans = [];
const borderline = [];

for (const rf of routeFiles) {
  const urlPattern = routeFileToPath(rf); // e.g. /api/projects/[projectId]/budget
  const segments = toSegments(urlPattern); // [api, projects, [projectId], budget]

  // Build regex: /api/projects/[^"'`\s]+/budget or literal segments
  // Treat [param] or [...param] as "any non-slash chunk"
  const regexParts = segments.map((s) => {
    if (s.startsWith("[") && s.endsWith("]")) {
      return "[^/\"'`\\s?)]+";
    }
    return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  });
  const pattern = "/" + regexParts.join("/");
  const re = new RegExp(pattern);

  // Also search for a "canonical" literal path search using just the non-param segments
  // For secondary match: check if the last meaningful segment appears in any template string
  let found = false;
  let foundWhere = null;

  for (const [file, content] of srcContents) {
    if (file === rf) continue;
    if (re.test(content)) {
      found = true;
      foundWhere = file;
      break;
    }
  }

  if (!found) {
    // Try a looser search: the last 1-2 non-param segments joined literally, preceded by /
    const lastLiterals = [];
    for (let i = segments.length - 1; i >= 0 && lastLiterals.length < 3; i--) {
      const s = segments[i];
      if (!(s.startsWith("[") && s.endsWith("]"))) {
        lastLiterals.unshift(s);
      } else if (lastLiterals.length > 0) {
        break;
      }
    }
    if (lastLiterals.length > 0) {
      const looseRe = new RegExp("/" + lastLiterals.map((s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")).join("/"));
      for (const [file, content] of srcContents) {
        if (file === rf) continue;
        if (looseRe.test(content)) {
          // found by loose match — mark as borderline, not orphan
          borderline.push({ route: rf, urlPattern, matchedBy: "loose", witness: file });
          found = true;
          break;
        }
      }
    }
    if (!found) {
      orphans.push({ route: rf, urlPattern });
    }
  }
}

console.log("=== Orphaned API routes (no callers found via static analysis) ===");
console.log(`Total routes scanned: ${routeFiles.length}`);
console.log(`Orphaned: ${orphans.length}`);
console.log(`Borderline (only matched by loose segment search): ${borderline.length}`);
console.log("");
console.log("-- Orphans --");
for (const o of orphans) {
  console.log(`${relative(ROOT, o.route)}\t${o.urlPattern}`);
}
console.log("");
console.log("-- Borderline --");
for (const b of borderline) {
  console.log(`${relative(ROOT, b.route)}\t${b.urlPattern}\t(loose match in ${relative(ROOT, b.witness)})`);
}

process.exit(0);
