#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { writeRouteInventory } from "../../frontend/scripts/build/route-inventory.mjs";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(scriptDir, "..", "..");
const frontendDir = path.join(repoRoot, "frontend");
const outputDir = path.join(repoRoot, "docs", "reports");

function toCsv(rows, headers) {
  const escape = (value) => {
    const stringValue = String(value ?? "");
    return stringValue.includes(",") || stringValue.includes("\"") || stringValue.includes("\n")
      ? `"${stringValue.replaceAll("\"", "\"\"")}"`
      : stringValue;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((header) => escape(row[header])).join(","))].join("\n");
}

const { enriched, inventoryRows, generatedInventoryPath } = writeRouteInventory({
  frontendRoot: frontendDir,
});
const pages = enriched.filter((route) => route.kind === "page");
const apis = enriched.filter((route) => route.kind === "api");
const metadata = enriched.filter((route) => route.kind === "metadata");
const disabled = enriched.filter((route) => route.kind === "page.nonprod");
const potentiallyOrphaned = pages.filter((route) =>
  route.route !== "/" && route.route !== "/_not-found" && !route.dynamic && route.refCount === 0,
);

fs.mkdirSync(outputDir, { recursive: true });
const reportMd = path.join(outputDir, "route-audit.md");
const routesCsv = path.join(outputDir, "route-inventory.csv");
const orphanCsv = path.join(outputDir, "route-potential-orphans.csv");
const timestamp = new Date().toISOString();

fs.writeFileSync(reportMd, [
  "# Route Audit", "", `Generated: ${timestamp}`, "", "## Summary", "",
  `- Pages: ${pages.length}`, `- API routes: ${apis.length}`, `- Metadata routes: ${metadata.length}`,
  `- Disabled non-prod pages: ${disabled.length}`,
  `- Potentially orphaned static pages (heuristic): ${potentiallyOrphaned.length}`, "",
  "## Notes", "", "- `Potentially orphaned` means no inbound literal route reference found in source.",
  "- Dynamic routes are excluded from orphan detection by default.",
  "- This is static analysis only; it does not include real production traffic analytics.", "",
  "## Potentially Orphaned Static Pages", "", "| Route | File |", "|---|---|",
  ...potentiallyOrphaned.map((route) => `| ${route.route} | ${path.relative(repoRoot, route.file)} |`), "",
  "## Disabled Non-Prod Pages", "", "| Route | File |", "|---|---|",
  ...disabled.map((route) => `| ${route.route} | ${path.relative(repoRoot, route.file)} |`), "",
].join("\n"));

fs.writeFileSync(routesCsv, toCsv(inventoryRows, ["route", "kind", "dynamic", "refCount", "file", "refSample"]));
fs.writeFileSync(orphanCsv, toCsv(potentiallyOrphaned.map((route) => ({
  route: route.route,
  file: path.relative(repoRoot, route.file),
  dynamic: route.dynamic,
  refCount: route.refCount,
})), ["route", "file", "dynamic", "refCount"]));

console.log("Route audit completed.");
console.log(`- ${reportMd}`);
console.log(`- ${routesCsv}`);
console.log(`- ${orphanCsv}`);
console.log(`- ${generatedInventoryPath}`);
