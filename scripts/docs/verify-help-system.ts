import { existsSync, mkdirSync, readFileSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";

import * as helpArticleModule from "../../frontend/src/lib/help-articles";
import * as helpVisibilityModule from "../../frontend/src/lib/help-visibility";

const helpArticles =
  "default" in helpArticleModule
    ? (helpArticleModule.default as typeof import("../../frontend/src/lib/help-articles"))
    : helpArticleModule;

const helpVisibility =
  "default" in helpVisibilityModule
    ? (helpVisibilityModule.default as typeof import("../../frontend/src/lib/help-visibility"))
    : helpVisibilityModule;

const { getHelpArticles, searchHelpArticles, validateHelpArticles } = helpArticles;
const {
  canArticleAppearInClientHelpCenter,
  canArticleAppearInDefaultAiHelp,
} = helpVisibility;

type Check = {
  name: string;
  status: "pass" | "fail" | "skip";
  detail: string;
};

const requiredStarterSlugs = [
  "create-or-invite-a-user",
  "update-your-profile",
  "manage-permissions",
];

async function main() {
  const checks: Check[] = [];

  const validation = await validateHelpArticles();
  checks.push({
    name: "metadata validation",
    status: validation.valid ? "pass" : "fail",
    detail: validation.valid
      ? `${validation.articles.length} article(s) valid`
      : validation.errors.join("; "),
  });

  const clientArticles = validation.valid
    ? await getHelpArticles({ clientHelpCenterOnly: true })
    : [];
  const aiArticles = validation.valid
    ? await getHelpArticles({ defaultAiHelpOnly: true })
    : [];

  const clientPolicyLeak = clientArticles.find(
    (article) => !canArticleAppearInClientHelpCenter(article.frontmatter),
  );
  checks.push({
    name: "client visibility policy",
    status: clientPolicyLeak ? "fail" : "pass",
    detail: clientPolicyLeak
      ? `${clientPolicyLeak.slug} bypassed client help policy`
      : `${clientArticles.length} client-safe article(s)`,
  });

  const aiPolicyLeak = aiArticles.find(
    (article) => !canArticleAppearInDefaultAiHelp(article.frontmatter),
  );
  checks.push({
    name: "AI help visibility policy",
    status: aiPolicyLeak ? "fail" : "pass",
    detail: aiPolicyLeak
      ? `${aiPolicyLeak.slug} bypassed AI help policy`
      : `${aiArticles.length} default AI-safe article(s)`,
  });

  const missingStarterSlugs = requiredStarterSlugs.filter(
    (slug) => !clientArticles.some((article) => article.slug === slug),
  );
  checks.push({
    name: "starter tutorial coverage",
    status: missingStarterSlugs.length ? "fail" : "pass",
    detail: missingStarterSlugs.length
      ? `missing ${missingStarterSlugs.join(", ")}`
      : `${requiredStarterSlugs.length} starter tutorial(s) visible`,
  });

  const createUserMatches = await searchHelpArticles("how do I create a user", {
    defaultAiHelpOnly: true,
    limit: 3,
  });
  checks.push({
    name: "AI retrieval for create user",
    status: createUserMatches[0]?.article.slug === "create-or-invite-a-user"
      ? "pass"
      : "fail",
    detail: createUserMatches[0]
      ? `top result ${createUserMatches[0].article.slug}`
      : "no results",
  });

  const internalSample = {
    title: "Internal",
    description: "Internal-only sample",
    audience: "internal",
    visibility: "published",
    module: "ops",
    category: "Internal",
    tags: [],
    featured: false,
    client_visible: true,
    ai_visible: true,
    order: 999,
    related_routes: [],
    related_actions: [],
  } as const;
  checks.push({
    name: "internal sample blocked",
    status:
      !canArticleAppearInClientHelpCenter(internalSample) &&
      !canArticleAppearInDefaultAiHelp(internalSample)
        ? "pass"
        : "fail",
    detail: "internal audience must not appear in default client or AI help",
  });

  const baseUrl = process.env.HELP_VERIFY_BASE_URL?.replace(/\/$/, "");
  if (baseUrl) {
    checks.push(...(await runBrowserChecks(baseUrl)));
  } else {
    checks.push({
      name: "browser route rendering",
      status: "skip",
      detail: "set HELP_VERIFY_BASE_URL=http://localhost:3000 to render routes",
    });
  }

  for (const check of checks) {
    console.log(`${check.status.toUpperCase()}: ${check.name} — ${check.detail}`);
  }

  const failed = checks.filter((check) => check.status === "fail");
  if (failed.length > 0) {
    process.exitCode = 1;
  }
}

async function runBrowserChecks(baseUrl: string): Promise<Check[]> {
  const checks: Check[] = [];
  const require = createRequire(import.meta.url);
  const { chromium } = require("../../frontend/node_modules/playwright");
  const outDir = path.resolve(
    "tests",
    "agent-browser-runs",
    "2026-04-29-help-center",
  );
  mkdirSync(outDir, { recursive: true });

  const storageStatePath = path.resolve("frontend", "tests", ".auth", "user.json");
  const browser = await chromium.launch({ headless: true });
  const context = await browser.newContext({
    storageState: existsSync(storageStatePath) ? storageStatePath : undefined,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto(`${baseUrl}/docs`, {
      waitUntil: "domcontentloaded",
      timeout: 60_000,
    });
    if (page.url().includes("/auth/login")) {
      await login(page);
      await context.storageState({ path: storageStatePath });
      await page.goto(`${baseUrl}/docs`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
    }

    await page
      .getByRole("heading", { name: "Alleato OS Help", exact: true })
      .waitFor({ timeout: 15_000 });
    const indexText = (await page.locator("main").last().innerText()).toLowerCase();
    await page.screenshot({
      path: path.join(outDir, "verify-help-system-index.png"),
      fullPage: true,
    });
    const missingIndexItems = requiredStarterSlugs
      .map((slug) => titleForSlug(slug).toLowerCase())
      .filter((title) => !indexText.includes(title));
    checks.push({
      name: "browser /docs rendering",
      status: missingIndexItems.length ? "fail" : "pass",
      detail: missingIndexItems.length
        ? `missing ${missingIndexItems.join(", ")}`
        : "starter tutorials rendered",
    });

    for (const slug of requiredStarterSlugs) {
      await page.goto(`${baseUrl}/docs/${slug}`, {
        waitUntil: "domcontentloaded",
        timeout: 60_000,
      });
      const heading = titleForSlug(slug);
      await page
        .getByRole("heading", { name: heading, exact: true })
        .waitFor({ timeout: 15_000 });
      checks.push({
        name: `browser /docs/${slug}`,
        status: "pass",
        detail: `${heading} rendered`,
      });
    }
  } catch (error) {
    checks.push({
      name: "browser route rendering",
      status: "fail",
      detail: error instanceof Error ? error.message : String(error),
    });
  } finally {
    await browser.close();
  }

  return checks;
}

async function login(page: any) {
  await page.locator('input[name="email"]').fill(envValue("TEST_USER_1") || envValue("APP_USERNAME"));
  await page
    .locator('input[name="password"]')
    .fill(envValue("TEST_PASSWORD_1") || envValue("APP_PASSWORD"));
  await page.getByRole("button", { name: /^Login$/ }).click();
  await page.waitForURL((url) => !url.pathname.startsWith("/auth/login"), {
    timeout: 60_000,
  });
}

function envValue(name: string): string {
  if (!existsSync(".env")) return "";
  const line = readFileSync(".env", "utf8")
    .split(/\r?\n/)
    .find((entry) => entry.startsWith(`${name}=`));
  return line ? line.slice(name.length + 1).replace(/^['"]|['"]$/g, "") : "";
}

function titleForSlug(slug: string): string {
  if (slug === "create-or-invite-a-user") return "Create or Invite a User";
  if (slug === "update-your-profile") return "Update Your Profile";
  if (slug === "manage-permissions") return "Manage Permissions";
  return slug;
}

main().catch((error) => {
  console.error(error);
  process.exit(1);
});
