import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

export const INVENTORY_RELATIVE_PATH = path.join("src", "app", "(admin)", "site-map", "route-inventory.generated.json");

const PAGE_EXTS = new Set([".tsx", ".ts", ".jsx", ".js", ".mdx"]);
const SOURCE_EXTS = new Set([".ts", ".tsx", ".js", ".jsx", ".mdx"]);

function walk(dir, files = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name !== "node_modules" && entry.name !== ".next") walk(full, files);
    } else {
      files.push(full);
    }
  }
  return files;
}

function routeFromRelative(relativeFile) {
  const segments = relativeFile.split(path.sep);
  const file = segments.at(-1);
  const base = path.basename(file, path.extname(file));
  if (file === "sitemap.ts") return { route: "/sitemap.xml", kind: "metadata" };
  if (file === "robots.ts") return { route: "/robots.txt", kind: "metadata" };
  const normalized = segments.slice(0, -1).filter((segment) => segment && !(segment.startsWith("(") && segment.endsWith(")")) && !segment.startsWith("@"));
  const route = normalized.length ? `/${normalized.join("/")}` : "/";
  if (base === "page" || base === "page.nonprod") return { route, kind: base === "page" ? "page" : "page.nonprod" };
  if (base === "route") return { route, kind: "api" };
  return null;
}

function staticPrefix(route) {
  const prefix = [];
  for (const segment of route.split("/").filter(Boolean)) {
    if (segment.startsWith("[") || segment.includes(":")) break;
    prefix.push(segment);
  }
  return prefix.length ? `/${prefix.join("/")}` : "/";
}

function displayPath(frontendRoot, file, displayPrefix) {
  return `${displayPrefix}/${path.relative(frontendRoot, file).split(path.sep).join("/")}`;
}

/**
 * Generates the Page Access inventory without a repository-root dependency so
 * the Vercel project can invoke it from its configured `frontend/` root.
 */
export function generateRouteInventory({ frontendRoot, displayPrefix = "frontend" } = {}) {
  if (!frontendRoot) throw new Error("[route-inventory] frontendRoot is required.");
  const appDir = path.join(frontendRoot, "src", "app");
  const srcDir = path.join(frontendRoot, "src");
  if (!fs.existsSync(appDir) || !fs.existsSync(srcDir)) {
    throw new Error(`[route-inventory] Missing frontend source directories under ${frontendRoot}.`);
  }

  const sourceTexts = walk(srcDir)
    .filter((file) => SOURCE_EXTS.has(path.extname(file)))
    .map((file) => ({ file, text: fs.readFileSync(file, "utf8") }));
  const routes = walk(appDir)
    .filter((file) => PAGE_EXTS.has(path.extname(file)))
    .map((file) => {
      const routeInfo = routeFromRelative(path.relative(appDir, file));
      return routeInfo ? { ...routeInfo, file, dynamic: routeInfo.route.includes("[") || routeInfo.route.includes(":") } : null;
    })
    .filter(Boolean)
    .sort((left, right) => left.route.localeCompare(right.route) || left.kind.localeCompare(right.kind));

  const enriched = routes.map((route) => {
    const prefix = staticPrefix(route.route);
    const refFiles = sourceTexts
      .filter((source) => {
        if (source.file === route.file) return false;
        const exact = ["\"", "'", "`"].some((quote) => source.text.includes(`${quote}${route.route}${quote}`));
        return exact || (!route.dynamic && prefix !== "/" && source.text.includes(prefix));
      })
      .map((source) => displayPath(frontendRoot, source.file, displayPrefix));
    return { ...route, refCount: refFiles.length, refSample: refFiles.slice(0, 5).join("; ") };
  });

  return {
    enriched,
    inventoryRows: enriched.map((route) => ({
      route: route.route,
      kind: route.kind,
      dynamic: String(route.dynamic),
      refCount: String(route.refCount),
      file: displayPath(frontendRoot, route.file, displayPrefix),
      refSample: route.refSample,
    })),
    generatedInventoryPath: path.join(frontendRoot, INVENTORY_RELATIVE_PATH),
  };
}

export function writeRouteInventory(options) {
  const result = generateRouteInventory(options);
  fs.writeFileSync(result.generatedInventoryPath, `${JSON.stringify(result.inventoryRows, null, 2)}\n`);
  return result;
}

/**
 * Fails when the checked-in Page Access snapshot no longer describes the
 * current route tree. The production build regenerates this file before
 * Next.js bundles it, but local/CI route gates must reject drift rather than
 * leave reviewers looking at an obsolete route list.
 */
export function assertRouteInventoryFresh({ frontendRoot, inventoryPath } = {}) {
  if (!frontendRoot) throw new Error("[route-inventory] frontendRoot is required.");
  const resolvedInventoryPath = inventoryPath ?? path.join(frontendRoot, INVENTORY_RELATIVE_PATH);
  if (!fs.existsSync(resolvedInventoryPath)) {
    throw new Error(
      `[route-inventory] Missing committed inventory: ${resolvedInventoryPath}. ` +
        "Run node scripts/verify/route-audit.mjs and commit its generated route files.",
    );
  }

  let committedRows;
  try {
    committedRows = JSON.parse(fs.readFileSync(resolvedInventoryPath, "utf8"));
  } catch {
    throw new Error(
      `[route-inventory] Invalid committed inventory: ${resolvedInventoryPath}. ` +
        "Run node scripts/verify/route-audit.mjs and commit its generated route files.",
    );
  }

  const currentRows = generateRouteInventory({ frontendRoot }).inventoryRows;
  if (JSON.stringify(committedRows) !== JSON.stringify(currentRows)) {
    throw new Error(
      `[route-inventory] Committed inventory is stale (${Array.isArray(committedRows) ? committedRows.length : "invalid"} snapshot rows, ` +
        `${currentRows.length} current source rows). Run node scripts/verify/route-audit.mjs and commit ` +
        "frontend/src/app/(admin)/site-map/route-inventory.generated.json.",
    );
  }

  return currentRows.length;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
  const result = writeRouteInventory({ frontendRoot });
  console.log(`[route-inventory] Generated ${result.inventoryRows.length} rows: ${result.generatedInventoryPath}`);
}
