#!/usr/bin/env node
import fs from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import playwright from "../frontend/node_modules/@playwright/test/index.js";

const { chromium } = playwright;

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const appRoot = path.join(repoRoot, "frontend/src/app");
const outputRoot =
  process.env.OUTPUT_DIR ||
  path.join(repoRoot, "frontend/public/app-page-screenshots");
const screenshotDir = path.join(outputRoot, "screenshots");
const baseUrl = (process.env.BASE_URL || "https://projects.alleatogroup.com").replace(/\/$/, "");
const projectId = process.env.PROJECT_ID || "1034";
const routeSet = process.env.ROUTE_SET || "product-tools";
const storageState =
  process.env.STORAGE_STATE ||
  path.join(repoRoot, "frontend/tests/.auth/user.json");

const staticParamSamples = new Map([
  ["projectId", projectId],
  ["type", "all"],
  ["toolCategory", "commitments"],
  ["docSlug", "create-a-commitment"],
  ["slug", "overview"],
  ["articleId", "overview"],
  ["tool", "commitments"],
  ["caseId", "1"],
  ["runId", "1"],
  ["caseNumber", "1"],
  ["submissionId", "sample"],
  ["briefId", "sample"],
  ["sourceDocumentId", "sample"],
]);

const skipDynamicNames = new Set([
  "changeEventId",
  "changeOrderId",
  "commitmentCoId",
  "pcoId",
  "commitmentId",
  "invoiceId",
  "dailyLogId",
  "costId",
  "documentId",
  "drawingId",
  "estimateId",
  "meetingId",
  "contractId",
  "reportId",
  "punchItemId",
  "rfiId",
  "sectionId",
  "submittalId",
  "companyId",
  "contactId",
  "vendorId",
  "personId",
  "userSlug",
  "requestId",
  "insightId",
  "token",
]);

const productToolPrefixes = [
  "budget",
  "prime-contracts",
  "commitments",
  "change-events",
  "change-orders",
  "schedule",
  "meetings",
  "daily-log",
  "punch-list",
  "rfis",
  "submittals",
  "transmittals",
  "photos",
  "drawings",
  "specifications",
  "documents",
];

function productTool(route) {
  const match = route.match(/^\/\[projectId\]\/([^/]+)/);
  return match?.[1] ?? null;
}

function routeSetIncludes(item) {
  if (routeSet === "all") return isApplicationScope(item.scope);
  if (routeSet !== "product-tools") {
    throw new Error(`Unsupported ROUTE_SET "${routeSet}". Use "product-tools" or "all".`);
  }

  const tool = productTool(item.route);
  return item.scope === "main" && tool !== null && productToolPrefixes.includes(tool);
}

async function walk(dir) {
  const entries = await fs.readdir(dir, { withFileTypes: true });
  const files = await Promise.all(
    entries.map((entry) => {
      const fullPath = path.join(dir, entry.name);
      return entry.isDirectory() ? walk(fullPath) : fullPath;
    }),
  );
  return files.flat();
}

function stripRouteGroups(segment) {
  return segment.startsWith("(") && segment.endsWith(")") ? "" : segment;
}

function fileToRoute(filePath) {
  const relative = path.relative(appRoot, filePath).replaceAll(path.sep, "/");
  const withoutPage = relative.replace(/\/page\.tsx$/, "").replace(/^page\.tsx$/, "");
  const segments = withoutPage
    .split("/")
    .map(stripRouteGroups)
    .filter(Boolean);
  return `/${segments.join("/")}`.replace(/\/$/, "") || "/";
}

function routeScope(filePath) {
  if (filePath.includes("/(main)/")) return "main";
  if (filePath.includes("/(admin)/") || filePath.includes("/admin/")) return "admin";
  if (filePath.includes("/(tables)/")) return "tables";
  if (filePath.includes("/(dashboard)/")) return "dashboard";
  if (filePath.includes("/(public)/")) return "public";
  if (filePath.includes("/auth/")) return "auth";
  if (filePath.includes("/respond/")) return "respond";
  return "other";
}

function substituteRoute(route) {
  const dynamicNames = [...route.matchAll(/\[+\.{0,3}([^\]]+)\]+/g)].map((match) => match[1]);
  const unresolved = [];
  let urlPath = route;

  for (const name of dynamicNames) {
    if (staticParamSamples.has(name)) {
      const value = staticParamSamples.get(name);
      urlPath = urlPath
        .replace(`[[...${name}]]`, value)
        .replace(`[...${name}]`, value)
        .replace(`[${name}]`, value);
      continue;
    }
    unresolved.push(name);
  }

  if (unresolved.some((name) => skipDynamicNames.has(name))) {
    return { status: "skipped_dynamic_record", unresolved };
  }

  if (unresolved.length > 0) {
    return { status: "skipped_unknown_param", unresolved };
  }

  return { status: "ready", urlPath };
}

function isApplicationScope(scope) {
  return ["main", "admin", "tables", "dashboard"].includes(scope);
}

