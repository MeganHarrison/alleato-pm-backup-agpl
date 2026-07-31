#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../..");
const srcRoot = path.join(repoRoot, "src");
const write = process.argv.includes("--write");

const patterns = [
  /placeholder\s*=\s*"0"/g,
  /placeholder\s*=\s*"0\.0"/g,
  /placeholder\s*=\s*"0\.00"/g,
  /placeholder\s*=\s*"\$0\.00"/g,
];

function walk(dir) {
  const out = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith(".")) continue;
    const abs = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      out.push(...walk(abs));
      continue;
    }
    out.push(abs);
  }
  return out;
}

function rel(filePath) {
  return path.relative(repoRoot, filePath).replace(/\\/g, "/");
}

function main() {
  const files = walk(srcRoot).filter((file) => /\.(tsx?|jsx?)$/.test(file));
  let touched = 0;
  let replacements = 0;

  for (const file of files) {
    const original = fs.readFileSync(file, "utf8");
    let next = original;
    let fileReplacements = 0;

    for (const pattern of patterns) {
      next = next.replace(pattern, () => {
        fileReplacements += 1;
        return 'placeholder=""';
      });
    }

    if (fileReplacements === 0) continue;
    touched += 1;
    replacements += fileReplacements;
    console.log(`${rel(file)}: ${fileReplacements} replacement(s)`);

    if (write) {
      fs.writeFileSync(file, next);
    }
  }

  const mode = write ? "write" : "dry-run";
  console.log(
    `normalize-zero-placeholders (${mode}): ${replacements} replacement(s) across ${touched} file(s)`,
  );
}

main();

