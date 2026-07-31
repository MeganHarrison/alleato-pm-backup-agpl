#!/usr/bin/env tsx

import * as fs from "node:fs";
import * as path from "node:path";
import * as ts from "typescript";

type Finding = {
  file: string;
  line: number;
  column: number;
  sourceTable: string;
  relation: string;
  availableFks: string[];
  selectSnippet: string;
};

const FRONTEND_ROOT = path.resolve(__dirname, "../..");
const ROOT = path.resolve(FRONTEND_ROOT, "..");
const FRONTEND_SRC = path.join(FRONTEND_ROOT, "src");
const TYPES_FILE = path.join(FRONTEND_SRC, "types", "database.types.ts");

function relative(filePath: string): string {
  return path.relative(ROOT, filePath);
}

function walk(dir: string, out: string[] = []): string[] {
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

function loadAmbiguousRelationsMap(): Map<string, Map<string, string[]>> {
  const sourceText = fs.readFileSync(TYPES_FILE, "utf8");
  const source = ts.createSourceFile(TYPES_FILE, sourceText, ts.ScriptTarget.Latest, true);
  const tableToRelations = new Map<string, Map<string, string[]>>();

  function visit(node: ts.Node) {
    if (!ts.isPropertySignature(node) || !ts.isIdentifier(node.name) || node.name.text !== "Tables") {
      ts.forEachChild(node, visit);
      return;
    }

    if (!node.type || !ts.isTypeLiteralNode(node.type)) return;

    for (const tableMember of node.type.members) {
      if (!ts.isPropertySignature(tableMember) || !tableMember.name || !tableMember.type) continue;
      if (!ts.isTypeLiteralNode(tableMember.type)) continue;
      const tableName = tableMember.name.getText(source).replace(/['"]/g, "");
      const relationMap = new Map<string, string[]>();

      for (const subMember of tableMember.type.members) {
        if (!ts.isPropertySignature(subMember) || !subMember.name || !subMember.type) continue;
        const subName = subMember.name.getText(source).replace(/['"]/g, "");
        if (subName !== "Relationships") continue;
        if (!ts.isTupleTypeNode(subMember.type)) continue;

        for (const relType of subMember.type.elements) {
          if (!ts.isTypeLiteralNode(relType)) continue;

          let foreignKeyName = "";
          let referencedRelation = "";

          for (const relProp of relType.members) {
            if (!ts.isPropertySignature(relProp) || !relProp.name || !relProp.type) continue;
            const propName = relProp.name.getText(source).replace(/['"]/g, "");
            if (!ts.isLiteralTypeNode(relProp.type) || !ts.isStringLiteral(relProp.type.literal)) continue;

            if (propName === "foreignKeyName") foreignKeyName = relProp.type.literal.text;
            if (propName === "referencedRelation") referencedRelation = relProp.type.literal.text;
          }

          if (!foreignKeyName || !referencedRelation) continue;
          if (!relationMap.has(referencedRelation)) relationMap.set(referencedRelation, []);
          relationMap.get(referencedRelation)!.push(foreignKeyName);
        }
      }

      tableToRelations.set(tableName, relationMap);
    }
  }

  visit(source);

  const ambiguousOnly = new Map<string, Map<string, string[]>>();
  for (const [table, relationMap] of tableToRelations) {
    const amb = new Map<string, string[]>();
    for (const [relation, fkNames] of relationMap) {
      const uniq = Array.from(new Set(fkNames));
      if (uniq.length > 1) amb.set(relation, uniq);
    }
    if (amb.size > 0) ambiguousOnly.set(table, amb);
  }

  return ambiguousOnly;
}

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
      if (ts.isPropertyAccessExpression(callee)) {
        current = callee.expression;
        continue;
      }
      break;
    }
    if (ts.isPropertyAccessExpression(current)) {
      current = current.expression;
      continue;
    }
    break;
  }
  return null;
}

function getStringArg(expr: ts.Expression | undefined): string | null {
  if (!expr) return null;
  if (ts.isStringLiteral(expr) || ts.isNoSubstitutionTemplateLiteral(expr)) return expr.text;
  if (ts.isTemplateExpression(expr)) return null;
  return null;
}

function extractEmbeds(selectText: string): Array<{ relation: string; hasFkHint: boolean }> {
  const embeds: Array<{ relation: string; hasFkHint: boolean }> = [];
  const regex = /(?:[A-Za-z_][\w]*:)?([A-Za-z_][\w]*)(![^(\s,]+)?\s*\(/g;
  let m: RegExpExecArray | null;
  while ((m = regex.exec(selectText)) !== null) {
    const relation = m[1];
    const hasFkHint = Boolean(m[2]);
    embeds.push({ relation, hasFkHint });
  }
  return embeds;
}

function scanFile(
  filePath: string,
  ambiguousMap: Map<string, Map<string, string[]>>,
): Finding[] {
  const sourceText = fs.readFileSync(filePath, "utf8");
  const source = ts.createSourceFile(filePath, sourceText, ts.ScriptTarget.Latest, true);
  const findings: Finding[] = [];

  function visit(node: ts.Node) {
    if (ts.isCallExpression(node) && ts.isPropertyAccessExpression(node.expression)) {
      const method = node.expression.name.text;
      if (method === "select") {
        const fromTable = findFromTable(node.expression.expression);
        if (!fromTable) {
          ts.forEachChild(node, visit);
          return;
        }

        const ambiguousForTable = ambiguousMap.get(fromTable);
        if (!ambiguousForTable || ambiguousForTable.size === 0) {
          ts.forEachChild(node, visit);
          return;
        }

        const selectText = getStringArg(node.arguments[0]);
        if (!selectText) {
          ts.forEachChild(node, visit);
          return;
        }

        const embeds = extractEmbeds(selectText);
        for (const embed of embeds) {
          if (embed.hasFkHint) continue;
          const fkNames = ambiguousForTable.get(embed.relation);
          if (!fkNames || fkNames.length <= 1) continue;
          const { line, character } = source.getLineAndCharacterOfPosition(node.getStart());
          findings.push({
            file: relative(filePath),
            line: line + 1,
            column: character + 1,
            sourceTable: fromTable,
            relation: embed.relation,
            availableFks: fkNames,
            selectSnippet: selectText.trim().slice(0, 220),
          });
        }
      }
    }

    ts.forEachChild(node, visit);
  }

  visit(source);
  return findings;
}

function main() {
  if (!fs.existsSync(TYPES_FILE)) {
    console.error(`Missing types file: ${TYPES_FILE}`);
    process.exit(2);
  }

  const ambiguousMap = loadAmbiguousRelationsMap();
  const files = walk(FRONTEND_SRC);
  const findings: Finding[] = [];

  for (const file of files) {
    findings.push(...scanFile(file, ambiguousMap));
  }

  if (findings.length === 0) {
    console.log("✓ No ambiguous Supabase embeds detected");
    process.exit(0);
  }

  console.log(`✗ Found ${findings.length} ambiguous embed(s) that need explicit FK hints:\n`);
  for (const f of findings) {
    console.log(`  ${f.file}:${f.line}:${f.column}`);
    console.log(`    from: ${f.sourceTable}`);
    console.log(`    embed: ${f.relation}(...)`);
    console.log(`    expected one of: ${f.availableFks.join(", ")}`);
    console.log(`    select: ${f.selectSnippet}`);
    console.log();
  }

  process.exit(1);
}

main();
