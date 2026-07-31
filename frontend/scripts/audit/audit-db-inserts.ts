#!/usr/bin/env tsx
/**
 * audit-db-inserts.ts
 *
 * Scans the frontend for `supabase.from('<table>').insert/update/upsert({...})`
 * calls and verifies that every key in the object literal exists as a column
 * on that table per `frontend/src/types/database.types.ts`.
 *
 * Catches the class of bug where a form posts `address` / `department` / `phone`
 * to a table whose real columns are `address_line1` / `business_unit` / `phone_mobile`.
 *
 * Usage:
 *   npx tsx scripts/audit/audit-db-inserts.ts
 *   npx tsx scripts/audit/audit-db-inserts.ts --table=people
 *   npx tsx scripts/audit/audit-db-inserts.ts --json
 *
 * Exit code: non-zero if any unknown keys are found.
 */

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const ROOT = path.resolve(FRONTEND_ROOT, "..");
const FRONTEND_SRC = path.join(FRONTEND_ROOT, "src");
const TYPES_FILE = path.join(FRONTEND_SRC, "types/database.types.ts");

interface Finding {
  file: string;
  line: number;
  column: number;
  table: string;
  method: string;
  unknownKeys: string[];
  hasSpread: boolean;
}

// ---------------------------------------------------------------------------
// 1. Parse database.types.ts → { tableName: Set<columnName> }
// ---------------------------------------------------------------------------

