#!/usr/bin/env tsx

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

type PrimitiveKind = "string" | "number" | "boolean" | "unknown";

type Relationship = {
  foreignKeyName: string;
  column: string;
  referencedRelation: string;
  referencedColumn: string;
};

type TableInfo = {
  insertColumnTypes: Map<string, string>;
  relationships: Relationship[];
};

type ValidationFinding = {
  file: string;
  table: string;
  field: string;
  dbType: string;
  dbKind: PrimitiveKind;
  zodKinds: PrimitiveKind[];
  severity: "error" | "warn";
  reason: string;
};

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const ROOT = path.resolve(FRONTEND_ROOT, "..");
const TYPES_FILE = path.join(FRONTEND_ROOT, "src", "types", "database.types.ts");
const VALIDATION_DIRS = [
  path.join(FRONTEND_ROOT, "src", "lib", "validation"),
  path.join(FRONTEND_ROOT, "src", "lib", "schemas"),
];

function relative(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function walk(dir: string, out: string[] = []): string[] {
  if (!fs.existsSync(dir)) return out;

  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, out);
    } else if (
      (entry.name.endsWith(".ts") || entry.name.endsWith(".tsx")) &&
      !entry.name.endsWith(".d.ts")
    ) {
      out.push(full);
    }
  }

  return out;
}

function getStringLiteralTypeValue(typeNode: ts.TypeNode | undefined): string | null {
  if (!typeNode || !ts.isLiteralTypeNode(typeNode)) return null;
  if (ts.isStringLiteral(typeNode.literal)) return typeNode.literal.text;
  return null;
}

function parseTupleStringValues(typeNode: ts.TypeNode | undefined): string[] {
  if (!typeNode || !ts.isTupleTypeNode(typeNode)) return [];
  const values: string[] = [];

  for (const el of typeNode.elements) {
    if (!ts.isLiteralTypeNode(el) || !ts.isStringLiteral(el.literal)) continue;
    values.push(el.literal.text);
  }

  return values;
}

