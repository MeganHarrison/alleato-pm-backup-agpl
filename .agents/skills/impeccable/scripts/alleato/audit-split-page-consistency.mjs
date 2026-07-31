#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const files = process.argv.slice(2);

if (files.length === 0) {
  console.error("Usage: node scripts/audit-split-page-consistency.mjs <file...>");
  process.exit(2);
}

const listDetailSignals = [
  /\bselected[A-Z]\w*\b/,
  /\bselectedId\b/,
  /\bdetail\b/i,
  /\binbox\b/i,
  /\breview queue\b/i,
  /\bfeedback inbox\b/i,
  /\bfeedback\b/i,
  /\bemail\b/i,
  /\btasks?\b/i,
  /\bcomments?\b/i,
];

const localPaneSignals = [
  /\bxl:w-\[/,
  /\bxl:w-\d+/,
  /\bborder-r\b/,
  /\bborder-l\b/,
  /\bresize\b/i,
  /\bcursor-col-resize\b/,
];

function shouldUseSplitPage(file, text) {
  const normalized = file.replaceAll(path.sep, "/").toLowerCase();
  if (
    normalized.includes("email") ||
    normalized.includes("task") ||
    normalized.includes("comment") ||
    normalized.includes("feedback-inbox")
  ) {
    return true;
  }

  const signalCount = listDetailSignals.filter((pattern) => pattern.test(text)).length;
  const paneCount = localPaneSignals.filter((pattern) => pattern.test(text)).length;
  return signalCount >= 2 && paneCount >= 1;
}

let failures = 0;

for (const file of files) {
  const absolute = path.resolve(file);
  if (!fs.existsSync(absolute)) {
    console.error(`MISSING ${file}`);
    failures += 1;
    continue;
  }

  const text = fs.readFileSync(absolute, "utf8");
  const expected = shouldUseSplitPage(file, text);
  const usesSplitPage = /<SplitPage\b/.test(text);
  const usesSplitPageFrame = /<SplitPageFrame\b/.test(text);
  const importsSplitPage = /@\/components\/ui\/split-page/.test(text);

  if (!expected) {
    console.log(`SKIP ${file} (no list/detail signal)`);
    continue;
  }

  const missing = [];
  if (!importsSplitPage) missing.push("missing split-page import");
  if (!usesSplitPageFrame) missing.push("missing <SplitPageFrame>");
  if (!usesSplitPage) missing.push("missing <SplitPage>");

  if (missing.length === 0) {
    console.log(`PASS ${file}`);
    continue;
  }

  failures += 1;
  console.log(`FAIL ${file}`);
  for (const item of missing) {
    console.log(`  - ${item}`);
  }
}

if (failures > 0) {
  process.exit(1);
}
