#!/usr/bin/env node
/**
 * Audit: Form ↔ Database FK Mismatches (Rule 11)
 *
 * Heuristic audit. Steps:
 *
 * 1. Parse database.types.ts for all Relationships entries to build
 *    a map:  `${table}.${column}` → { referencedRelation, referencedColumns }
 *    (only capturing *_id columns for readability).
 *
 * 2. Walk form files (anything under frontend/src/components/** whose filename
 *    ends in -form.tsx / Form.tsx, or lives under a `/forms/` path segment).
 *
 * 3. In each form, find `name="*_id"` occurrences inside JSX — these are
 *    typically hooked up to react-hook-form fields that write to a DB column.
 *    For each such name, scan the file for API fetch origins:
 *        /api/<plural>, /api/companies, /api/vendors, /api/budget_lines, ...
 *    We compare those endpoints against the FK relationship captured in step 1.
 *
 * 4. If the form references a `*_id` whose FK target (from the relationships
 *    map) looks different from any `/api/<resource>` referenced in the same
 *    file, flag it as a suspected mismatch.
 *
 * NOTE: This is best-effort. False positives occur when:
 *   - multiple tables share the column name,
 *   - the dropdown data is loaded via a custom hook name (not /api/...),
 *   - the table isn't explicitly associated with one fetch endpoint.
 *   - the `*_id` is not actually a DB column (e.g. selection state).
 *
 * Known true-positive seeds:
 *   - `budget_code_id`  → FK budget_lines;  dropdowns often load project_budget_codes
 *   - `vendor_id`       → FK companies;     dropdowns often load vendors
 *
 * Output: suspected mismatches, with all evidence (fk target + endpoints seen).
 * Always exits 0.
 */

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const REPO_ROOT = path.resolve(__dirname, "..", "..");
const COMPONENTS_ROOT = path.join(REPO_ROOT, "frontend", "src", "components");
const DOMAIN_ROOT = path.join(REPO_ROOT, "frontend", "src", "components", "domain");
const TYPES_FILE = path.join(
  REPO_ROOT,
  "frontend",
  "src",
  "types",
  "database.types.ts"
);

const SKIP_DIR = new Set(["node_modules", ".next", "dist", "build", "__tests__", "__generated__"]);
const EXT_OK = new Set([".ts", ".tsx"]);

// Known mismatch signatures: column → expected dropdown source that is WRONG
const KNOWN_MISMATCHES = {
  budget_code_id: {
    fkTargets: ["budget_lines"],
    wrongSources: ["project_budget_codes", "cost_codes"],
  },
  vendor_id: {
    fkTargets: ["companies"],
    wrongSources: ["vendors"],
  },
};

