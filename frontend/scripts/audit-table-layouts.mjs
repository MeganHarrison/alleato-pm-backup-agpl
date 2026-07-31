#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";

const ROOT = process.cwd();
const APP_DIR = path.join(ROOT, "src", "app");
const SOURCE_DIRS = ["src/app", "src/components", "src/features"].map((dir) => path.join(ROOT, dir));

const PAGE_SUFFIX = `${path.sep}page.tsx`;
const TABLE_PATH_HINTS = [
  `${path.sep}(main)${path.sep}[projectId]${path.sep}`,
  `${path.sep}(tables)${path.sep}`,
];

const NON_TABLE_ROUTE_SEGMENTS = new Set([
  "api",
  "layout.tsx",
  "loading.tsx",
  "error.tsx",
  "not-found.tsx",
  "new",
  "edit",
  "settings",
  "configure",
  "viewer",
  "recycle-bin",
]);

const TABLE_EXCEPTION_RE = /@table-exception:\s*(.{12,})/i;

const ALLOWED_SHARED_TABLE_PATHS = [
  `${path.sep}src${path.sep}components${path.sep}ui${path.sep}table.tsx`,
  `${path.sep}src${path.sep}components${path.sep}tables${path.sep}unified${path.sep}`,
  `${path.sep}src${path.sep}components${path.sep}ds${path.sep}inline-table.tsx`,
];

const IGNORED_SOURCE_PATH_PARTS = [
  `${path.sep}src${path.sep}app${path.sep}api${path.sep}`,
  `${path.sep}src${path.sep}app${path.sep}(admin)${path.sep}template${path.sep}`,
  `${path.sep}src${path.sep}app${path.sep}projects-table-demo.tsx`,
  `${path.sep}src${path.sep}app${path.sep}(admin)${path.sep}projects-table-demo${path.sep}`,
  `${path.sep}src${path.sep}components${path.sep}ds${path.sep}GOLDEN-EXAMPLES.tsx`,
];

function normalizeRoute(pageFilePath) {
  const relative = path.relative(path.join(ROOT, "src", "app"), pageFilePath);
  const noPage = relative.slice(0, -`${path.sep}page.tsx`.length);
  const route = `/${noPage
    .replaceAll(path.sep, "/")
    .replace(/\([^)]*\)\//g, "")
    .replace(/\[projectId\]/g, ":projectId")}`;
  return route;
}

function isCandidateTablePage(pageFilePath) {
  if (!TABLE_PATH_HINTS.some((hint) => pageFilePath.includes(hint))) {
    return false;
  }
  const route = normalizeRoute(pageFilePath);
  const segments = route.split("/").filter(Boolean);
  if (segments.length === 0) return false;
  const leaf = segments[segments.length - 1];
  if (leaf.startsWith(":")) return false;
  if (NON_TABLE_ROUTE_SEGMENTS.has(leaf)) return false;
  return true;
}

async function walk(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walk(fullPath, results);
      continue;
    }
    if (entry.isFile() && fullPath.endsWith(PAGE_SUFFIX)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function walkSource(dir, results = []) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      await walkSource(fullPath, results);
      continue;
    }
    if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
      results.push(fullPath);
    }
  }
  return results;
}

async function findRouteFiles(routeDir) {
  const files = [];
  async function walkRoute(dir) {
    const entries = await fs.readdir(dir, { withFileTypes: true });
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (dir === routeDir && !entry.name.startsWith("_") && entry.name !== "components") {
          continue;
        }
        await walkRoute(fullPath);
      } else if (entry.isFile() && /\.(ts|tsx)$/.test(entry.name)) {
        if (
          dir === routeDir &&
          entry.name !== "page.tsx" &&
          !/(client|table|list|grid)/i.test(entry.name)
        ) {
          continue;
        }
        files.push(fullPath);
      }
    }
  }
  await walkRoute(routeDir);
  return files;
}

function hasTableException(content) {
  return TABLE_EXCEPTION_RE.test(content);
}

function isAllowedSharedTableFile(filePath) {
  return ALLOWED_SHARED_TABLE_PATHS.some((allowedPath) => filePath.includes(allowedPath));
}

function isIgnoredSourceFile(filePath) {
  return (
    path.basename(filePath) === "index.ts" ||
    path.basename(filePath) === "index.tsx" ||
    filePath.endsWith(".stories.tsx") ||
    filePath.endsWith(".test.tsx") ||
    filePath.endsWith(".spec.tsx") ||
    IGNORED_SOURCE_PATH_PARTS.some((ignoredPath) => filePath.includes(ignoredPath))
  );
}

