// Shared helpers for audit scripts.
// ESM, Node built-ins only.

import { readFile, readdir, stat } from "node:fs/promises";
import path from "node:path";

export const REPO_ROOT = path.resolve(
  path.dirname(new URL(import.meta.url).pathname),
  "..",
  ".."
);

export const FRONTEND_SRC = path.join(REPO_ROOT, "frontend", "src");
export const TYPES_FILE = path.join(
  REPO_ROOT,
  "frontend",
  "src",
  "types",
  "database.types.ts"
);
export const MIGRATIONS_DIR = path.join(REPO_ROOT, "supabase", "migrations");

/**
 * Walk a directory recursively and yield file paths matching the given extensions.
 * Skips node_modules, .next, dist, build, .turbo.
 */
export async function* walkFiles(dir, extensions = [".ts", ".tsx"]) {
  let entries;
  try {
    entries = await readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (
        entry.name === "node_modules" ||
        entry.name === ".next" ||
        entry.name === "dist" ||
        entry.name === "build" ||
        entry.name === ".turbo" ||
        entry.name.startsWith(".")
      ) {
        continue;
      }
      yield* walkFiles(full, extensions);
    } else if (entry.isFile()) {
      if (extensions.some((ext) => entry.name.endsWith(ext))) {
        yield full;
      }
    }
  }
}

/**
 * Parse the Supabase-generated database.types.ts and return the Tables + Views + Row shape.
 * Returns: { tables: Map<tableName, Set<columnName>>, views: Map<viewName, Set<columnName>> }
 *
 * Parsing strategy: walk the file line-by-line, track which section (Tables/Views/Functions/Enums) we are in,
 * and track current table name + current shape (Row/Insert/Update/Relationships). For Row blocks, capture
 * "columnName: type" lines. This is tailored to Supabase's generator output format.
 */
export async function parseDatabaseTypes(filePath = TYPES_FILE) {
  const text = await readFile(filePath, "utf8");
  const lines = text.split("\n");

  const tables = new Map(); // name -> Set<col>
  const views = new Map();

  let section = null; // "Tables" | "Views" | other
  let depth = 0; // brace depth inside public
  let inPublic = false;

  // We use a simple state: track brace depth to know where we are.
  // Look for `    Tables: {` and `    Views: {` at 4-space indent.
  // Inside, a table def is `      <name>: {` at 6 spaces, then `Row: {` at 8 spaces.
  // A column line inside Row looks like `          <col_name>: <type>` at 10 spaces.

  let currentTable = null;
  let currentShape = null; // "Row" | "Insert" | "Update" | "Relationships" | null
  let tableBraceDepth = 0;
  let shapeBraceDepth = 0;

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];

    // Section markers at 4-space indent
    const sectionMatch = line.match(/^ {4}(Tables|Views|Functions|Enums|CompositeTypes): \{/);
    if (sectionMatch) {
      section = sectionMatch[1];
      continue;
    }

    if (section !== "Tables" && section !== "Views") continue;

    // Table/View definition at 6-space indent: `      name: {`
    const tableDefMatch = line.match(/^ {6}([A-Za-z_][A-Za-z0-9_]*): \{$/);
    if (tableDefMatch && !currentTable) {
      currentTable = tableDefMatch[1];
      const target = section === "Tables" ? tables : views;
      if (!target.has(currentTable)) target.set(currentTable, new Set());
      continue;
    }

    // End of table: `      }` at 6-space indent
    if (currentTable && /^ {6}\}$/.test(line)) {
      currentTable = null;
      currentShape = null;
      continue;
    }

    // Shape start: `        Row: {` at 8-space indent
    const shapeMatch = line.match(/^ {8}(Row|Insert|Update|Relationships): \{?/);
    if (currentTable && shapeMatch) {
      currentShape = shapeMatch[1];
      continue;
    }

    // Shape end: `        }` at 8-space indent
    if (currentTable && currentShape && /^ {8}\}/.test(line)) {
      currentShape = null;
      continue;
    }

    // Column line inside Row: `          col_name: type` at 10-space indent.
    // We only capture from Row (source of truth for columns).
    if (currentTable && currentShape === "Row") {
      const colMatch = line.match(/^ {10}([A-Za-z_][A-Za-z0-9_]*)\??: /);
      if (colMatch) {
        const target = section === "Tables" ? tables : views;
        target.get(currentTable).add(colMatch[1]);
      }
    }
  }

  return { tables, views };
}

/**
 * Extract all .from("name") and .from('name') calls from source text.
 * Returns array of { line, column, name } — line/column 1-indexed.
 * Ignores dynamic args (variables, template literals with interpolation).
 */
export function extractFromCalls(text) {
  const results = [];
  const lines = text.split("\n");
  // Match .from("x") / .from('x') / .from(`x`) with no interpolation.
  const re = /\.from\(\s*(["'`])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)/g;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    let m;
    while ((m = re.exec(line)) !== null) {
      results.push({ line: i + 1, column: m.index + 1, name: m[2] });
    }
  }
  return results;
}

/**
 * Find all `.from("table")` table references in a file along with positions.
 * Also returns the call site ranges so column parsers can bind columns to tables.
 */
export function scanSupabaseCalls(text) {
  // For each .from(...) we want to find subsequent .select(...), .eq(...), .update(...), .insert(...)
  // in the same chain until a statement boundary. Simplest approach: regex scan the entire text
  // and associate calls by walking the text sequentially.
  const calls = [];
  const fromRe = /\.from\(\s*(["'`])([A-Za-z_][A-Za-z0-9_]*)\1\s*\)/g;
  let m;
  while ((m = fromRe.exec(text)) !== null) {
    calls.push({ kind: "from", name: m[2], index: m.index, end: fromRe.lastIndex });
  }
  return calls;
}

export function posToLineCol(text, index) {
  let line = 1;
  let col = 1;
  for (let i = 0; i < index && i < text.length; i++) {
    if (text[i] === "\n") {
      line++;
      col = 1;
    } else {
      col++;
    }
  }
  return { line, col };
}

export function relFromRepo(absPath) {
  return path.relative(REPO_ROOT, absPath);
}