function loadTableInfo(): Map<string, TableInfo> {
  const sourceText = fs.readFileSync(TYPES_FILE, "utf8");
  const source = ts.createSourceFile(TYPES_FILE, sourceText, ts.ScriptTarget.Latest, true);

  const tables = new Map<string, TableInfo>();

  function visit(node: ts.Node) {
    if (ts.isPropertySignature(node) && ts.isIdentifier(node.name) && node.name.text === "Tables") {
      if (!node.type || !ts.isTypeLiteralNode(node.type)) return;

      for (const tableMember of node.type.members) {
        if (!ts.isPropertySignature(tableMember) || !tableMember.type || !tableMember.name) continue;
        if (!ts.isTypeLiteralNode(tableMember.type)) continue;

        const tableName = tableMember.name.getText(source).replace(/['"]/g, "");
        const insertColumnTypes = new Map<string, string>();
        const relationships: Relationship[] = [];

        for (const subMember of tableMember.type.members) {
          if (!ts.isPropertySignature(subMember) || !subMember.type || !subMember.name) continue;
          const subName = subMember.name.getText(source).replace(/['"]/g, "");

          if (subName === "Insert" && ts.isTypeLiteralNode(subMember.type)) {
            for (const colMember of subMember.type.members) {
              if (!ts.isPropertySignature(colMember) || !colMember.name || !colMember.type) continue;
              const colName = colMember.name.getText(source).replace(/['"]/g, "");
              insertColumnTypes.set(colName, colMember.type.getText(source));
            }
          }

          if (subName === "Relationships" && ts.isTupleTypeNode(subMember.type)) {
            for (const relEl of subMember.type.elements) {
              if (!ts.isTypeLiteralNode(relEl)) continue;

              let foreignKeyName = "";
              let column = "";
              let referencedRelation = "";
              let referencedColumn = "";

              for (const relProp of relEl.members) {
                if (!ts.isPropertySignature(relProp) || !relProp.name) continue;
                const propName = relProp.name.getText(source).replace(/['"]/g, "");

                if (propName === "foreignKeyName") {
                  foreignKeyName = getStringLiteralTypeValue(relProp.type) || "";
                } else if (propName === "columns") {
                  column = parseTupleStringValues(relProp.type)[0] || "";
                } else if (propName === "referencedRelation") {
                  referencedRelation = getStringLiteralTypeValue(relProp.type) || "";
                } else if (propName === "referencedColumns") {
                  referencedColumn = parseTupleStringValues(relProp.type)[0] || "";
                }
              }

              if (column && referencedRelation && referencedColumn) {
                relationships.push({
                  foreignKeyName,
                  column,
                  referencedRelation,
                  referencedColumn,
                });
              }
            }
          }
        }

        tables.set(tableName, { insertColumnTypes, relationships });
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return tables;
}

function inferDbKind(typeText: string): PrimitiveKind {
  if (/\bnumber\b/.test(typeText)) return "number";
  if (/\bboolean\b/.test(typeText)) return "boolean";
  if (/\bstring\b/.test(typeText) || /Database\["public"\]\["Enums"\]/.test(typeText)) {
    return "string";
  }
  return "unknown";
}

function inferZodKinds(exprText: string): Set<PrimitiveKind> {
  const kinds = new Set<PrimitiveKind>();

  if (/z\.coerce\.number\s*\(/.test(exprText) || /z\.number\s*\(/.test(exprText)) {
    kinds.add("number");
  }
  if (/z\.string\s*\(/.test(exprText) || /z\.enum\s*\(/.test(exprText)) {
    kinds.add("string");
  }
  if (/z\.boolean\s*\(/.test(exprText)) {
    kinds.add("boolean");
  }
  if (/\.uuid\s*\(/.test(exprText)) {
    kinds.add("string");
  }

  if (kinds.size === 0) {
    kinds.add("unknown");
  }

  return kinds;
}

function collectLocalExprAliases(source: ts.SourceFile): Map<string, string> {
  const aliases = new Map<string, string>();

  function visit(node: ts.Node) {
    if (ts.isVariableStatement(node)) {
      const isConst = node.declarationList.flags & ts.NodeFlags.Const;
      if (isConst) {
        for (const decl of node.declarationList.declarations) {
          if (!ts.isIdentifier(decl.name) || !decl.initializer) continue;
          aliases.set(decl.name.text, decl.initializer.getText(source));
        }
      }
    }
    ts.forEachChild(node, visit);
  }

  visit(source);
  return aliases;
}

function inferZodKindsWithAliases(
  exprText: string,
  aliases: Map<string, string>,
  visiting = new Set<string>(),
): Set<PrimitiveKind> {
  const direct = inferZodKinds(exprText);
  if (!(direct.size === 1 && direct.has("unknown"))) {
    return direct;
  }

  const trimmed = exprText.trim();
  if (!/^[A-Za-z_$][A-Za-z0-9_$]*$/.test(trimmed)) {
    return direct;
  }

  if (visiting.has(trimmed)) return direct;
  const aliased = aliases.get(trimmed);
  if (!aliased) return direct;

  visiting.add(trimmed);
  const inferred = inferZodKindsWithAliases(aliased, aliases, visiting);
  visiting.delete(trimmed);
  return inferred;
}

function singularize(name: string): string {
  if (name.endsWith("ies")) return `${name.slice(0, -3)}y`;
  if (name.endsWith("ses")) return name.slice(0, -2);
  if (name.endsWith("s") && !name.endsWith("ss")) return name.slice(0, -1);
  return name;
}

function pluralize(name: string): string {
  if (name.endsWith("y")) return `${name.slice(0, -1)}ies`;
  if (name.endsWith("s")) return name;
  return `${name}s`;
}

function inferTableFromFile(filePath: string, tables: Map<string, TableInfo>): string | null {
  const base = path.basename(filePath, path.extname(filePath)).replace(/[-.]/g, "_");
  const normalized = base
    .replace(/_schema$/, "")
    .replace(/_schemas$/, "")
    .replace(/_db$/, "")
    .replace(/_validation$/, "");

  const candidates = [
    normalized,
    singularize(normalized),
    pluralize(normalized),
  ];

  for (const candidate of candidates) {
    if (tables.has(candidate)) return candidate;
  }

  return null;
}

function scanValidationFile(
  filePath: string,
  tableName: string,
  tableInfo: TableInfo,
): ValidationFinding[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const aliases = collectLocalExprAliases(source);
  const findings: ValidationFinding[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node)) {
      const callee = node.expression;
      const isZodObjectCall =
        ts.isPropertyAccessExpression(callee) &&
        callee.name.text === "object" &&
        ts.isIdentifier(callee.expression) &&
        callee.expression.text === "z";

      if (isZodObjectCall) {
        const arg = node.arguments[0];
        if (arg && ts.isObjectLiteralExpression(arg)) {
          for (const prop of arg.properties) {
            if (!ts.isPropertyAssignment(prop) && !ts.isShorthandPropertyAssignment(prop)) continue;
            const key = prop.name?.getText(source).replace(/['"]/g, "") || "";
            if (!key.endsWith("_id")) continue;

            const dbType = tableInfo.insertColumnTypes.get(key);
            if (!dbType) continue;

            const dbKind = inferDbKind(dbType);
            if (dbKind === "unknown") continue;

            const zodExprText = ts.isPropertyAssignment(prop)
              ? prop.initializer.getText(source)
              : prop.name.getText(source);
            const zodKinds = inferZodKindsWithAliases(zodExprText, aliases);

            if (!zodKinds.has(dbKind)) {
              if (zodKinds.size === 1 && zodKinds.has("unknown")) {
                findings.push({
                  file: relative(filePath),
                  table: tableName,
                  field: key,
                  dbType,
                  dbKind,
                  zodKinds: Array.from(zodKinds),
                  severity: "warn",
                  reason: "validator type could not be inferred statically (likely shared helper schema)",
                });
                continue;
              }

              findings.push({
                file: relative(filePath),
                table: tableName,
                field: key,
                dbType,
                dbKind,
                zodKinds: Array.from(zodKinds),
                severity: "error",
                reason: `validator does not include DB primitive kind '${dbKind}'`,
              });
              continue;
            }

            if (zodKinds.size > 1 && zodKinds.has("number") && zodKinds.has("string")) {
              findings.push({
                file: relative(filePath),
                table: tableName,
                field: key,
                dbType,
                dbKind,
                zodKinds: Array.from(zodKinds),
                severity: "warn",
                reason: "validator is wider than DB type (string|number) and may hide mapping bugs",
              });
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

function printFkReport(tables: Map<string, TableInfo>): void {
  const realTableSet = new Set(tables.keys());
  const lines: string[] = [];

  for (const [tableName, info] of tables.entries()) {
    for (const rel of info.relationships) {
      if (!realTableSet.has(rel.referencedRelation)) continue;
      const localType = info.insertColumnTypes.get(rel.column) || "unknown";
      const referencedType =
        tables.get(rel.referencedRelation)?.insertColumnTypes.get(rel.referencedColumn) || "unknown";
      lines.push(
        `${tableName}.${rel.column} -> ${rel.referencedRelation}.${rel.referencedColumn}  [${localType} => ${referencedType}]`,
      );
    }
  }

  lines.sort((a, b) => a.localeCompare(b));

  console.log("FK Contract Report (real table relations only):");
  if (lines.length === 0) {
    console.log("  (no FK rows found)");
    return;
  }

  for (const line of lines) {
    console.log(`  ${line}`);
  }
}

function printValidationFindings(findings: ValidationFinding[]): void {
  const deduped = Array.from(
    new Map(
      findings.map((item) => [
        `${item.severity}|${item.file}|${item.table}|${item.field}|${item.reason}`,
        item,
      ]),
    ).values(),
  );

  if (deduped.length === 0) {
    console.log("\nValidation-vs-DB ID type audit: ✓ no issues found");
    return;
  }

  console.log(`\nValidation-vs-DB ID type audit: found ${deduped.length} issue(s)`);

  const sorted = [...deduped].sort((a, b) => {
    if (a.severity !== b.severity) return a.severity === "error" ? -1 : 1;
    return `${a.file}:${a.field}`.localeCompare(`${b.file}:${b.field}`);
  });

  for (const item of sorted) {
    console.log(`  [${item.severity.toUpperCase()}] ${item.file}`);
    console.log(`    table.field: ${item.table}.${item.field}`);
    console.log(`    db type: ${item.dbType}`);
    console.log(`    validator kinds: ${item.zodKinds.join(", ")}`);
    console.log(`    reason: ${item.reason}`);
  }
}

function main() {
  if (!fs.existsSync(TYPES_FILE)) {
    console.error(`Missing types file: ${TYPES_FILE}`);
    process.exit(2);
  }

  const tables = loadTableInfo();
  if (tables.size === 0) {
    console.error("Failed to parse tables from database.types.ts");
    process.exit(2);
  }

  printFkReport(tables);

  const validationFiles = VALIDATION_DIRS.flatMap((dir) => walk(dir));
  const findings: ValidationFinding[] = [];

  for (const filePath of validationFiles) {
    const table = inferTableFromFile(filePath, tables);
    if (!table) continue;

    const tableInfo = tables.get(table);
    if (!tableInfo) continue;

    findings.push(...scanValidationFile(filePath, table, tableInfo));
  }

  printValidationFindings(findings);

  const hasErrors = findings.some((f) => f.severity === "error");
  process.exit(hasErrors ? 1 : 0);
}

main();