function analyzeContent(content, filePath) {
  const allowedSharedTableFile = isAllowedSharedTableFile(filePath);
  const exception = hasTableException(content);

  const rawHtmlTable = /<table(\s|>)/.test(content);
  const uiTableImport =
    content.includes('from "@/components/ui/table"') ||
    content.includes("from '@/components/ui/table'");
  const shadcnTableUsage = /<Table(Header|Head|Body|Row|Cell|Footer)?(\s|>)/.test(content);
  const genericTable = content.includes('from "@/components/tables/generic-table-factory"');
  const legacyDataTable =
    content.includes('from "@/components/tables/DataTable"') ||
    content.includes("from '@/components/tables/DataTable'") ||
    content.includes('from "@/components/data-table"') ||
    content.includes("from '@/components/data-table'") ||
    content.includes('from "@/components/tables/simple-table-page"') ||
    content.includes("from '@/components/tables/simple-table-page'") ||
    content.includes("<DataTable ");
  const directUnifiedInternalImport =
    content.includes('from "@/components/tables/unified/unified-table-page"') ||
    content.includes('from "@/components/tables/unified/table-toolbar"') ||
    content.includes("from '@/components/tables/unified/unified-table-page'") ||
    content.includes("from '@/components/tables/unified/table-toolbar'");
  const customGridTable =
    /grid-cols-\[[^\n]+border-b[^\n]+uppercase/.test(content) ||
    /border-b[^\n]+grid-cols-\[[^\n]+uppercase/.test(content);

  return {
    unifiedTable:
      content.includes('from "@/components/tables/unified"') ||
      content.includes("UnifiedTablePage") ||
      /import\s+\{[^}]*\b\w*TablePage\b[^}]*\}\s+from\s+["']@\/features\//.test(content),
    genericTable,
    dataTable: legacyDataTable,
    rawHtmlTable,
    uiTableImport,
    shadcnTableUsage,
    customGridTable,
    directUnifiedInternalImport,
    allowedSharedTableFile,
    exception,
    rawTable: !allowedSharedTableFile && (rawHtmlTable || uiTableImport || shadcnTableUsage),
    pageHeader:
      content.includes("PageHeader") || content.includes("ProjectPageHeader"),
    pageContainer:
      content.includes("PageContainer") || content.includes("TableLayout"),
  };
}

function toStatus(flags) {
  const hasNonStandard =
    flags.genericTable ||
    flags.dataTable ||
    flags.rawTable ||
    flags.customGridTable ||
    flags.directUnifiedInternalImport;

  if (hasNonStandard && flags.exception) return "EXCEPTION";
  if (flags.unifiedTable && hasNonStandard) return "MIXED";
  if (flags.unifiedTable) return "OK";
  if (hasNonStandard) return "NON_STANDARD";
  return "UNKNOWN";
}

function hasNonStandard(flags) {
  return (
    flags.genericTable ||
    flags.dataTable ||
    flags.rawTable ||
    flags.customGridTable ||
    flags.directUnifiedInternalImport
  );
}

function parseRouteFilters(args) {
  const routeArg = args.find((arg) => arg.startsWith("--routes="));
  if (!routeArg) return [];
  return routeArg
    .replace("--routes=", "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean);
}

function parseReportPath(args) {
  const reportArg = args.find((arg) => arg.startsWith("--report="));
  if (!reportArg) return null;
  return path.resolve(ROOT, reportArg.replace("--report=", ""));
}

function routeMatchesFilters(route, routeFilters) {
  if (routeFilters.length === 0) return true;
  return routeFilters.some((filter) => route.includes(filter));
}

function summarizeReasons(row) {
  const reasons = [];
  if (row.genericTable) reasons.push("generic-table-factory");
  if (row.dataTable) reasons.push("legacy DataTable");
  if (row.rawTable) reasons.push("raw/shadcn table");
  if (row.customGridTable) reasons.push("custom grid table");
  if (row.directUnifiedInternalImport) reasons.push("direct unified internal import");
  if (row.exception) reasons.push("documented exception");
  return reasons.join(", ") || "no table surface detected";
}

function formatRouteRows(report) {
  const rows = [
    "status\troute\tunified\tgeneric\tdataTable\trawTable\trawHtml\tuiTable\tshadcnTable\tcustomGrid\tdirectInternal\texception\theader\tcontainer\tpageFile",
  ];
  for (const row of report) {
    rows.push(
      [
        row.status,
        row.route,
        row.unifiedTable ? "Y" : "N",
        row.genericTable ? "Y" : "N",
        row.dataTable ? "Y" : "N",
        row.rawTable ? "Y" : "N",
        row.rawHtmlTable ? "Y" : "N",
        row.uiTableImport ? "Y" : "N",
        row.shadcnTableUsage ? "Y" : "N",
        row.customGridTable ? "Y" : "N",
        row.directUnifiedInternalImport ? "Y" : "N",
        row.exception ? "Y" : "N",
        row.pageHeader ? "Y" : "N",
        row.pageContainer ? "Y" : "N",
        row.pageFile,
      ].join("\t"),
    );
  }
  return rows;
}

function formatSourceRows(report) {
  const rows = [
    "status\tfile\tunified\tgeneric\tdataTable\trawTable\trawHtml\tuiTable\tshadcnTable\tcustomGrid\tdirectInternal\texception\treasons",
  ];
  for (const row of report) {
    rows.push(
      [
        row.status,
        row.file,
        row.unifiedTable ? "Y" : "N",
        row.genericTable ? "Y" : "N",
        row.dataTable ? "Y" : "N",
        row.rawTable ? "Y" : "N",
        row.rawHtmlTable ? "Y" : "N",
        row.uiTableImport ? "Y" : "N",
        row.shadcnTableUsage ? "Y" : "N",
        row.customGridTable ? "Y" : "N",
        row.directUnifiedInternalImport ? "Y" : "N",
        row.exception ? "Y" : "N",
        summarizeReasons(row),
      ].join("\t"),
    );
  }
  return rows;
}

function formatMarkdownReport({ routeReport, sourceReport, routeTotals, sourceTotals }) {
  const routeViolations = routeReport.filter((row) => row.status === "MIXED" || row.status === "NON_STANDARD");
  const sourceViolations = sourceReport.filter((row) => row.status === "MIXED" || row.status === "NON_STANDARD");
  const sourceExceptions = sourceReport.filter((row) => row.status === "EXCEPTION");

  const lines = [
    "# Table Layout Audit",
    "",
    "Generated by `cd frontend && npm run audit:table-layouts -- --report=../docs/design/table-layout-audit.md`.",
    "",
    "## Summary",
    "",
    `- Routes scanned: ${routeReport.length}`,
    `- Route status: OK ${routeTotals.OK}, MIXED ${routeTotals.MIXED}, NON_STANDARD ${routeTotals.NON_STANDARD}, EXCEPTION ${routeTotals.EXCEPTION}, UNKNOWN ${routeTotals.UNKNOWN}`,
    `- Source table surfaces scanned: ${sourceReport.length}`,
    `- Source status: OK ${sourceTotals.OK}, MIXED ${sourceTotals.MIXED}, NON_STANDARD ${sourceTotals.NON_STANDARD}, EXCEPTION ${sourceTotals.EXCEPTION}`,
    "",
    "## Route Violations",
    "",
  ];

  if (routeViolations.length === 0) {
    lines.push("- None");
  } else {
    for (const row of routeViolations) {
      lines.push(`- ${row.status}: \`${row.route}\` (${summarizeReasons(row)})`);
      lines.push(`  Owner: \`${row.pageFile}\``);
    }
  }

  lines.push("", "## Source Violations", "");
  if (sourceViolations.length === 0) {
    lines.push("- None");
  } else {
    for (const row of sourceViolations) {
      lines.push(`- ${row.status}: \`${row.file}\` (${summarizeReasons(row)})`);
    }
  }

  lines.push("", "## Documented Exceptions", "");
  if (sourceExceptions.length === 0) {
    lines.push("- None");
  } else {
    for (const row of sourceExceptions) {
      lines.push(`- \`${row.file}\` (${summarizeReasons(row)})`);
    }
  }

  lines.push(
    "",
    "## Rule",
    "",
    "Every app table/list page should use `UnifiedTablePage` from `@/components/tables/unified`. Any intentional divergence must include a specific `@table-exception:` comment in the owning file.",
    "",
  );

  return lines.join("\n");
}

async function main() {
  const routeFilters = parseRouteFilters(process.argv.slice(2));
  const reportPath = parseReportPath(process.argv.slice(2));
  const pageFiles = await walk(APP_DIR);
  const candidatePages = pageFiles.filter(isCandidateTablePage);

  const routeReport = [];
  for (const pageFile of candidatePages) {
    const route = normalizeRoute(pageFile);
    if (!routeMatchesFilters(route, routeFilters)) {
      continue;
    }

    const routeDir = path.dirname(pageFile);
    const files = await findRouteFiles(routeDir);
    const combined = {
      unifiedTable: false,
      genericTable: false,
      dataTable: false,
      rawHtmlTable: false,
      uiTableImport: false,
      shadcnTableUsage: false,
      customGridTable: false,
      directUnifiedInternalImport: false,
      allowedSharedTableFile: false,
      exception: false,
      rawTable: false,
      pageHeader: false,
      pageContainer: false,
    };

    for (const file of files) {
      const content = await fs.readFile(file, "utf8");
      const flags = analyzeContent(content, file);
      combined.unifiedTable = combined.unifiedTable || flags.unifiedTable;
      combined.genericTable = combined.genericTable || flags.genericTable;
      combined.dataTable = combined.dataTable || flags.dataTable;
      combined.rawHtmlTable = combined.rawHtmlTable || flags.rawHtmlTable;
      combined.uiTableImport = combined.uiTableImport || flags.uiTableImport;
      combined.shadcnTableUsage = combined.shadcnTableUsage || flags.shadcnTableUsage;
      combined.customGridTable = combined.customGridTable || flags.customGridTable;
      combined.directUnifiedInternalImport =
        combined.directUnifiedInternalImport || flags.directUnifiedInternalImport;
      combined.allowedSharedTableFile = combined.allowedSharedTableFile || flags.allowedSharedTableFile;
      combined.exception = combined.exception || flags.exception;
      combined.rawTable = combined.rawTable || flags.rawTable;
      combined.pageHeader = combined.pageHeader || flags.pageHeader;
      combined.pageContainer = combined.pageContainer || flags.pageContainer;
    }

    routeReport.push({
      route,
      pageFile: path.relative(ROOT, pageFile),
      status: toStatus(combined),
      ...combined,
    });
  }

  routeReport.sort((a, b) => a.route.localeCompare(b.route));

  const routeTotals = routeReport.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { OK: 0, MIXED: 0, NON_STANDARD: 0, EXCEPTION: 0, UNKNOWN: 0 },
  );

  const sourceFiles = (
    await Promise.all(SOURCE_DIRS.map((sourceDir) => walkSource(sourceDir)))
  )
    .flat()
    .filter((file) => !isIgnoredSourceFile(file))
    .filter((file) => !isAllowedSharedTableFile(file))
    .filter((file) => {
      if (routeFilters.length === 0) return true;
      const relativeFile = path.relative(ROOT, file);
      return routeFilters.some((filter) => relativeFile.includes(filter));
    });

  const sourceReport = [];
  for (const file of sourceFiles) {
    const content = await fs.readFile(file, "utf8");
    const flags = analyzeContent(content, file);
    if (!flags.unifiedTable && !hasNonStandard(flags) && !flags.exception) {
      continue;
    }
    const status = toStatus(flags);
    if (status === "UNKNOWN") {
      continue;
    }
    sourceReport.push({
      file: path.relative(ROOT, file),
      status,
      ...flags,
    });
  }
  sourceReport.sort((a, b) => a.file.localeCompare(b.file));

  const sourceTotals = sourceReport.reduce(
    (acc, row) => {
      acc[row.status] = (acc[row.status] || 0) + 1;
      return acc;
    },
    { OK: 0, MIXED: 0, NON_STANDARD: 0, EXCEPTION: 0, UNKNOWN: 0 },
  );

  console.log("Table Layout Audit");
  console.log(`Routes scanned: ${routeReport.length}`);
  console.log(
    `OK: ${routeTotals.OK} | MIXED: ${routeTotals.MIXED} | NON_STANDARD: ${routeTotals.NON_STANDARD} | EXCEPTION: ${routeTotals.EXCEPTION} | UNKNOWN: ${routeTotals.UNKNOWN}`,
  );
  console.log("");
  console.log(formatRouteRows(routeReport).join("\n"));
  console.log("");
  console.log(`Source table surfaces scanned: ${sourceReport.length}`);
  console.log(
    `OK: ${sourceTotals.OK} | MIXED: ${sourceTotals.MIXED} | NON_STANDARD: ${sourceTotals.NON_STANDARD} | EXCEPTION: ${sourceTotals.EXCEPTION}`,
  );
  console.log("");
  console.log(formatSourceRows(sourceReport).join("\n"));

  if (reportPath) {
    await fs.mkdir(path.dirname(reportPath), { recursive: true });
    await fs.writeFile(
      reportPath,
      formatMarkdownReport({ routeReport, sourceReport, routeTotals, sourceTotals }),
    );
    console.log("");
    console.log(`Wrote ${path.relative(ROOT, reportPath)}`);
  }

  if (
    routeTotals.NON_STANDARD > 0 ||
    routeTotals.MIXED > 0 ||
    sourceTotals.NON_STANDARD > 0 ||
    sourceTotals.MIXED > 0
  ) {
    console.error("");
    console.error(
      "Table consistency violations found. Use UnifiedTablePage from @/components/tables/unified, or add a documented @table-exception: reason comment for a legitimate special case.",
    );
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
