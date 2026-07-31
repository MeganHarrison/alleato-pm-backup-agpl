#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import { readFileSync } from "node:fs";

const canonicalOwner = "frontend/src/components/tables/unified/table-settings-popover.tsx";
const candidateFiles = execFileSync(
  "git",
  ["ls-files", "frontend/src/components/tables", "frontend/src/features", "frontend/src/app"],
  { encoding: "utf8" },
)
  .split("\n")
  .filter((file) => /\.(tsx|ts)$/.test(file));

const violations = [];
for (const file of candidateFiles) {
  if (file === canonicalOwner || file.includes("/__tests__/")) continue;
  const source = readFileSync(file, "utf8");
  const ownsSettingsSurface =
    /export\s+(?:function|const)\s+(?:FilterMenu|TableDisplaySettings)\b/.test(source) ||
    /export\s+(?:function|const)\s+(?:ViewSettings|TableSettings)\b/.test(source);
  if (!ownsSettingsSurface) continue;
  if (!source.includes("TableSettingsPopover")) {
    violations.push(file);
  }
}

if (violations.length > 0) {
  console.error("Table settings design-system violations detected:");
  for (const file of violations) {
    console.error(`- ${file}: use TableSettingsPopover for view/filter/display settings.`);
  }
  process.exit(1);
}

console.log("Table settings design-system guardrail passed.");