function loadTableColumns(): Map<string, Set<string>> {
  const source = ts.createSourceFile(
    TYPES_FILE,
    fs.readFileSync(TYPES_FILE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );

  const tables = new Map<string, Set<string>>();

  // Walk to find: Database -> public -> Tables -> <tableName> -> Insert
  function visit(node: ts.Node) {
    if (ts.isPropertySignature(node) && node.name && ts.isIdentifier(node.name) && node.name.text === "Tables") {
      // node.type is a TypeLiteralNode with member per table
      const tablesType = node.type;
      if (tablesType && ts.isTypeLiteralNode(tablesType)) {
        for (const tableMember of tablesType.members) {
          if (!ts.isPropertySignature(tableMember) || !tableMember.name) continue;
          const tableName = tableMember.name.getText().replace(/['"]/g, "");
          const tableType = tableMember.type;
          if (!tableType || !ts.isTypeLiteralNode(tableType)) continue;
          // Find Insert sub-member
          for (const sub of tableType.members) {
            if (
              ts.isPropertySignature(sub) &&
              sub.name &&
              ts.isIdentifier(sub.name) &&
              sub.name.text === "Insert" &&
              sub.type &&
              ts.isTypeLiteralNode(sub.type)
            ) {
              const cols = new Set<string>();
              for (const col of sub.type.members) {
                if (ts.isPropertySignature(col) && col.name) {
                  cols.add(col.name.getText().replace(/['"]/g, ""));
                }
              }
              tables.set(tableName, cols);
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return tables;
}

// ---------------------------------------------------------------------------
// 2. Walk a file and find supabase.from(X).{insert,update,upsert}({...})
// ---------------------------------------------------------------------------

/**
 * Walk the call chain to find a `.from('<table>')` ancestor on the same chain.
 * Handles `supabase.from('x').insert(...)`, `supabase.from('x').update(...).eq(...)`,
 * and intermediate `.select()` etc.
 */
function findFromTable(expr: ts.Expression): string | null {
  let current: ts.Expression | undefined = expr;
  while (current) {
    if (ts.isCallExpression(current)) {
      const callee: ts.LeftHandSideExpression = current.expression;
      if (ts.isPropertyAccessExpression(callee) && callee.name.text === "from") {
        const arg = current.arguments[0];
        if (arg && ts.isStringLiteral(arg)) return arg.text;
        if (arg && ts.isNoSubstitutionTemplateLiteral(arg)) return arg.text;
        return null;
      }
      current = (callee as ts.PropertyAccessExpression).expression;
      continue;
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return null;
}

/**
 * Recursively collect every property key found in an expression tree, including
 * keys nested inside spread expressions like:
 *   ...(cond && { foo: x })
 *   ...(cond ? { foo: x } : { bar: y })
 *   ...someObjLiteral
 * Returns null only if the expression is fully opaque (variable, function call,
 * etc.) and we cannot prove the keys.
 */
function collectKeysDeep(
  expr: ts.Expression,
  out: { keys: Set<string>; opaqueSpread: boolean },
): void {
  // Unwrap parens
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;

  if (ts.isObjectLiteralExpression(expr)) {
    for (const prop of expr.properties) {
      if (ts.isSpreadAssignment(prop)) {
        collectKeysDeep(prop.expression, out);
        continue;
      }
      if ((ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) && prop.name) {
        if (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name)) {
          out.keys.add(prop.name.text);
        }
      }
    }
    return;
  }

  // `cond && { ... }` or `cond || { ... }`
  if (ts.isBinaryExpression(expr)) {
    const k = expr.operatorToken.kind;
    if (
      k === ts.SyntaxKind.AmpersandAmpersandToken ||
      k === ts.SyntaxKind.BarBarToken ||
      k === ts.SyntaxKind.QuestionQuestionToken
    ) {
      collectKeysDeep(expr.left, out);
      collectKeysDeep(expr.right, out);
      return;
    }
  }

  // `cond ? { ... } : { ... }`
  if (ts.isConditionalExpression(expr)) {
    collectKeysDeep(expr.whenTrue, out);
    collectKeysDeep(expr.whenFalse, out);
    return;
  }

  // Boolean / null / undefined / number / string literal — contributes nothing
  if (
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword ||
    expr.kind === ts.SyntaxKind.NullKeyword ||
    ts.isNumericLiteral(expr) ||
    ts.isStringLiteral(expr) ||
    ts.isNoSubstitutionTemplateLiteral(expr)
  ) {
    return;
  }

  // Anything else (identifier, call, member access, etc.) — opaque spread
  out.opaqueSpread = true;
}

function extractObjectKeys(arg: ts.Expression): { keys: string[]; hasSpread: boolean } | null {
  // Single object literal (with possible nested spreads)
  if (ts.isObjectLiteralExpression(arg)) {
    const acc = { keys: new Set<string>(), opaqueSpread: false };
    collectKeysDeep(arg, acc);
    return { keys: Array.from(acc.keys), hasSpread: acc.opaqueSpread };
  }
  // Array of object literals: .insert([{...}, {...}])
  if (ts.isArrayLiteralExpression(arg)) {
    const acc = { keys: new Set<string>(), opaqueSpread: false };
    for (const el of arg.elements) {
      if (ts.isObjectLiteralExpression(el)) {
        collectKeysDeep(el, acc);
      } else {
        return null;
      }
    }
    return { keys: Array.from(acc.keys), hasSpread: acc.opaqueSpread };
  }
  return null;
}

function scanFile(
  filePath: string,
  tables: Map<string, Set<string>>,
  filterTable: string | null,
): Finding[] {
  const text = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      if (ts.isPropertyAccessExpression(callee)) {
        const method = callee.name.text;
        if (method === "insert" || method === "update" || method === "upsert") {
          const table = findFromTable(callee.expression);
          if (table && (!filterTable || table === filterTable) && tables.has(table)) {
            const arg = node.arguments[0];
            if (arg) {
              const extracted = extractObjectKeys(arg);
              if (extracted) {
                const allowed = tables.get(table)!;
                const unknownKeys = extracted.keys.filter((k) => !allowed.has(k));
                if (unknownKeys.length > 0) {
                  const { line, character } = source.getLineAndCharacterOfPosition(node.getStart());
                  findings.push({
                    file: path.relative(ROOT, filePath),
                    line: line + 1,
                    column: character + 1,
                    table,
                    method,
                    unknownKeys,
                    hasSpread: extracted.hasSpread,
                  });
                }
              }
            }
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

// ---------------------------------------------------------------------------
// 3. Walk frontend/src
// ---------------------------------------------------------------------------

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts") &&
      full !== TYPES_FILE
    ) {
      out.push(full);
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// 4. Main
// ---------------------------------------------------------------------------

function main() {
  const args = process.argv.slice(2);
  const filterTable = args.find((a) => a.startsWith("--table="))?.split("=")[1] ?? null;
  const asJson = args.includes("--json");

  const tables = loadTableColumns();
  if (tables.size === 0) {
    console.error("Failed to parse any tables from database.types.ts");
    process.exit(2);
  }

  const files = walk(FRONTEND_SRC);
  const findings: Finding[] = [];
  for (const f of files) {
    findings.push(...scanFile(f, tables, filterTable));
  }

  if (asJson) {
    console.log(JSON.stringify(findings, null, 2));
  } else {
    if (findings.length === 0) {
      console.log(`✓ No unknown insert/update/upsert keys found across ${files.length} files`);
    } else {
      console.log(`✗ Found ${findings.length} call(s) with unknown columns:\n`);
      for (const f of findings) {
        console.log(`  ${f.file}:${f.line}:${f.column}`);
        console.log(`    .${f.method}() on '${f.table}'`);
        console.log(`    unknown: ${f.unknownKeys.join(", ")}`);
        if (f.hasSpread) console.log(`    note: object also contains spread (...) — additional unknown keys may be hidden`);
        console.log();
      }
    }
  }

  process.exit(findings.length > 0 ? 1 : 0);
}

main();
