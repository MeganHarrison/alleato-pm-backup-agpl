import { createRequire } from "node:module";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";

const repoRoot = process.cwd();
const requireFromFrontend = createRequire(
  path.join(repoRoot, "frontend", "package.json"),
);
const { chromium } = requireFromFrontend("playwright");
const { createClient } = requireFromFrontend("@supabase/supabase-js");

const baseUrl = process.env.CONTENT_STUDIO_BASE_URL ?? "http://localhost:3012";
const route = `${baseUrl}/content?area=training`;
const authStatePath =
  process.env.CONTENT_STUDIO_AUTH_STATE ??
  path.join(repoRoot, "frontend", "tests", ".auth", "user.json");
const outputDir = path.join(
  repoRoot,
  "docs",
  "ops",
  "evidence",
  "2026-07-31-content-creator-operations",
);

await mkdir(outputDir, { recursive: true });

const browser = await chromium.launch({ headless: true });
const consoleErrors = [];
const pageErrors = [];
const results = {};

async function getStorageState() {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  const email = process.env.TEST_USER_1;
  const password = process.env.TEST_PASSWORD_1;

  if (!supabaseUrl || !supabaseAnonKey || !email || !password) {
    return authStatePath;
  }

  const client = createClient(supabaseUrl, supabaseAnonKey, {
    auth: {
      autoRefreshToken: false,
      detectSessionInUrl: false,
      persistSession: false,
    },
  });
  const { data, error } = await client.auth.signInWithPassword({ email, password });
  if (error || !data.session) {
    throw new Error(`Browser proof authentication failed: ${error?.message ?? "no session"}`);
  }

  const session = data.session;
  const sessionJson = JSON.stringify({
    access_token: session.access_token,
    token_type: session.token_type,
    expires_in: session.expires_in,
    expires_at: session.expires_at,
    refresh_token: session.refresh_token,
    user: session.user,
    weak_password: null,
  });
  const projectRef = new URL(supabaseUrl).hostname.split(".")[0];
  const target = new URL(baseUrl);

  return {
    cookies: [
      {
        name: `sb-${projectRef}-auth-token`,
        value: `base64-${Buffer.from(sessionJson).toString("base64")}`,
        domain: target.hostname,
        path: "/",
        expires: Math.floor(Date.now() / 1000) + 365 * 24 * 60 * 60,
        httpOnly: false,
        secure: target.protocol === "https:",
        sameSite: "Lax",
      },
    ],
    origins: [],
  };
}

async function verifyViewport(name, viewport, { proveBulkEdit = false } = {}) {
  const context = await browser.newContext({
    storageState: await getStorageState(),
    viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  page.on("console", (message) => {
    if (message.type() === "error") consoleErrors.push(`[${name}] ${message.text()}`);
  });
  page.on("pageerror", (error) => pageErrors.push(`[${name}] ${error.message}`));

  const response = await page.goto(route, {
    waitUntil: "domcontentloaded",
    timeout: 240_000,
  });
  await page.getByRole("heading", { name: "Content Studio" }).waitFor({
    state: "visible",
    timeout: 240_000,
  });
  const tabNavigation = page.locator('nav[aria-label="Tabs"]');
  await tabNavigation.locator('button[aria-label="Training"]').waitFor({
    state: "attached",
    timeout: 60_000,
  });
  const tabLabels = await tabNavigation.locator("button[aria-label]").allTextContents();
  const headers = await page.getByRole("columnheader").allTextContents();
  const engagementCells = await page
    .getByRole("cell")
    .filter({ hasText: /viewer|No activity|Not tracked/ })
    .allTextContents();

  const screenshotPath = path.join(outputDir, `${name}.png`);
  await page.screenshot({ path: screenshotPath, fullPage: true });

  let bulkEdit = null;
  if (proveBulkEdit) {
    await page.waitForTimeout(1_000);
    const firstRow = page.getByRole("checkbox", { name: "Select row" }).first();
    await firstRow.click();
    await page.waitForFunction(
      () =>
        document
          .querySelector('[aria-label="Select row"]')
          ?.getAttribute("data-state") === "checked",
      undefined,
      { timeout: 15_000 },
    );
    const editSelected = page
      .locator('button[aria-label="Edit selected"]:visible:not([disabled])')
      .first();
    await editSelected.waitFor({ state: "visible", timeout: 15_000 });
    await editSelected.click();
    await page.getByRole("dialog").waitFor({ state: "visible", timeout: 15_000 });

    const dialog = page.getByRole("dialog");
    const dialogText = await dialog.innerText();
    await dialog.getByRole("combobox").first().click();
    const fieldOptions = await page.getByRole("option").allTextContents();
    const bulkScreenshotPath = path.join(outputDir, "desktop-bulk-edit.png");
    await page.screenshot({ path: bulkScreenshotPath, fullPage: true });
    bulkEdit = {
      screenshot: path.relative(repoRoot, bulkScreenshotPath),
      containsDisplayArea: dialogText.includes("Display area"),
      fieldOptions: fieldOptions.map((label) => label.trim()),
      containsOwner: fieldOptions.some((label) => label.trim() === "Owner"),
      containsReviewer: fieldOptions.some((label) => label.trim() === "Reviewer"),
      containsNextReviewDate: fieldOptions.some(
        (label) => label.trim() === "Next review date",
      ),
    };
  }

  results[name] = {
    status: response?.status() ?? null,
    finalUrl: page.url(),
    viewport,
    screenshot: path.relative(repoRoot, screenshotPath),
    tabLabels: tabLabels.map((label) => label.replace(/\s+/g, " ").trim()),
    headers: headers.map((label) => label.replace(/\s+/g, " ").trim()),
    engagementExamples: engagementCells.slice(0, 5).map((label) => label.trim()),
    bulkEdit,
  };

  await context.close();
}

try {
  await verifyViewport("desktop", { width: 1440, height: 1000 }, { proveBulkEdit: true });
  await verifyViewport("mobile-390", { width: 390, height: 844 });
} finally {
  await browser.close();
}

const report = {
  route,
  capturedAt: new Date().toISOString(),
  results,
  consoleErrors,
  pageErrors,
  pass:
    Object.values(results).length === 2 &&
    Object.values(results).every(
      (result) =>
        result.status === 200 &&
        result.finalUrl.includes("/content?area=training") &&
        result.tabLabels.length === 4,
    ) &&
    results.desktop?.headers.includes("Engagement") === true &&
    results.desktop?.bulkEdit?.containsDisplayArea === true &&
    results.desktop?.bulkEdit?.containsOwner === true &&
    results.desktop?.bulkEdit?.containsReviewer === true &&
    results.desktop?.bulkEdit?.containsNextReviewDate === true &&
    pageErrors.length === 0,
};

await writeFile(
  path.join(outputDir, "browser-proof.json"),
  `${JSON.stringify(report, null, 2)}\n`,
  "utf8",
);

console.log(JSON.stringify(report, null, 2));
if (!report.pass) process.exitCode = 1;
