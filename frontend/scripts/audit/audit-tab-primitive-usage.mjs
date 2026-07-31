#!/usr/bin/env node

import { promises as fs } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const FRONTEND_ROOT = path.resolve(__dirname, "..", "..");
const SRC_ROOT = path.join(FRONTEND_ROOT, "src");

const EXTENSIONS = new Set([".ts", ".tsx"]);
const SKIP_DIRS = new Set([
  "node_modules",
  ".next",
  "dist",
  "build",
  "__tests__",
  "__generated__",
]);
const SKIP_FILE_PATTERNS = [".stories.", ".test.", ".spec."];
const DEPRECATED_PAGE_TABS_FILE = "src/components/layout/PageTabsV2.tsx";
const APP_PAGE_TABS_EXCEPTIONS = {
  "src/app/(admin)/annotation-inbox/page.tsx":
    "Status tabs are a local filter control, not page-level navigation.",
  "src/app/(admin)/design-violations/page.tsx":
    "Status tabs are a local filter control, not page-level navigation.",
};

const PAGE_SHELL_MARKERS = [
  "PageShell",
  "ProjectPageHeader",
  "PageHeader",
  "PageContainer",
];

const PAGE_STYLE_MARKERS = [
  "rounded-none",
  "border-b-2",
  "data-[state=active]:border-primary",
  "data-[state=active]:shadow-none",
  "border-b border-border",
];

async function* walk(dir) {
  let entries = [];
  try {
    entries = await fs.readdir(dir, { withFileTypes: true });
  } catch {
    return;
  }

  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);

    if (entry.isDirectory()) {
      if (SKIP_DIRS.has(entry.name) || entry.name.startsWith(".")) continue;
      yield* walk(fullPath);
      continue;
    }

    if (!entry.isFile()) continue;
    if (!EXTENSIONS.has(path.extname(entry.name))) continue;
    if (SKIP_FILE_PATTERNS.some((pattern) => entry.name.includes(pattern))) continue;

    yield fullPath;
  }
}

function rel(filePath) {
  return path.relative(FRONTEND_ROOT, filePath).replaceAll("\\", "/");
}

function hasImport(source, importPath) {
  return source.includes(`from "${importPath}"`) || source.includes(`from '${importPath}'`);
}

function countMatches(source, regex) {
  return [...source.matchAll(regex)].length;
}

function extractTabClassNames(source) {
  const classNames = [];
  const regex =
    /<(TabsList|TabsTrigger)\b[^>]*className\s*=\s*(?:"([^"]*)"|'([^']*)'|\{`([^`]*)`\})/g;

  for (const match of source.matchAll(regex)) {
    const className = match[2] || match[3] || match[4];
    if (className) classNames.push(className);
  }

  return classNames;
}

function findTabStyleMarkers(source) {
  const classNames = extractTabClassNames(source);
  const markers = new Set();

  for (const className of classNames) {
    for (const marker of PAGE_STYLE_MARKERS) {
      if (className.includes(marker)) {
        markers.add(marker);
      }
    }
  }

  return [...markers];
}

function buildFinding(file, confidence, reason, evidence) {
  return { file, confidence, reason, evidence };
}

