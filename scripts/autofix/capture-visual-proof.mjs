#!/usr/bin/env node
/**
 * Capture visual proof screenshots of an autofix PR's Vercel preview deployment.
 *
 * Reuses the repo's Playwright auth pattern (frontend/tests/auth.setup.ts):
 * sign in to Supabase via the API (no UI login), build the @supabase/ssr
 * cookie ("base64-<session JSON>" under sb-<projectRef>-auth-token), inject it
 * into the browser context for the preview host, then screenshot each route.
 *
 * Vercel deployment protection is crossed with the project's
 * "Protection Bypass for Automation" secret, sent as the
 * x-vercel-protection-bypass header on every request.
 *
 * Inputs (env):
 *   PREVIEW_URL                     – https origin of the preview deployment (required)
 *   PROOF_ROUTES                    – JSON array of app routes to capture, e.g. ["/876/budget"] (required)
 *   PROOF_OUTPUT_DIR                – directory for PNGs + manifest.json (default: proof-output)
 *   TEST_USER_1 / TEST_PASSWORD_1   – app test credentials (required)
 *   NEXT_PUBLIC_SUPABASE_URL        – Supabase project URL (required)
 *   NEXT_PUBLIC_SUPABASE_ANON_KEY   – Supabase anon key (required)
 *   VERCEL_AUTOMATION_BYPASS_SECRET – Vercel protection bypass (optional but needed for protected previews)
 *
 * Output: <PROOF_OUTPUT_DIR>/manifest.json
 *   { previewUrl, routes: [{ route, viewport, file, finalUrl, ok, error? }] }
 *
 * Exit code is 0 when every route captured successfully, 1 otherwise — the
 * caller decides how to surface partial results. Never fails silently: every
 * route always gets a manifest entry with ok/error.
 */

import fs from "node:fs";
import path from "node:path";
import { createRequire } from "node:module";

const requireFrontend = createRequire(
  new URL("../../frontend/package.json", import.meta.url),
);
const { chromium } = requireFrontend("@playwright/test");
const { createClient } = requireFrontend("@supabase/supabase-js");

const VIEWPORTS = [
  { name: "desktop", width: 1440, height: 900 },
  { name: "mobile", width: 375, height: 812 },
];
const NAV_TIMEOUT_MS = 60_000;
const SETTLE_MS = 4_000;

function requiredEnv(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }
  return value;
}

function parseRoutes(raw) {
  let routes;
  try {
    routes = JSON.parse(raw);
  } catch {
    throw new Error(`PROOF_ROUTES is not valid JSON: ${raw}`);
  }
  if (!Array.isArray(routes) || routes.length === 0) {
    throw new Error("PROOF_ROUTES must be a non-empty JSON array of routes.");
  }
  return routes.map((route) => {
    if (typeof route !== "string" || !route.startsWith("/")) {
      throw new Error(`Invalid route (must start with "/"): ${route}`);
    }
    return route;
  });
}

function supabaseProjectRef(supabaseUrl) {
  const match = supabaseUrl.match(/https?:\/\/([^.]+)\.supabase\.co/);
  if (!match) {
    throw new Error(`Could not extract project ref from Supabase URL: ${supabaseUrl}`);
  }
  return match[1];
}

