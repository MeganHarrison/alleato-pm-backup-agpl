#!/usr/bin/env node
/**
 * Audit: Route Param Conflicts (Rule 2)
 *
 * Walks frontend/src/app/** and finds dynamic route segments using the generic
 * [id] name. Each match should be renamed to a specific parameter name
 * (e.g. [projectId], [contractId]) matching the parent resource.
 *
 * Output:
 *   <route path>\t[id]\t[suggestedParam]
 *
 * Always exits 0.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const APP_ROOT = path.join(REPO_ROOT, "frontend", "src", "app");

const SKIP_DIR = new Set(["node_modules", ".next", "dist", "build", "__tests__"]);

// singular/plural heuristics
const PLURAL_TO_SINGULAR = {
  projects: "project",
  contracts: "contract",
  companies: "company",
  users: "user",
  records: "record",
  invoices: "invoice",
  subcontracts: "subcontract",
  "purchase-orders": "purchaseOrder",
  "change-orders": "changeOrder",
  "change-events": "changeEvent",
  "prime-contracts": "primeContract",
  submittals: "submittal",
  rfis: "rfi",
  drawings: "drawing",
  photos: "photo",
  documents: "document",
  tasks: "task",
  meetings: "meeting",
  vendors: "vendor",
  items: "item",
  specifications: "specification",
  "daily-logs": "dailyLog",
  "punch-items": "punchItem",
  "budget-lines": "budgetLine",
  emails: "email",
};

function camel(word) {
  return word.replace(/-([a-z])/g, (_, c) => c.toUpperCase());
}

function suggestName(parentSegment) {
  if (!parentSegment) return "recordId";
  const lower = parentSegment.toLowerCase();
  const singular = PLURAL_TO_SINGULAR[lower] || camel(lower).replace(/s$/, "");
  return `${singular}Id`;
}

async function* walkDirs(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    if (!e.isDirectory()) continue;
    if (SKIP_DIR.has(e.name) || e.name.startsWith(".")) continue;
    const full = path.join(dir, e.name);
    yield full;
    yield* walkDirs(full);
  }
}

function rel(p) {
  return path.relative(REPO_ROOT, p);
}

async function main() {
  const violations = [];

  for await (const d of walkDirs(APP_ROOT)) {
    const base = path.basename(d);
    if (base !== "[id]") continue;

    const parent = path.basename(path.dirname(d));
    const suggested = suggestName(parent);
    violations.push({
      dir: rel(d),
      current: "[id]",
      suggested: `[${suggested}]`,
      parent,
    });
  }

  console.log("=== Route Param Conflicts Audit ===");
  console.log(`Generic [id] param segments found: ${violations.length}`);
  console.log("");
  console.log("directory\tcurrent\tsuggested\tparentSegment");
  for (const v of violations.sort((a, b) => a.dir.localeCompare(b.dir))) {
    console.log(`${v.dir}\t${v.current}\t${v.suggested}\t${v.parent}`);
  }
}

main().catch((err) => {
  console.error("audit-route-param-conflicts failed:", err?.message || err);
  process.exit(0);
});
