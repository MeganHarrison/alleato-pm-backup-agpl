#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

const repoRoot = process.cwd();
const frontendDir = path.join(repoRoot, "frontend");
const appDir = path.join(frontendDir, "src", "app");
const srcDir = path.join(frontendDir, "src");
const outputDir = path.join(repoRoot, "docs", "reports");

const PAGE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".mdx"]);

function walk(dir, files = []) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === "node_modules" || entry.name === ".next") continue;
      walk(full, files);
      continue;
    }
    files.push(full);
  }
  return files;
}

function normalizeSegments(segments) {
  const parts = [];
  for (const segment of segments) {
    if (!segment) continue;
    if (segment.startsWith("(") && segment.endsWith(")")) continue;
    if (segment.startsWith("@")) continue;
    parts.push(segment);
  }
  return parts;
}

function routeFromRelative(relativeFile) {
  const segments = relativeFile.split(path.sep);
  const file = segments[segments.length - 1];
  const ext = path.extname(file);
  const base = path.basename(file, ext);

  if (file === "sitemap.ts") {
    return { route: "/sitemap.xml", kind: "metadata" };
  }
  if (file === "robots.ts") {
    return { route: "/robots.txt", kind: "metadata" };
  }

  if (base === "page" || base === "page.nonprod") {
    const raw = normalizeSegments(segments.slice(0, -1));
    const route = `/${raw.join("/")}`.replace(/\/+/g, "/");
    return { route: route === "/" ? "/" : route, kind: base === "page" ? "page" : "page.nonprod" };
  }

  if (base === "route") {
    const raw = normalizeSegments(segments.slice(0, -1));
    const route = `/${raw.join("/")}`.replace(/\/+/g, "/");
    return { route: route === "/" ? "/" : route, kind: "api" };
  }

  return null;
}

function isSourceFile(file) {
  const ext = path.extname(file);
  return [".ts", ".tsx", ".js", ".jsx", ".mdx"].includes(ext);
}

function fileText(file) {
  try {
    return fs.readFileSync(file, "utf8");
  } catch {
    return "";
  }
}

function isDynamicRoute(route) {
  return route.includes("[") || route.includes(":");
}

function staticPrefix(route) {
  const parts = route.split("/").filter(Boolean);
  const keep = [];
  for (const part of parts) {
    if (part.startsWith("[") || part.includes(":")) break;
    keep.push(part);
  }
  if (keep.length === 0) return "/";
  return `/${keep.join("/")}`;
}

function toCsv(rows, headers) {
  const escape = (value) => {
    const str = String(value ?? "");
    if (str.includes(",") || str.includes("\"") || str.includes("\n")) {
      return `"${str.replaceAll("\"", "\"\"")}"`;
    }
    return str;
  };
  return [headers.join(","), ...rows.map((row) => headers.map((h) => escape(row[h])).join(","))].join("\n");
}

const appFiles = walk(appDir).filter((f) => PAGE_EXTS.has(path.extname(f)));
const allSrcFiles = walk(srcDir).filter(isSourceFile);

const routes = [];
for (const full of appFiles) {
  const relative = path.relative(appDir, full);
  const routeInfo = routeFromRelative(relative);
  if (!routeInfo) continue;

  routes.push({
    route: routeInfo.route,
    kind: routeInfo.kind,
    file: full,
    dynamic: isDynamicRoute(routeInfo.route),
  });
}

routes.sort((a, b) => a.route.localeCompare(b.route) || a.kind.localeCompare(b.kind));

const sourceTexts = allSrcFiles.map((file) => ({ file, text: fileText(file) }));

const enriched = routes.map((route) => {
  const target = route.route;
  const prefix = staticPrefix(target);
  let refCount = 0;
  const refFiles = [];

  for (const src of sourceTexts) {
    if (src.file === route.file) continue;
    const hitExact =
      src.text.includes(`"${target}"`) ||
      src.text.includes(`'${target}'`) ||
      src.text.includes("`" + target + "`");
    const hitPrefix = !route.dynamic && prefix !== "/" ? src.text.includes(prefix) : false;
    if (hitExact || hitPrefix) {
      refCount += 1;
      refFiles.push(path.relative(repoRoot, src.file));
    }
  }

  return {
    ...route,
    refCount,
    refSample: refFiles.slice(0, 5).join("; "),
  };
});

const pages = enriched.filter((r) => r.kind === "page");
const apis = enriched.filter((r) => r.kind === "api");
const metadata = enriched.filter((r) => r.kind === "metadata");
const disabled = enriched.filter((r) => r.kind === "page.nonprod");

const potentiallyOrphaned = pages.filter((r) => {
  if (r.route === "/" || r.route === "/_not-found") return false;
  if (r.dynamic) return false;
  return r.refCount === 0;
});

fs.mkdirSync(outputDir, { recursive: true });

const timestamp = new Date().toISOString();
const reportMd = path.join(outputDir, "route-audit.md");
const routesCsv = path.join(outputDir, "route-inventory.csv");
const orphanCsv = path.join(outputDir, "route-potential-orphans.csv");

const mdLines = [
  "# Route Audit",
  "",
  `Generated: ${timestamp}`,
  "",
  "## Summary",
  "",
  `- Pages: ${pages.length}`,
  `- API routes: ${apis.length}`,
  `- Metadata routes: ${metadata.length}`,
  `- Disabled non-prod pages: ${disabled.length}`,
  `- Potentially orphaned static pages (heuristic): ${potentiallyOrphaned.length}`,
  "",
  "## Notes",
  "",
  "- `Potentially orphaned` means no inbound literal route reference found in source.",
  "- Dynamic routes are excluded from orphan detection by default.",
  "- This is static analysis only; it does not include real production traffic analytics.",
  "",
  "## Potentially Orphaned Static Pages",
  "",
  "| Route | File |",
  "|---|---|",
  ...potentiallyOrphaned.map((r) => `| ${r.route} | ${path.relative(repoRoot, r.file)} |`),
  "",
  "## Disabled Non-Prod Pages",
  "",
  "| Route | File |",
  "|---|---|",
  ...disabled.map((r) => `| ${r.route} | ${path.relative(repoRoot, r.file)} |`),
];

fs.writeFileSync(reportMd, mdLines.join("\n"));

fs.writeFileSync(
  routesCsv,
  toCsv(
    enriched.map((r) => ({
      route: r.route,
      kind: r.kind,
      dynamic: r.dynamic,
      refCount: r.refCount,
      file: path.relative(repoRoot, r.file),
      refSample: r.refSample,
    })),
    ["route", "kind", "dynamic", "refCount", "file", "refSample"],
  ),
);

fs.writeFileSync(
  orphanCsv,
  toCsv(
    potentiallyOrphaned.map((r) => ({
      route: r.route,
      file: path.relative(repoRoot, r.file),
      dynamic: r.dynamic,
      refCount: r.refCount,
    })),
    ["route", "file", "dynamic", "refCount"],
  ),
);

console.log("Route audit completed.");
console.log(`- ${reportMd}`);
console.log(`- ${routesCsv}`);
console.log(`- ${orphanCsv}`);
