#!/usr/bin/env tsx

import fs from "node:fs";
import path from "node:path";
import { execFileSync } from "node:child_process";

const FRONTEND_ROOT = process.cwd();
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

type AuditIssue = {
  kind: "placeholder" | "placeholder-copy" | "status-enum";
  file: string;
  detail: string;
};

function walk(dir: string): string[] {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  const files: string[] = [];
  for (const entry of entries) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      files.push(...walk(abs));
      continue;
    }
    files.push(abs);
  }
  return files;
}

function rel(absPath: string): string {
  return path.relative(FRONTEND_ROOT, absPath).replace(/\\/g, "/");
}

function extractQuotedValues(raw: string): string[] {
  const values: string[] = [];
  const quoteRegex = /["']([^"']+)["']/g;
  let match: RegExpExecArray | null = quoteRegex.exec(raw);
  while (match) {
    values.push(match[1]);
    match = quoteRegex.exec(raw);
  }
  return values;
}

function parseConstArray(filePath: string, constName: string): string[] {
  const source = fs.readFileSync(filePath, "utf8");
  const re = new RegExp(
    `export\\s+const\\s+${constName}\\s*=\\s*\\[([\\s\\S]*?)\\]\\s+as\\s+const`,
    "m",
  );
  const match = re.exec(source);
  if (!match) return [];
  return extractQuotedValues(match[1]);
}

function parseConstraintValues(definition: string): string[] {
  const snippet = definition;
  const arrayMatch = /ARRAY\[([\s\S]*?)\]/.exec(snippet);
  if (!arrayMatch) return [];

  const values: string[] = [];
  const sqlString = /'([^']+)'::/g;
  let match: RegExpExecArray | null = sqlString.exec(arrayMatch[1]);
  while (match) {
    values.push(match[1]);
    match = sqlString.exec(arrayMatch[1]);
  }
  return values;
}

function loadLiveConstraintValues(constraintName: string): string[] {
  const sql = `select pg_get_constraintdef(oid, true) as definition from pg_constraint where connamespace = 'public'::regnamespace and conname = '${constraintName}'`;
  try {
    const output = execFileSync("npx", ["supabase", "db", "query", "--linked", "--output", "json", sql], {
      cwd: path.join(FRONTEND_ROOT, ".."), encoding: "utf8",
    });
    const payload = JSON.parse(output.slice(output.indexOf("{"))) as { rows?: Array<{ definition?: string }> };
    return parseConstraintValues(payload.rows?.[0]?.definition ?? "");
  } catch {
    return [];
  }
}

function isSharedFormPrimitive(file: string): boolean {
  const relative = rel(file);
  if (relative.includes(".stories.")) return false;
  return (
    relative.startsWith("src/components/forms/") ||
    relative.startsWith("src/components/ui/")
  );
}

function extractStaticPlaceholderValues(source: string): string[] {
  const values: string[] = [];
  const patterns = [
    /\bplaceholder\s*=\s*["']([^"']*)["']/g,
    /\bplaceholder\s*:\s*["']([^"']*)["']/g,
    /\bsearchPlaceholder\s*=\s*["']([^"']*)["']/g,
    /\bsearchPlaceholder\s*:\s*["']([^"']*)["']/g,
  ];

  for (const pattern of patterns) {
    let match: RegExpExecArray | null = pattern.exec(source);
    while (match) {
      values.push(match[1].trim());
      match = pattern.exec(source);
    }
  }

  return values;
}

function isAllowedPlaceholderCopy(value: string): boolean {
  if (!value) return true;
  const normalized = value.trim();
  const lower = normalized.toLowerCase();

  if (/^e\.g\.\s+\S+/.test(lower)) return true;
  if (/^search(\s|$)/.test(lower)) return true;
  if (/^select(\s|$|\.{3}$)/.test(lower)) return true;
  if (/^(pick|set)\s/.test(lower)) return true;
  if (/^loading/.test(lower)) return true;
  if (/^not set$/.test(lower)) return true;
  if (/^[-—]+$/.test(normalized)) return true;
  if (/^(m{1,2}|d{1,2}|y{2,4})([/-](m{1,2}|d{1,2}|y{2,4}))+$/i.test(normalized)) return true;
  if (/^[\w.%+-]+@[\w.-]+\.[a-z]{2,}$/i.test(normalized)) return true;
  if (/^\(?\d{3}\)?[-\s]\d{3}[-\s]\d{4}$/.test(normalized)) return true;

  return false;
}

