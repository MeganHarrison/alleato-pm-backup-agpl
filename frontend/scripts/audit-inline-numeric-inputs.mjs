import fs from "node:fs/promises";
import path from "node:path";

const ROOT = path.resolve(process.cwd(), "src");
const TARGET_EXTENSIONS = new Set([".tsx", ".jsx"]);
const failOnFindings = process.argv.includes("--fail-on-findings");

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map(async (entry) => {
      const resolved = path.join(dir, entry.name);
      if (entry.isDirectory()) return walk(resolved);
      return TARGET_EXTENSIONS.has(path.extname(entry.name)) ? [resolved] : [];
    }),
  );
  return files.flat();
}

function findRawNumericInputLines(content) {
  return content
    .split("\n")
    .map((line, index) => ({ line, lineNumber: index + 1 }))
    .filter(({ line }) => {
      if (!line.includes("<Input")) return false;
      return (
        line.includes('type="number"') ||
        line.includes('inputMode="decimal"') ||
        line.includes('inputMode="numeric"') ||
        line.includes(" step=")
      );
    });
}

const files = await walk(ROOT);
const findings = [];

for (const file of files) {
  const content = await fs.readFile(file, "utf8");
  if (!content.includes("InlineTable")) continue;
  for (const finding of findRawNumericInputLines(content)) {
    findings.push({
      file: path.relative(process.cwd(), file),
      lineNumber: finding.lineNumber,
      line: finding.line.trim(),
    });
  }
}

if (!findings.length) {
  console.log("PASS: no raw numeric <Input> usage found inside InlineTable files.");
  process.exit(0);
}

console.log(
  `FOUND ${findings.length} raw numeric <Input> usage(s) inside InlineTable files:`,
);
for (const finding of findings) {
  console.log(`- ${finding.file}:${finding.lineNumber} ${finding.line}`);
}

if (failOnFindings) {
  process.exit(1);
}