// Parse Relationships blocks in the generated types file.
// We'll capture per-table foreign keys: tableName → { column → referencedRelation }
async function parseRelationships() {
  const text = await fs.readFile(TYPES_FILE, "utf8");
  const lines = text.split("\n");
  const rels = new Map(); // `${table}.${column}` → referencedRelation
  const columnAllRefs = new Map(); // column → Set<referencedRelation> (aggregate fallback)

  let currentTable = null;
  let inRelationships = false;
  let currentCols = null;
  let currentRef = null;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Detect start of a table at 6-space indent `      table_name: {`
    const tableMatch = line.match(/^ {6}([a-zA-Z_][a-zA-Z0-9_]*): \{$/);
    if (tableMatch && !currentTable) {
      currentTable = tableMatch[1];
      continue;
    }

    // End of table `      }` at 6-space indent
    if (currentTable && /^ {6}\}$/.test(line)) {
      currentTable = null;
      inRelationships = false;
      continue;
    }

    // Enter Relationships block
    if (currentTable && /^ {8}Relationships: \[/.test(line)) {
      inRelationships = true;
      continue;
    }
    if (currentTable && inRelationships && /^ {8}\]/.test(line)) {
      inRelationships = false;
      continue;
    }

    if (!inRelationships || !currentTable) continue;

    // Lines inside Relationships array
    const colsMatch = line.match(/columns:\s*\[(.*)\]/);
    if (colsMatch) {
      currentCols = colsMatch[1]
        .split(",")
        .map((s) => s.trim().replace(/^["']|["']$/g, ""))
        .filter(Boolean);
    }
    const refRelMatch = line.match(/referencedRelation:\s*["']([^"']+)["']/);
    if (refRelMatch) {
      currentRef = refRelMatch[1];
    }
    // End of a relationship entry
    if (line.includes("},") || line.trim() === "}") {
      if (currentCols && currentRef) {
        for (const col of currentCols) {
          const key = `${currentTable}.${col}`;
          if (!rels.has(key)) rels.set(key, currentRef);
          if (!columnAllRefs.has(col)) columnAllRefs.set(col, new Set());
          columnAllRefs.get(col).add(currentRef);
        }
      }
      currentCols = null;
      currentRef = null;
    }
  }

  return { rels, columnAllRefs };
}

async function* walkFiles(dir) {
  let entries;
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const e of entries) {
    const full = path.join(dir, e.name);
    if (e.isDirectory()) {
      if (SKIP_DIR.has(e.name) || e.name.startsWith(".")) continue;
      yield* walkFiles(full);
    } else if (e.isFile() && EXT_OK.has(path.extname(e.name))) {
      yield full;
    }
  }
}

function looksLikeFormFile(absPath) {
  const lower = absPath.toLowerCase();
  const base = path.basename(lower);
  // kebab-case: foo-form.tsx or foo-form.ts
  if (base.endsWith("-form.tsx") || base.endsWith("-form.ts")) return true;
  // PascalCase / camelCase: FooForm.tsx, fooForm.tsx — ends in "form.tsx"
  if (base.endsWith("form.tsx") || base.endsWith("form.ts")) return true;
  // ...FormDialog.tsx / ...FormPanel.tsx — common dialog-based forms
  if (base.includes("formdialog") || base.includes("formpanel")) return true;
  // anything inside a /forms/ directory
  if (lower.includes(path.sep + "forms" + path.sep)) return true;
  // anything inside a /change-event-form/ or similar sub-directory
  if (lower.includes("-form" + path.sep)) return true;
  return false;
}

function rel(p) {
  return path.relative(REPO_ROOT, p);
}

// Given a relation name that could be a view name (like prime_contract_financial_summary),
// collapse known view-suffixed names to a table name heuristically.
function normalizeRelation(rel) {
  return rel
    .replace(/_summary$/, "")
    .replace(/_view$/, "");
}

function scanFormFile(text) {
  // Find all name="..._id"
  const nameIdRe = /name=["']([a-z_][a-z0-9_]*_id)["']/g;
  const names = new Set();
  let m;
  while ((m = nameIdRe.exec(text)) !== null) names.add(m[1]);

  // Find API endpoints referenced — capture every static path segment
  // so nested routes like /api/projects/${id}/vendors expose "vendors".
  const apiRe = /\/api\/([A-Za-z0-9_\-\/\$\{\}\.]+)/g;
  const endpoints = new Set();
  while ((m = apiRe.exec(text)) !== null) {
    const segs = m[1].split("/");
    for (const raw of segs) {
      // Drop obvious dynamic segments: ${...}, [id], :id, blank
      if (!raw) continue;
      if (raw.includes("$") || raw.startsWith("[") || raw.startsWith(":")) continue;
      const cleaned = raw.replace(/[?`"'].*$/, "").trim();
      if (!cleaned) continue;
      if (/^[A-Za-z][A-Za-z0-9_\-]*$/.test(cleaned)) endpoints.add(cleaned);
    }
  }

  // Also look for hook names: useVendorsQuery, useCompaniesQuery, useProjectCostCodes...
  const hookRe = /\buse([A-Z][A-Za-z0-9]+?)(?:Query|List|Options|Data)\b/g;
  const hooks = new Set();
  while ((m = hookRe.exec(text)) !== null) hooks.add(m[1].toLowerCase());

  return { names: [...names], endpoints: [...endpoints], hooks: [...hooks] };
}

async function main() {
  const { rels, columnAllRefs } = await parseRelationships();

  // Collect all candidate forms
  const forms = [];
  for await (const f of walkFiles(COMPONENTS_ROOT)) {
    if (looksLikeFormFile(f)) forms.push(f);
  }

  const suspectedMismatches = [];
  const knownHits = [];
  let formsScanned = 0;

  for (const form of forms) {
    let text;
    try {
      text = await fs.readFile(form, "utf8");
    } catch {
      continue;
    }
    formsScanned++;

    const { names, endpoints, hooks } = scanFormFile(text);
    if (names.length === 0) continue;

    for (const name of names) {
      // Known seed mismatches
      const known = KNOWN_MISMATCHES[name];
      if (known) {
        const wrongSourcePresent = known.wrongSources.some(
          (s) => endpoints.includes(s) || endpoints.includes(s.replace(/_/g, "-")) || hooks.includes(s.replace(/_/g, ""))
        );
        const rightSourcePresent = known.fkTargets.some(
          (t) => endpoints.includes(t) || endpoints.includes(t.replace(/_/g, "-")) || hooks.includes(t.replace(/_/g, ""))
        );
        if (wrongSourcePresent && !rightSourcePresent) {
          knownHits.push({
            file: rel(form),
            column: name,
            fkTarget: known.fkTargets.join("|"),
            endpointsSeen: endpoints.join(","),
            hooksSeen: hooks.join(","),
            note: "KNOWN mismatch seed",
          });
          continue;
        }
      }

      // General heuristic: find FK target relation(s) for this column
      const refs = columnAllRefs.get(name);
      if (!refs || refs.size === 0) continue;

      const targetNames = [...refs].map(normalizeRelation);
      const targetNamesNorm = new Set(targetNames.map((t) => t.replace(/_/g, "").toLowerCase()));

      // Did we see any endpoint/hook mentioning the FK target?
      const endpointsNorm = endpoints.map((e) => e.replace(/[_\-]/g, "").toLowerCase());
      const hooksNorm = hooks.map((h) => h.replace(/[_\-]/g, "").toLowerCase());

      const targetReferenced =
        endpointsNorm.some((e) => {
          for (const t of targetNamesNorm) if (e.includes(t) || t.includes(e)) return true;
          return false;
        }) ||
        hooksNorm.some((h) => {
          for (const t of targetNamesNorm) if (h.includes(t) || t.includes(h)) return true;
          return false;
        });

      // If NOT referenced, and there ARE endpoints/hooks, flag as suspected
      if (!targetReferenced && (endpoints.length > 0 || hooks.length > 0)) {
        suspectedMismatches.push({
          file: rel(form),
          column: name,
          fkTarget: [...refs].join("|"),
          endpointsSeen: endpoints.join(","),
          hooksSeen: hooks.join(","),
        });
      }
    }
  }

  console.log("=== Form FK Mismatch Audit ===");
  console.log(`Form files scanned: ${formsScanned}`);
  console.log(`Known mismatch matches: ${knownHits.length}`);
  console.log(`Suspected mismatches (heuristic): ${suspectedMismatches.length}`);
  console.log("");
  console.log("--- KNOWN seed mismatches ---");
  console.log("file\tcolumn\tfkTarget\tendpoints\thooks");
  for (const h of knownHits) {
    console.log(`${h.file}\t${h.column}\t${h.fkTarget}\t${h.endpointsSeen}\t${h.hooksSeen}`);
  }
  console.log("");
  console.log("--- SUSPECTED mismatches (HIGH false-positive risk) ---");
  console.log("file\tcolumn\tfkTarget\tendpoints\thooks");
  for (const h of suspectedMismatches.slice(0, 200)) {
    console.log(`${h.file}\t${h.column}\t${h.fkTarget}\t${h.endpointsSeen}\t${h.hooksSeen}`);
  }
  if (suspectedMismatches.length > 200) {
    console.log(`... and ${suspectedMismatches.length - 200} more.`);
  }
}

main().catch((err) => {
  console.error("audit-form-fk-mismatches failed:", err?.message || err);
  process.exit(0);
});