function main() {
  const issues: AuditIssue[] = [];
  const allFiles = walk(SRC_ROOT).filter((f) => /\.(tsx?|jsx?)$/.test(f));

  const placeholderPatterns = [
    /placeholder\s*=\s*["']0["']/g,
    /placeholder\s*=\s*["']0\.0["']/g,
    /placeholder\s*=\s*["']0\.00["']/g,
    /placeholder\s*=\s*["']\$0\.00["']/g,
  ];

  // NumberInput's clearZeroOnFocus renders a zero VALUE as greyed placeholder
  // text ("Treat zero as placeholder in percent inputs") — files using that
  // pattern legitimately pair it with placeholder="0".
  const usesClearZeroOnFocus = (source: string) => source.includes("clearZeroOnFocus");
  const isZeroLikePlaceholder = (value: string) => /^\$?0(\.0{1,2})?$/.test(value.trim());

  for (const file of allFiles) {
    const source = fs.readFileSync(file, "utf8");
    if (usesClearZeroOnFocus(source)) continue;
    for (const pattern of placeholderPatterns) {
      if (!pattern.test(source)) continue;
      issues.push({
        kind: "placeholder",
        file: rel(file),
        detail:
          "numeric placeholder uses a literal zero value; leave placeholder empty for editable numeric fields",
      });
      break;
    }
  }

  for (const file of allFiles.filter(isSharedFormPrimitive)) {
    const source = fs.readFileSync(file, "utf8");
    const invalidPlaceholders = extractStaticPlaceholderValues(source).filter(
      (value) =>
        !isAllowedPlaceholderCopy(value) &&
        !(usesClearZeroOnFocus(source) && isZeroLikePlaceholder(value)),
    );
    if (!invalidPlaceholders.length) continue;

    issues.push({
      kind: "placeholder-copy",
      file: rel(file),
      detail:
        "placeholder copy must be short example text, a select/search action, loading text, or a date/contact format; avoid using placeholders as labels or instructions: " +
        invalidPlaceholders.map((value) => `"${value}"`).join(", "),
    });
  }

  const statusEnumChecks = [
    {
      schemaFile: path.join(
        FRONTEND_ROOT,
        "src/lib/schemas/create-subcontract-schema.ts",
      ),
      constName: "CommitmentStatusValues",
      constraintName: "subcontracts_status_check",
    },
  ];

  for (const check of statusEnumChecks) {
    const schemaValues = parseConstArray(check.schemaFile, check.constName);
    const dbValues = loadLiveConstraintValues(check.constraintName);
    if (!schemaValues.length || !dbValues.length) continue;

    const schemaSet = new Set(schemaValues);
    const dbSet = new Set(dbValues);

    const extra = schemaValues.filter((v) => !dbSet.has(v));
    const missing = dbValues.filter((v) => !schemaSet.has(v));
    if (!extra.length && !missing.length) continue;

    issues.push({
      kind: "status-enum",
      file: rel(check.schemaFile),
      detail: [
        `status enum does not match DB constraint ${check.constraintName}`,
        extra.length ? `extra in schema: ${extra.join(", ")}` : "",
        missing.length ? `missing from schema: ${missing.join(", ")}` : "",
      ]
        .filter(Boolean)
        .join(" | "),
    });
  }

  if (!issues.length) {
    console.log("Form-field standards audit: ✓ no issues found");
    return;
  }

  console.log(`Form-field standards audit: found ${issues.length} issue(s)\n`);
  for (const issue of issues) {
    console.log(`[${issue.kind}] ${issue.file}`);
    console.log(`  ${issue.detail}`);
  }

  process.exitCode = 1;
}

main();
