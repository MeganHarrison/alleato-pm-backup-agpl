#!/usr/bin/env tsx

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");
const DB_ROOT = path.join(SRC_ROOT, "lib", "db");
const TYPES_FILE = path.join(SRC_ROOT, "types", "database.types.ts");

interface Finding {
  file: string;
  line: number;
  column: number;
  table: string;
  functionName: string;
  unknownKeys: string[];
  hasOpaqueSpread: boolean;
}

function loadInsertColumns(): Map<string, Set<string>> {
  const source = ts.createSourceFile(
    TYPES_FILE,
    fs.readFileSync(TYPES_FILE, "utf8"),
    ts.ScriptTarget.Latest,
    true,
  );
  const tables = new Map<string, Set<string>>();

  function visit(node: ts.Node) {
    if (
      ts.isPropertySignature(node) &&
      ts.isIdentifier(node.name) &&
      node.name.text === "Tables" &&
      node.type &&
      ts.isTypeLiteralNode(node.type)
    ) {
      for (const tableMember of node.type.members) {
        if (!ts.isPropertySignature(tableMember) || !tableMember.name || !tableMember.type) {
          continue;
        }
        const tableName = tableMember.name.getText().replace(/['"]/g, "");
        if (!ts.isTypeLiteralNode(tableMember.type)) continue;
        for (const subMember of tableMember.type.members) {
          if (
            ts.isPropertySignature(subMember) &&
            ts.isIdentifier(subMember.name) &&
            subMember.name.text === "Insert" &&
            subMember.type &&
            ts.isTypeLiteralNode(subMember.type)
          ) {
            const columns = new Set<string>();
            for (const col of subMember.type.members) {
              if (ts.isPropertySignature(col) && col.name) {
                columns.add(col.name.getText().replace(/['"]/g, ""));
              }
            }
            tables.set(tableName, columns);
          }
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return tables;
}

function walk(dir: string, out: string[] = []): string[] {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "__tests__" || entry.name === "migrations" || entry.name === "helpers") continue;
      walk(full, out);
      continue;
    }
    if (entry.name.endsWith(".ts") && !entry.name.endsWith(".d.ts")) {
      out.push(full);
    }
  }
  return out;
}

function getIndexedAccessPath(typeNode: ts.TypeNode | undefined): string[] | null {
  if (!typeNode || !ts.isIndexedAccessTypeNode(typeNode)) return null;
  const objectPath = getIndexedAccessPath(typeNode.objectType);
  const indexType = typeNode.indexType;
  if (!ts.isLiteralTypeNode(indexType)) return null;
  const literal = indexType.literal;
  const key =
    ts.isStringLiteral(literal) || ts.isNumericLiteral(literal)
      ? literal.text
      : literal.kind === ts.SyntaxKind.TrueKeyword
        ? "true"
        : literal.kind === ts.SyntaxKind.FalseKeyword
          ? "false"
          : null;
  if (!key) return null;

  if (objectPath) return [...objectPath, key];
  if (ts.isTypeReferenceNode(typeNode.objectType) && ts.isIdentifier(typeNode.objectType.typeName)) {
    return [typeNode.objectType.typeName.text, key];
  }
  return null;
}

function resolveTableName(typeNode: ts.TypeNode | undefined, aliases: Map<string, string>): string | null {
  if (!typeNode) return null;
  if (ts.isTypeReferenceNode(typeNode) && ts.isIdentifier(typeNode.typeName)) {
    return aliases.get(typeNode.typeName.text) ?? null;
  }
  const pathParts = getIndexedAccessPath(typeNode);
  if (!pathParts) return null;
  if (
    pathParts.length === 5 &&
    pathParts[0] === "Database" &&
    pathParts[1] === "public" &&
    pathParts[2] === "Tables" &&
    pathParts[4] === "Insert"
  ) {
    return pathParts[3];
  }
  return null;
}

function collectObjectKeys(
  expr: ts.Expression,
  acc: { keys: Set<string>; hasOpaqueSpread: boolean },
): void {
  while (ts.isParenthesizedExpression(expr)) expr = expr.expression;

  if (ts.isObjectLiteralExpression(expr)) {
    for (const prop of expr.properties) {
      if (ts.isSpreadAssignment(prop)) {
        collectObjectKeys(prop.expression, acc);
        continue;
      }
      if (
        (ts.isPropertyAssignment(prop) || ts.isShorthandPropertyAssignment(prop)) &&
        prop.name &&
        (ts.isIdentifier(prop.name) || ts.isStringLiteral(prop.name))
      ) {
        acc.keys.add(prop.name.text);
      }
    }
    return;
  }

  if (ts.isConditionalExpression(expr)) {
    collectObjectKeys(expr.whenTrue, acc);
    collectObjectKeys(expr.whenFalse, acc);
    return;
  }

  if (ts.isBinaryExpression(expr)) {
    collectObjectKeys(expr.left, acc);
    collectObjectKeys(expr.right, acc);
    return;
  }

  if (
    expr.kind === ts.SyntaxKind.TrueKeyword ||
    expr.kind === ts.SyntaxKind.FalseKeyword ||
    expr.kind === ts.SyntaxKind.NullKeyword ||
    ts.isStringLiteral(expr) ||
    ts.isNoSubstitutionTemplateLiteral(expr) ||
    ts.isNumericLiteral(expr)
  ) {
    return;
  }

  acc.hasOpaqueSpread = true;
}

function scanFile(filePath: string, tableColumns: Map<string, Set<string>>): Finding[] {
  const text = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, text, ts.ScriptTarget.Latest, true);
  const aliases = new Map<string, string>();
  const findings: Finding[] = [];

  function maybeRecordFunction(
    node: ts.FunctionDeclaration | ts.MethodDeclaration | ts.FunctionExpression | ts.ArrowFunction,
    name: string,
  ) {
    const tableName = resolveTableName(node.type, aliases);
    if (!tableName || !tableColumns.has(tableName) || !node.body) return;

    const returnStatements: ts.ReturnStatement[] = [];
    const visitReturns = (child: ts.Node) => {
      if (ts.isReturnStatement(child)) returnStatements.push(child);
      ts.forEachChild(child, visitReturns);
    };
    visitReturns(node.body);

    for (const ret of returnStatements) {
      if (!ret.expression || !ts.isObjectLiteralExpression(ret.expression)) continue;
      const acc = { keys: new Set<string>(), hasOpaqueSpread: false };
      collectObjectKeys(ret.expression, acc);
      const allowed = tableColumns.get(tableName)!;
      const unknownKeys = Array.from(acc.keys).filter((key) => !allowed.has(key));
      if (unknownKeys.length === 0) continue;
      const { line, character } = source.getLineAndCharacterOfPosition(ret.expression.getStart());
      findings.push({
        file: path.relative(FRONTEND_ROOT, filePath),
        line: line + 1,
        column: character + 1,
        table: tableName,
        functionName: name,
        unknownKeys,
        hasOpaqueSpread: acc.hasOpaqueSpread,
      });
    }
  }

  function visit(node: ts.Node) {
    if (ts.isTypeAliasDeclaration(node)) {
      const tableName = resolveTableName(node.type, aliases);
      if (tableName) aliases.set(node.name.text, tableName);
    }

    if (ts.isFunctionDeclaration(node) && node.name) {
      maybeRecordFunction(node, node.name.text);
    }

    if (
      ts.isVariableDeclaration(node) &&
      node.initializer &&
      (ts.isArrowFunction(node.initializer) || ts.isFunctionExpression(node.initializer)) &&
      ts.isIdentifier(node.name)
    ) {
      maybeRecordFunction(node.initializer, node.name.text);
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

function main() {
  const tableColumns = loadInsertColumns();
  const files = walk(DB_ROOT);
  const findings = files.flatMap((file) => scanFile(file, tableColumns));

  if (findings.length === 0) {
    console.log(`✓ No mapper return objects write unknown DB columns across ${files.length} files`);
    return;
  }

  console.log(`✗ Found ${findings.length} mapper(s) returning unknown DB columns:\n`);
  for (const finding of findings) {
    console.log(`  ${finding.file}:${finding.line}:${finding.column}`);
    console.log(`    function: ${finding.functionName}`);
    console.log(`    table: ${finding.table}`);
    console.log(`    unknown: ${finding.unknownKeys.join(", ")}`);
    if (finding.hasOpaqueSpread) {
      console.log("    note: return object contains opaque spreads; additional keys may be hidden");
    }
    console.log();
  }

  process.exitCode = 1;
}

main();
