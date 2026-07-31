#!/usr/bin/env node

/** Guarded, dry-run-first migration for simple PM-App service clients. */
import fs from "node:fs";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceRoot = path.join(root, "frontend", "src");
const write = process.argv.includes("--write");
const splitWrite = process.argv.includes("--split-write");
const inlineWrite = process.argv.includes("--inline-write");
const json = process.argv.includes("--json");
const failOnSafe = process.argv.includes("--fail-on-safe");
const failOnSplitSafe = process.argv.includes("--fail-on-split-safe");
const failOnInlineSafe = process.argv.includes("--fail-on-inline-safe");

function walk(dir) {
  const files = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const file = path.join(dir, entry.name);
    if (entry.isDirectory()) files.push(...walk(file));
    else if (/\.(ts|tsx)$/.test(entry.name) && !entry.name.endsWith(".d.ts")) files.push(file);
  }
  return files;
}

function namesBetween(source, startText, endText) {
  const start = source.indexOf(startText);
  const end = source.indexOf(endText, start);
  const section = source.slice(start, end === -1 ? source.length : end);
  return new Set([...section.matchAll(/^\s{6}([A-Za-z0-9_]+): \{/gm)].map((match) => match[1]));
}

function ragNames(source) {
  return new Set([...source.matchAll(/^\s+"([A-Za-z0-9_]+)",$/gm)].map((match) => match[1]));
}

function relative(file) {
  return path.relative(root, file).replaceAll(path.sep, "/");
}

function analyze(file, source, pmTables, ragTables) {
  const serviceImport = /import\s+\{([^}]*)\}\s+from\s+["']@\/lib\/supabase\/service["'];?/m.exec(source);
  if (!serviceImport || !/\bcreateServiceClient\b/.test(serviceImport[1])) return null;
  const importedNames = serviceImport[1]
    .split(",")
    .map((name) => name.trim().replace(/^type\s+/, ""))
    .filter(Boolean);
  const withoutServiceImport = source.replace(serviceImport[0], "");

  const reasons = [];
  if (importedNames.some((name) => name !== "createServiceClient")) {
    reasons.push("service import includes additional exports");
  }
  if (/\b(createRagServiceClient|createOutlookIntakeServiceClient)\b/.test(source)) reasons.push("also uses a RAG/Outlook factory");
  if (/\.(auth|rpc|storage|schema|channel)\b/.test(source)) reasons.push("uses client-wide/auth/RPC/storage behavior");

  const bindings = [...source.matchAll(/const\s+([A-Za-z_$][\w$]*)\s*=\s*createServiceClient\(\)\s*;/g)].map((match) => match[1]);
  if (bindings.length === 0) reasons.push("factory is passed, inline, typed, or not a simple local binding");

  const tables = [];
  const splitReasons = [];
  for (const name of bindings) {
    const fromPattern = `\\b${name}\\s*\\.\\s*from\\(\\s*[\\\"']([^\\\"']+)[\\\"']\\s*\\)`;
    const fromRe = new RegExp(fromPattern, "g");
    for (const match of source.matchAll(fromRe)) tables.push(match[1]);
    const allFromCalls = [...source.matchAll(new RegExp(`\\b${name}\\s*\\.\\s*from\\s*\\(`, "g"))].length;
    const staticFromCalls = [...source.matchAll(new RegExp(`\\b${name}\\s*\\.\\s*from\\s*\\(\\s*[\\\"']([^\\\"']+)[\\\"']\\s*\\)`, "g"))].length;
    if (allFromCalls !== staticFromCalls) splitReasons.push(`client binding '${name}' has dynamic .from(table) usage`);
    const functionParameter = new RegExp(
      `(?:function\\s+[A-Za-z_$][\\w$]*\\s*\\([^)]*\\b${name}\\b[^)]*\\)|\\([^)]*\\b${name}\\b[^)]*\\)\\s*=>)`,
      "s",
    );
    if (functionParameter.test(source)) splitReasons.push(`client binding '${name}' is a function parameter`);
    const withoutSafeUses = withoutServiceImport
      .replace(fromRe, "")
      .replace(new RegExp(`const\\s+${name}\\s*=\\s*createServiceClient\\(\\)\\s*;`, "g"), "");
    if (new RegExp(`\\b${name}\\b`).test(withoutSafeUses)) reasons.push(`client binding '${name}' is used beyond .from(table)`);
  }
  if (tables.length === 0) reasons.push("no static local .from(table) calls found");

  const unknownTables = tables.filter((table) => !pmTables.has(table));
  const ragTableMatches = tables.filter((table) => ragTables.has(table));
  if (unknownTables.length) reasons.push(`unknown/generated-type-missing tables: ${unknownTables.join(", ")}`);
  if (ragTableMatches.length) reasons.push(`RAG tables require the RAG adapter: ${ragTableMatches.join(", ")}`);
  if (/\bserviceDb\b/.test(withoutServiceImport)) splitReasons.push("serviceDb identifier already exists in the module");
  if (bindings.length === 0) splitReasons.push("no simple local service binding available for split routing");
  if (tables.length === 0) splitReasons.push("no static local .from(table) calls found for split routing");
  if (unknownTables.length) splitReasons.push(`unknown/generated-type-missing tables: ${unknownTables.join(", ")}`);

  const withoutScaffold = withoutServiceImport
    .replace(/const\s+[A-Za-z_$][\w$]*\s*=\s*createServiceClient\(\)\s*;\s*/g, "");
  if (/\bcreateServiceClient\b/.test(withoutScaffold)) reasons.push("createServiceClient remains in implementation/type usage");

  const inlineFrom = [...source.matchAll(/createServiceClient\(\)\s*\.\s*from\s*\(\s*["']([^"']+)["']\s*\)/g)].map((match) => match[1]);
  const inlineFromCalls = [...source.matchAll(/createServiceClient\(\)\s*\.\s*from\s*\(/g)].length;
  const inlineSafe = inlineFrom.length > 0
    && inlineFrom.length === inlineFromCalls
    && inlineFrom.every((table) => pmTables.has(table) || ragTables.has(table))
    && !/\bserviceDb\b/.test(withoutServiceImport);

  return {
    status: reasons.length === 0 ? "safe" : "review",
    splitSafe: splitReasons.length === 0,
    inlineSafe,
    file: relative(file),
    tables,
    bindings,
    reasons,
    splitReasons,
  };
}

function transform(source, result) {
  let next = source.replace(
    /import\s+\{[^}]*\}\s+from\s+["']@\/lib\/supabase\/service["'];?/m,
    'import { serviceDb } from "@/lib/supabase/service-db";'
  );
  for (const name of result.bindings) {
    next = next.replace(new RegExp(`const\\s+${name}\\s*=\\s*createServiceClient\\(\\)\\s*;\\n?`, "g"), "");
    next = next.replace(new RegExp(`\\b${name}\\s*\\.\\s*from\\(`, "g"), "serviceDb.from(");
  }
  return next;
}

function transformSplit(source, result) {
  let next = source;
  if (!/import\s+\{\s*serviceDb\s*\}\s+from\s+["']@\/lib\/supabase\/service-db["'];?/.test(next)) {
    const serviceImport = /import\s+\{[^}]*\}\s+from\s+["']@\/lib\/supabase\/service["'];?/m;
    next = next.replace(serviceImport, (match) => `${match}\nimport { serviceDb } from "@/lib/supabase/service-db";`);
  }
  for (const name of result.bindings) {
    next = next.replace(new RegExp(`\\b${name}\\s*\\.\\s*from\\s*(?=\\()`, "g"), "serviceDb.from");
  }
  return next;
}

function transformInline(source) {
  let next = source;
  if (!/import\s+\{\s*serviceDb\s*\}\s+from\s+["']@\/lib\/supabase\/service-db["'];?/.test(next)) {
    const serviceImport = /import\s+\{[^}]*\}\s+from\s+["']@\/lib\/supabase\/service["'];?/m;
    next = next.replace(serviceImport, (match) => `${match}\nimport { serviceDb } from "@/lib/supabase/service-db";`);
  }
  return next.replace(/createServiceClient\(\)\s*\.\s*from\s*(?=\()/g, "serviceDb.from");
}

const databaseTypes = fs.readFileSync(path.join(root, "frontend/src/types/database.types.ts"), "utf8");
const routerSource = fs.readFileSync(path.join(root, "frontend/src/lib/supabase/service-db.ts"), "utf8");
const pmTables = namesBetween(databaseTypes, "Tables: {", "Views: {");
const ragTables = ragNames(routerSource);
const results = [];

for (const file of walk(sourceRoot)) {
  const source = fs.readFileSync(file, "utf8");
  const result = analyze(file, source, pmTables, ragTables);
  if (!result) continue;
  if (result.status === "safe" && write) {
    fs.writeFileSync(file, transform(source, result));
    result.status = "written";
  } else if (result.splitSafe && splitWrite) {
    fs.writeFileSync(file, transformSplit(source, result));
    result.status = "split-written";
  } else if (result.inlineSafe && inlineWrite) {
    fs.writeFileSync(file, transformInline(source));
    result.status = "inline-written";
  }
  results.push(result);
}

const summary = {
  mode: write ? "write" : splitWrite ? "split-write" : inlineWrite ? "inline-write" : "dry-run",
  scanned: results.length,
  safe: results.filter((item) => item.status === "safe" || item.status === "written").length,
  written: results.filter((item) => item.status === "written").length,
  splitSafe: results.filter((item) => item.splitSafe).length,
  splitWritten: results.filter((item) => item.status === "split-written").length,
  inlineSafe: results.filter((item) => item.inlineSafe).length,
  inlineWritten: results.filter((item) => item.status === "inline-written").length,
  review: results.filter((item) => item.status === "review").length,
  results,
};

if (json) console.log(JSON.stringify(summary, null, 2));
else {
  console.log(`service-db adoption ${summary.mode}: ${summary.scanned} factory modules scanned`);
  console.log(`safe=${summary.safe} written=${summary.written} review=${summary.review}`);
  for (const item of results) {
    console.log(`${item.status.toUpperCase()} ${item.file}${item.tables.length ? `: ${item.tables.join(", ")}` : `: ${item.reasons.join("; ")}`}`);
  }
}

if (failOnSafe && summary.safe > 0) {
  console.error(`service-db adoption guardrail failed: ${summary.safe} safe caller(s) remain`);
  process.exitCode = 1;
}
if (failOnSplitSafe && summary.splitSafe > 0) {
  console.error(`service-db split-adoption guardrail failed: ${summary.splitSafe} split-safe caller(s) remain`);
  process.exitCode = 1;
}
if (failOnInlineSafe && summary.inlineSafe > 0) {
  console.error(`service-db inline-adoption guardrail failed: ${summary.inlineSafe} inline-safe caller(s) remain`);
  process.exitCode = 1;
}
