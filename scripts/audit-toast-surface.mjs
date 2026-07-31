#!/usr/bin/env node

import { existsSync, mkdirSync, readdirSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";
import { execSync } from "node:child_process";

const repoRoot = process.cwd();
const frontendRoot = path.join(repoRoot, "frontend", "src");
const defaultReportPath = path.join(repoRoot, "docs", "reports", "toast-inventory.md");
const args = new Set(process.argv.slice(2));
const outFlagIndex = process.argv.indexOf("--out");
const outputPath = outFlagIndex >= 0 ? path.resolve(process.argv[outFlagIndex + 1]) : defaultReportPath;
const mode = args.has("--staged") ? "staged" : args.has("--changed") ? "changed" : "all";
const failOnDebt = args.has("--fail-on-debt");
const codeExtensions = new Set([".ts", ".tsx", ".js", ".jsx"]);

const toastMethodCallRe = /\btoast\.(success|error|info|warning|loading|promise|message|custom)\s*\((.*)/g;
const defaultToastCallRe = /\btoast\s*\((.*)/g;
const directToastImportRe = /import\s+\{\s*toast(?:\s+as\s+\w+)?\s*\}\s+from\s+["']sonner["']/;
const appToastImportRe = /import\s+\{\s*appToast(?:\s+as\s+\w+)?\s*\}\s+from\s+["']@\/lib\/toast\/app-toast["']/;

function run(cmd) {
  try {
    return execSync(cmd, { cwd: repoRoot, stdio: ["ignore", "pipe", "pipe"] })
      .toString()
      .trimEnd();
  } catch {
    return "";
  }
}

function walk(dir) {
  const entries = [];
  for (const item of readdirSync(dir, { withFileTypes: true })) {
    if (item.name === ".next" || item.name === "node_modules") continue;
    const fullPath = path.join(dir, item.name);
    if (item.isDirectory()) {
      entries.push(...walk(fullPath));
      continue;
    }
    if (codeExtensions.has(path.extname(item.name))) {
      entries.push(fullPath);
    }
  }
  return entries;
}

function splitLines(value) {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean);
}

function getChangedFiles() {
  const commands =
    mode === "staged"
      ? ["git diff --cached --name-only --diff-filter=ACMR"]
      : [
          "git diff --name-only origin/main...HEAD --diff-filter=ACMR",
          "git diff --cached --name-only --diff-filter=ACMR",
          "git diff --name-only --diff-filter=ACMR",
        ];

  return [
    ...new Set(
      commands
        .flatMap((cmd) => splitLines(run(cmd)))
        .filter((file) => file.startsWith("frontend/src/"))
        .filter((file) => codeExtensions.has(path.extname(file)))
        .map((file) => path.join(repoRoot, file))
        .filter(existsSync),
    ),
  ].sort();
}

function getCandidateFiles() {
  if (mode === "all") return walk(frontendRoot).sort();
  return getChangedFiles();
}

function featureAreaFor(relativePath) {
  const normalized = relativePath.replace(/^frontend\/src\//, "");
  if (normalized.startsWith("app/(main)/")) return normalized.split("/").slice(2, 4).join("/");
  if (normalized.startsWith("app/api/")) return "api";
  if (normalized.startsWith("hooks/")) return "hooks";
  if (normalized.startsWith("components/")) return normalized.split("/").slice(0, 2).join("/");
  if (normalized.startsWith("features/")) return normalized.split("/").slice(0, 2).join("/");
  return normalized.split("/")[0] || "unknown";
}

function getFirstArgument(rawCall) {
  const trimmed = rawCall.trim();
  const match = trimmed.match(/^([`"'])([\s\S]*?)(?<!\\)\1/);
  if (!match) return { message: "", dynamic: true };
  return { message: match[2].replace(/\s+/g, " ").trim(), dynamic: match[1] === "`" && /\$\{/.test(match[2]) };
}

function riskLabelsFor(type, message, dynamic) {
  const labels = new Set();
  const lower = message.toLowerCase();

  if (dynamic) labels.add("dynamic-message");
  if (/\b(coming soon|not connected yet|not implemented|placeholder)\b/.test(lower)) labels.add("placeholder");
  if (type === "error" && /\b(failed to|failed|unable to|could not)\b/.test(lower)) labels.add("generic-error");
  if (type === "error" && /\b(load|loading|fetch|fetching)\b/.test(lower)) labels.add("load-error");
  if ((type === "success" || type === "message") && /^(saved|updated|created|deleted|copied)!?$/i.test(message.trim())) {
    labels.add("success-no-context");
  }
  if (type === "error" && !/\bid\s*:|request|description|details/i.test(message)) labels.add("duplicate-risk");

  return [...labels];
}

function collectToasts(files) {
  const calls = [];
  const directImports = [];

  for (const absolutePath of files) {
    const source = readFileSync(absolutePath, "utf8");
    const relativePath = path.relative(repoRoot, absolutePath);
    const hasDirectImport = directToastImportRe.test(source);
    const hasAppToastImport = appToastImportRe.test(source);

    if (hasDirectImport && !hasAppToastImport) {
      directImports.push(relativePath);
    }

    const lines = source.split("\n");
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      toastMethodCallRe.lastIndex = 0;
      let match;
      while ((match = toastMethodCallRe.exec(line)) !== null) {
        const type = match[1];
        const { message, dynamic } = getFirstArgument(match[2] ?? "");
        calls.push({
          file: relativePath,
          line: index + 1,
          type,
          message,
          dynamic,
          featureArea: featureAreaFor(relativePath),
          riskLabels: riskLabelsFor(type, message, dynamic),
        });
      }
      if (hasDirectImport || hasAppToastImport) {
        defaultToastCallRe.lastIndex = 0;
        while ((match = defaultToastCallRe.exec(line)) !== null) {
          const previousChar = line[Math.max(match.index - 1, 0)];
          if (previousChar === ".") continue;
          const { message, dynamic } = getFirstArgument(match[1] ?? "");
          calls.push({
            file: relativePath,
            line: index + 1,
            type: "default",
            message,
            dynamic,
            featureArea: featureAreaFor(relativePath),
            riskLabels: riskLabelsFor("default", message, dynamic),
          });
        }
      }
    }
  }

  return { calls, directImports };
}

function byCount(items, getKey) {
  const counts = new Map();
  for (const item of items) {
    const key = getKey(item);
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  return [...counts.entries()].sort((a, b) => b[1] - a[1]);
}

function markdownTable(rows, headers) {
  if (rows.length === 0) return "_None._";
  return [
    `| ${headers.join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map((cell) => String(cell).replace(/\|/g, "\\|")).join(" | ")} |`),
  ].join("\n");
}

function buildReport({ calls, directImports, files }) {
  const countsByType = byCount(calls, (call) => call.type);
  const flaggedCalls = calls.filter((call) => call.riskLabels.length > 0);
  const topFiles = byCount(calls, (call) => call.file).slice(0, 20);
  const topRisks = byCount(flaggedCalls.flatMap((call) => call.riskLabels), (label) => label);

  return `# Toast Surface Inventory

Generated: ${new Date().toISOString()}
Mode: \`${mode}\`
Scanned files: ${files.length}

## Summary

- Toast calls found: ${calls.length}
- Files with toast calls: ${new Set(calls.map((call) => call.file)).size}
- Direct \`sonner\` toast imports: ${directImports.length}
- Flagged toast calls: ${flaggedCalls.length}

## Calls By Type

${markdownTable(countsByType.map(([type, count]) => [type, count]), ["Type", "Count"])}

## Risk Labels

${markdownTable(topRisks.map(([label, count]) => [label, count]), ["Risk", "Count"])}

## Top Toast Files

${markdownTable(topFiles.map(([file, count]) => [file, count]), ["File", "Count"])}

## Flagged Toast Calls

${markdownTable(
  flaggedCalls.slice(0, 300).map((call) => [
    `${call.file}:${call.line}`,
    call.type,
    call.dynamic ? "dynamic" : call.message || "[non-static]",
    call.featureArea,
    call.riskLabels.join(", "),
  ]),
  ["Location", "Type", "Message", "Area", "Risk"],
)}

## Direct Sonner Imports

${markdownTable(directImports.slice(0, 300).map((file) => [file]), ["File"])}
`;
}

function main() {
  if (!existsSync(frontendRoot)) {
    console.error(`Missing frontend source directory: ${frontendRoot}`);
    process.exit(1);
  }

  const files = getCandidateFiles();
  const inventory = collectToasts(files);
  const report = buildReport({ ...inventory, files });

  mkdirSync(path.dirname(outputPath), { recursive: true });
  writeFileSync(outputPath, report);

  console.log(`Toast inventory written to ${path.relative(repoRoot, outputPath)}`);
  console.log(`Toast calls: ${inventory.calls.length}`);
  console.log(`Direct sonner imports: ${inventory.directImports.length}`);
  console.log(`Flagged toast calls: ${inventory.calls.filter((call) => call.riskLabels.length > 0).length}`);

  if (failOnDebt) {
    const newDebt = inventory.directImports.length > 0 || inventory.calls.some((call) => call.riskLabels.includes("placeholder"));
    if (newDebt) {
      console.error("Toast guardrail failed: direct sonner imports or placeholder toasts were found.");
      process.exit(1);
    }
  }
}

main();