function safeName(index, route) {
  const name =
    route === "/"
      ? "root"
      : route
          .replace(/^\//, "")
          .replaceAll("/", "__")
          .replaceAll("[", "")
          .replaceAll("]", "")
          .replaceAll(".", "");
  return `${String(index).padStart(3, "0")}-${name}.png`;
}

async function waitForPage(page) {
  await page.waitForLoadState("domcontentloaded", { timeout: 20000 }).catch(() => {});
  await page.waitForLoadState("networkidle", { timeout: 6000 }).catch(() => {});
  await page.waitForTimeout(900);
  await page.mouse.move(1320, 520).catch(() => {});
  await page.waitForTimeout(250);
}

async function installCaptureStyles(page) {
  await page.addStyleTag({
    content: `
      [data-radix-popper-content-wrapper],
      [role="tooltip"],
      [data-sonner-toaster],
      .fixed.bottom-4.right-4,
      .fixed.bottom-6.right-6,
      button[aria-label*="Ask" i],
      button[aria-label*="AI" i] {
        display: none !important;
      }
      * {
        scroll-behavior: auto !important;
        animation-duration: 0.01ms !important;
        transition-duration: 0.01ms !important;
      }
    `,
  });
}

async function getContentClip(page) {
  return page.evaluate(() => {
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const candidates = Array.from(document.querySelectorAll("aside, nav, [data-sidebar], [class*='sidebar' i]"))
      .map((element) => {
        const rect = element.getBoundingClientRect();
        const style = window.getComputedStyle(element);
        return {
          left: rect.left,
          right: rect.right,
          width: rect.width,
          height: rect.height,
          visible:
            style.display !== "none" &&
            style.visibility !== "hidden" &&
            rect.height > viewportHeight * 0.5 &&
            rect.width >= 40 &&
            rect.width <= 360 &&
            rect.left <= 4,
        };
      })
      .filter((candidate) => candidate.visible);

    const sidebarRight = candidates.reduce((max, candidate) => Math.max(max, candidate.right), 0);
    const left = Math.max(0, Math.min(Math.ceil(sidebarRight), viewportWidth - 400));
    return {
      x: left,
      y: 0,
      width: viewportWidth - left,
      height: viewportHeight,
    };
  });
}

async function main() {
  await fs.rm(screenshotDir, { recursive: true, force: true });
  await fs.mkdir(screenshotDir, { recursive: true });
  const pageFiles = (await walk(appRoot))
    .filter((file) => file.endsWith("/page.tsx"))
    .sort();

  const inventory = pageFiles.map((file) => {
    const route = fileToRoute(file);
    const scope = routeScope(file);
    const substitution = substituteRoute(route);
    const tool = productTool(route);
    return {
      source: path.relative(repoRoot, file),
      route,
      scope,
      included: false,
      tool,
      ...substitution,
    };
  });
  inventory.forEach((item) => {
    item.included = routeSetIncludes(item);
  });

  const targets = inventory.filter((item) => item.included && item.status === "ready");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
    storageState,
  });
  const page = await context.newPage();

  const results = [];
  let captureIndex = 0;
  for (const item of inventory) {
    if (!item.included) {
      results.push({ ...item, status: "skipped_non_app_scope" });
      continue;
    }

    if (item.status !== "ready") {
      results.push(item);
      continue;
    }

    captureIndex += 1;
    const fileName = safeName(captureIndex, item.urlPath);
    const screenshotPath = path.join(screenshotDir, fileName);
    const url = `${baseUrl}${item.urlPath}`;
    const result = {
      ...item,
      url,
      status: "pending",
    };

    try {
      const response = await page.goto(url, { waitUntil: "domcontentloaded", timeout: 30000 });
      await installCaptureStyles(page).catch(() => {});
      await waitForPage(page);
      const finalUrl = page.url();
      const title = await page.title().catch(() => "");
      result.status = "captured";
      result.httpStatus = response?.status() || null;
      result.finalUrl = finalUrl;
      result.title = title;
      if (finalUrl.includes("/auth/login")) result.status = "captured_login_redirect";
      const bodyText = await page.locator("body").innerText({ timeout: 1000 }).catch(() => "");
      if (/access denied/i.test(bodyText)) result.status = "captured_access_denied";
      if (response && response.status() >= 400) result.status = `captured_http_${response.status()}`;
      if (result.status === "captured" || result.status.startsWith("captured_http_")) {
        const clip = await getContentClip(page).catch(() => ({ x: 0, y: 0, width: 1440, height: 1000 }));
        await page.screenshot({ path: screenshotPath, clip, fullPage: false });
        result.screenshot = path.relative(outputRoot, screenshotPath);
        result.clip = clip;
      }
    } catch (error) {
      result.status = "capture_error";
      result.error = error instanceof Error ? error.message.split("\n")[0] : String(error);
    }

    console.log(`${captureIndex}/${targets.length} ${result.status} ${item.urlPath}`);
    results.push(result);
  }

  await browser.close();

  const summary = results.reduce((acc, result) => {
    acc[result.status] = (acc[result.status] || 0) + 1;
    return acc;
  }, {});

  const manifest = {
    generatedAt: new Date().toISOString(),
    baseUrl,
    projectId,
    routeSet,
    storageState: path.relative(repoRoot, storageState),
    totalPageRoutes: inventory.length,
    targetRoutes: targets.length,
    summary,
    results,
  };

  await fs.writeFile(path.join(outputRoot, "manifest.json"), `${JSON.stringify(manifest, null, 2)}\n`);
  await fs.writeFile(
    path.join(outputRoot, "README.md"),
    [
      "# App Page Screenshots",
      "",
      `Generated from ${inventory.length} Next.js page routes.`,
      "",
      `Base URL: ${baseUrl}`,
      `Project ID: ${projectId}`,
      `Route set: ${routeSet}`,
      "",
      "See `manifest.json` for route status, final URL, screenshot path, and skipped dynamic record routes.",
      "",
    ].join("\n"),
  );

  console.log(JSON.stringify({ outputRoot, summary }, null, 2));
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