async function buildAuthCookie(previewUrl) {
  const supabaseUrl = requiredEnv("NEXT_PUBLIC_SUPABASE_URL");
  const supabase = createClient(supabaseUrl, requiredEnv("NEXT_PUBLIC_SUPABASE_ANON_KEY"));

  const { data, error } = await supabase.auth.signInWithPassword({
    email: requiredEnv("TEST_USER_1"),
    password: requiredEnv("TEST_PASSWORD_1"),
  });
  if (error || !data.session) {
    throw new Error(`Supabase password sign-in failed for the test user: ${error?.message ?? "no session returned"}`);
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

  const host = new URL(previewUrl).hostname;
  return {
    name: `sb-${supabaseProjectRef(supabaseUrl)}-auth-token`,
    value: `base64-${Buffer.from(sessionJson).toString("base64")}`,
    domain: host,
    path: "/",
    expires: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
    httpOnly: false,
    secure: true,
    sameSite: "Lax",
  };
}

async function captureRoute(context, previewUrl, route, viewport, outputDir) {
  const page = await context.newPage();
  const file = `${route.replace(/[^a-zA-Z0-9]+/g, "-").replace(/^-|-$/g, "") || "root"}-${viewport.name}.png`;
  const entry = { route, viewport: viewport.name, file, ok: false };

  try {
    await page.setViewportSize({ width: viewport.width, height: viewport.height });
    await page.goto(new URL(route, previewUrl).toString(), {
      waitUntil: "load",
      timeout: NAV_TIMEOUT_MS,
    });
    // Let client-side data fetches and hydration settle before capturing.
    await page.waitForTimeout(SETTLE_MS);

    const finalUrl = new URL(page.url());
    entry.finalUrl = finalUrl.toString();

    if (finalUrl.pathname.startsWith("/auth/login")) {
      throw new Error(
        "Route redirected to /auth/login — the injected Supabase session was not accepted by the preview deployment.",
      );
    }
    if (finalUrl.hostname.endsWith("vercel.com")) {
      throw new Error(
        "Route redirected to Vercel SSO — the protection bypass secret is missing or invalid.",
      );
    }

    // A membership wall is a real capture but not proof of the fix — flag it
    // so the PR comment calls it out instead of passing it off as evidence.
    const accessDenied = await page
      .getByText("Access Denied", { exact: true })
      .first()
      .isVisible()
      .catch(() => false);
    if (accessDenied) {
      entry.warning =
        "Page shows Access Denied — the test user has no membership for this project, so this screenshot does not prove the fix.";
    }

    await page.screenshot({ path: path.join(outputDir, file), fullPage: true });
    entry.ok = true;
  } catch (error) {
    entry.error = error instanceof Error ? error.message : String(error);
  } finally {
    await page.close();
  }

  return entry;
}

async function main() {
  const previewUrl = requiredEnv("PREVIEW_URL").replace(/\/$/, "");
  const routes = parseRoutes(requiredEnv("PROOF_ROUTES"));
  const outputDir = process.env.PROOF_OUTPUT_DIR || "proof-output";
  const bypassSecret = process.env.VERCEL_AUTOMATION_BYPASS_SECRET || "";

  fs.mkdirSync(outputDir, { recursive: true });

  const authCookie = await buildAuthCookie(previewUrl);
  console.log(`Signed in as the test user; capturing ${routes.length} route(s) on ${previewUrl}`);

  const browser = await chromium.launch();
  const context = await browser.newContext({
    ...(bypassSecret
      ? { extraHTTPHeaders: { "x-vercel-protection-bypass": bypassSecret } }
      : {}),
  });
  await context.addCookies([authCookie]);

  const results = [];
  for (const route of routes) {
    for (const viewport of VIEWPORTS) {
      const entry = await captureRoute(context, previewUrl, route, viewport, outputDir);
      results.push(entry);
      console.log(
        entry.ok
          ? `✓ ${route} [${viewport.name}] → ${entry.file}`
          : `✗ ${route} [${viewport.name}] → ${entry.error}`,
      );
    }
  }

  await browser.close();

  const manifest = { previewUrl, capturedAt: new Date().toISOString(), routes: results };
  fs.writeFileSync(path.join(outputDir, "manifest.json"), JSON.stringify(manifest, null, 2));

  const failed = results.filter((entry) => !entry.ok);
  if (failed.length > 0) {
    console.error(`${failed.length} of ${results.length} captures failed.`);
    process.exit(1);
  }
  console.log(`All ${results.length} captures succeeded.`);
}

main().catch((error) => {
  console.error(`Visual proof capture failed before any screenshots: ${error.message}`);
  // Still write a manifest so the workflow can post a loud failure comment.
  const outputDir = process.env.PROOF_OUTPUT_DIR || "proof-output";
  try {
    fs.mkdirSync(outputDir, { recursive: true });
    fs.writeFileSync(
      path.join(outputDir, "manifest.json"),
      JSON.stringify(
        {
          previewUrl: process.env.PREVIEW_URL ?? "",
          capturedAt: new Date().toISOString(),
          fatalError: error.message,
          routes: [],
        },
        null,
        2,
      ),
    );
  } catch {
    // Directory creation failed — the missing manifest itself signals the failure.
  }
  process.exit(1);
});
