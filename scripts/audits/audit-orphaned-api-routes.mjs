#!/usr/bin/env node
// Audit: Orphaned API routes
// Finds route.ts files under frontend/src/app/api that have no known runtime,
// test, automation, deployment, or published-contract owner in this repo.
// Pure static analysis. Reports (route file, derived URL pattern) for possibly-orphaned routes.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

// Derive repo root from this file's location, not a hardcoded absolute path.
const ROOT = join(fileURLToPath(import.meta.url), "..", "..", "..");
const SRC = join(ROOT, "frontend/src");
const API_ROOT = join(SRC, "app/api");
const EXTERNAL_ROUTES_PATH = join(ROOT, "scripts/audits/external-api-routes.json");
const CALLER_ROOTS = [
  SRC,
  join(ROOT, "frontend/tests"),
  join(ROOT, "scripts"),
  join(ROOT, ".github"),
];
const CONTRACT_FILES = [
  join(ROOT, "frontend/vercel.json"),
  join(ROOT, "frontend/public/openapi.json"),
  join(ROOT, "frontend/public/openapi.yaml"),
  join(ROOT, "render.yaml"),
];
const externalRouteManifest = JSON.parse(readFileSync(EXTERNAL_ROUTES_PATH, "utf8"));
const externalOwnershipByPath = new Map(
  externalRouteManifest.routes.map((entry) => [entry.path, entry]),
);

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

function routeFileToPath(file) {
  // frontend/src/app/api/foo/[id]/bar/route.ts -> /api/foo/[id]/bar
  // Normalize Windows separators before applying URL-oriented patterns.
  const rel = relative(join(SRC, "app"), file).replaceAll("\\", "/");
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
const routeFiles = allFiles.filter((f) => /[\\/]route\.tsx?$/.test(f));

if (routeFiles.length === 0) {
  console.error(
    `ERROR: scanned 0 route files under ${API_ROOT}. Broken audit (wrong/empty path), not a clean result.`,
  );
  process.exit(2);
}

const routePatterns = new Set(routeFiles.map(routeFileToPath));
const externalManifestPaths = externalRouteManifest.routes.map((entry) => entry.path);
const duplicateExternalPaths = externalManifestPaths.filter(
  (entry, index) => externalManifestPaths.indexOf(entry) !== index,
);
const staleExternalPaths = externalManifestPaths.filter(
  (entry) => !routePatterns.has(entry),
);
const invalidExternalEntries = externalRouteManifest.routes.filter(
  (entry) => !entry.path || !entry.owner || !entry.reason,
);
if (
  duplicateExternalPaths.length > 0 ||
  staleExternalPaths.length > 0 ||
  invalidExternalEntries.length > 0
) {
  console.error("ERROR: external API ownership manifest is invalid.");
  if (duplicateExternalPaths.length > 0) {
    console.error(`Duplicate paths: ${[...new Set(duplicateExternalPaths)].join(", ")}`);
  }
  if (staleExternalPaths.length > 0) {
    console.error(`Missing route files: ${staleExternalPaths.join(", ")}`);
  }
  if (invalidExternalEntries.length > 0) {
    console.error("Every external route requires path, owner, and reason.");
  }
  process.exit(2);
}

// Gather runtime source plus executable tests/automation and provider-facing
// contracts. Tests and deployment configuration are ownership evidence even
// when a route has no browser caller.
const callerExtensions = /\.(?:ts|tsx|js|jsx|mjs|cjs|sh|json|ya?ml)$/;
const allSrc = [
  ...CALLER_ROOTS.flatMap((root) => walk(root)),
  ...CONTRACT_FILES,
].filter(
  (f) =>
    callerExtensions.test(f) &&
    !f.endsWith(".d.ts") &&
    !f.includes("db-inventory.generated.") &&
    !f.includes("app-surface.generated.")
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
const externallyOwned = [];

for (const rf of routeFiles) {
  const urlPattern = routeFileToPath(rf); // e.g. /api/projects/[projectId]/budget
  const segments = toSegments(urlPattern); // [api, projects, [projectId], budget]

  const externalOwner = externalOwnershipByPath.get(urlPattern);
  if (externalOwner) {
    externallyOwned.push({ route: rf, urlPattern, ...externalOwner });
    continue;
  }

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
console.log(`Externally owned: ${externallyOwned.length}`);
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
console.log("");
console.log("-- Externally owned --");
for (const entry of externallyOwned) {
  console.log(`${relative(ROOT, entry.route)}\t${entry.urlPattern}\t(${entry.owner}: ${entry.reason})`);
}

process.exit(0);