async function main() {
  const exactViolations = [];
  const likelyWrongPageTabs = [];
  const pageStyleSectionTabs = [];
  const inventory = {
    pageTabsFiles: 0,
    sectionTabsFiles: 0,
    appPageTabsFiles: 0,
  };

  for await (const filePath of walk(SRC_ROOT)) {
    const source = await fs.readFile(filePath, "utf8");
    const file = rel(filePath);

    const importsPageTabs =
      hasImport(source, "@/components/layout") ||
      hasImport(source, "@/components/layout/PageTabs");
    const importsTabs = hasImport(source, "@/components/ui/tabs");
    const importsPageTabsV2 =
      hasImport(source, "@/components/layout/PageTabsV2") ||
      source.includes("PageTabsV2");
    const importsRawRadix =
      hasImport(source, "radix-ui") || hasImport(source, "@radix-ui/react-tabs");

    const pageTabsCount = countMatches(source, /<PageTabs\b/g);
    const tabsCount = countMatches(source, /<Tabs\b/g);
    const tabsContentCount = countMatches(source, /<TabsContent\b/g);
    const lineVariantCount = countMatches(
      source,
      /<TabsList[^>]*variant=["']line["']/g,
    );

    if (pageTabsCount > 0) inventory.pageTabsFiles += 1;
    if (tabsCount > 0) inventory.sectionTabsFiles += 1;
    if (file.startsWith("src/app/") && pageTabsCount > 0) inventory.appPageTabsFiles += 1;

    if (importsPageTabsV2 && file !== DEPRECATED_PAGE_TABS_FILE) {
      exactViolations.push(
        buildFinding(
          file,
          "exact",
          "Deprecated PageTabsV2 import or reference",
          "Use PageTabs for page/tool tabs or Tabs for section tabs.",
        ),
      );
    }

    if (importsRawRadix && !file.startsWith("src/components/ui/")) {
      exactViolations.push(
        buildFinding(
          file,
          "exact",
          "Raw Radix tabs import outside shared ui primitive",
          'Use "@/components/ui/tabs" instead.',
        ),
      );
    }

    if (lineVariantCount > 0) {
      exactViolations.push(
        buildFinding(
          file,
          "exact",
          'TabsList variant="line" still present',
          `${lineVariantCount} occurrence(s)`,
        ),
      );
    }

    if (!importsTabs || tabsCount === 0) continue;

    const shellMarkersFound = PAGE_SHELL_MARKERS.filter((marker) => source.includes(marker));
    const pageStyleMarkersFound = findTabStyleMarkers(source);
    const isAppPage = file.startsWith("src/app/") && file.endsWith("/page.tsx");
    const usesPageTabsToo = pageTabsCount > 0;
    const appPageTabsException =
      APP_PAGE_TABS_EXCEPTIONS[file];

    if (appPageTabsException) {
      continue;
    }

    if (
      isAppPage &&
      shellMarkersFound.length > 0 &&
      !usesPageTabsToo &&
      tabsContentCount === 0
    ) {
      likelyWrongPageTabs.push(
        buildFinding(
          file,
          "high",
          "App page imports section Tabs alongside page-shell markers",
          `Markers: ${shellMarkersFound.join(", ")}`,
        ),
      );
      continue;
    }

    if (isAppPage && !usesPageTabsToo && tabsContentCount === 0) {
      likelyWrongPageTabs.push(
        buildFinding(
          file,
          "medium",
          "App page uses Tabs without PageTabs",
          "Review whether these are top-level page/tool tabs or true section tabs.",
        ),
      );
    }

    if (pageStyleMarkersFound.length > 0) {
      pageStyleSectionTabs.push(
        buildFinding(
          file,
          isAppPage ? "high" : "medium",
          "Section Tabs are styled to mimic page tabs",
          `Style markers: ${pageStyleMarkersFound.join(", ")}`,
        ),
      );
    }
  }

  const sortByConfidence = (items) => {
    const rank = { exact: 0, high: 1, medium: 2, low: 3 };
    return items.sort((a, b) => {
      const rankDiff = rank[a.confidence] - rank[b.confidence];
      return rankDiff !== 0 ? rankDiff : a.file.localeCompare(b.file);
    });
  };

  sortByConfidence(exactViolations);
  sortByConfidence(likelyWrongPageTabs);
  sortByConfidence(pageStyleSectionTabs);

  console.log("=== Tab Primitive Audit ===");
  console.log("");
  console.log("Inventory");
  console.log(`- Files using PageTabs: ${inventory.pageTabsFiles}`);
  console.log(`- App pages using PageTabs: ${inventory.appPageTabsFiles}`);
  console.log(`- Files using Tabs: ${inventory.sectionTabsFiles}`);
  console.log("");

  const printFindings = (title, findings) => {
    console.log(title);
    if (findings.length === 0) {
      console.log("- None");
      console.log("");
      return;
    }

    for (const finding of findings) {
      console.log(
        `- [${finding.confidence}] ${finding.file}: ${finding.reason}. ${finding.evidence}`,
      );
    }
    console.log("");
  };

  printFindings("Exact Violations", exactViolations);
  printFindings("Likely Wrong Page-Level Tabs", likelyWrongPageTabs);
  printFindings("Likely Section Tabs Styled Like Page Tabs", pageStyleSectionTabs);

  console.log("Suggested Review Order");
  console.log("- Fix exact violations first.");
  console.log("- Then review high-confidence page-level Tabs still living in app pages.");
  console.log("- Finally review custom-styled section tabs that may be recreating page-tab visuals.");
}

main().catch((error) => {
  console.error("audit-tab-primitive-usage failed:", error?.message || error);
  process.exit(1);
});
