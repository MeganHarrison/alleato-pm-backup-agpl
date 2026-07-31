#!/usr/bin/env node

/**
 * Establish a reusable authenticated agent-browser session for a protected
 * Alleato route. This is the required preflight before screenshot evidence.
 *
 * It deliberately owns the complete boundary:
 * 1. refresh Playwright storage state from env-backed test credentials;
 * 2. hydrate the named agent-browser session from that state; and
 * 3. verify the requested route does not redirect to login.
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendDir = path.join(repoRoot, "frontend");
const authStatePath = path.join(frontendDir, "tests/.auth/user.json");

function usage() {
  return [
    "Usage: npm run verify:browser-auth -- --base-url <origin> --route <path-or-url> [--session <name>]",
    "Example: npm run verify:browser-auth -- --base-url https://projects.alleatogroup.com --route /1142/rfis/<rfiId> --session rfi-detail-proof",
  ].join("\n");
}

function parseArgs(argv) {
  const options = { baseUrl: "", route: "", session: "alleato-verified" };
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (token === "--base-url") options.baseUrl = argv[++index] ?? "";
    else if (token === "--route") options.route = argv[++index] ?? "";
    else if (token === "--session") options.session = argv[++index] ?? "";
    else throw new Error(`Unknown argument: ${token}\n${usage()}`);
  }

  if (!options.baseUrl || !options.route || !options.session) {
    throw new Error(usage());
  }

  const baseUrl = new URL(options.baseUrl);
  const targetUrl = new URL(options.route, baseUrl);
  if (targetUrl.origin !== baseUrl.origin) {
    throw new Error("--route must stay on the --base-url origin.");
  }

  return { ...options, baseUrl: baseUrl.origin, targetUrl: targetUrl.toString() };
}

function run(command, args, options = {}) {
  const result = spawnSync(command, args, {
    cwd: repoRoot,
    encoding: "utf8",
    ...options,
  });

  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      [
        `${command} ${args.join(" ")} failed with exit code ${result.status}.`,
        result.stdout?.trim(),
        result.stderr?.trim(),
      ].filter(Boolean).join("\n"),
    );
  }
  return result.stdout.trim();
}

export function agentBrowserCookieSetArgs(cookie, baseUrl, session) {
  if (!cookie?.name || typeof cookie.value !== "string") {
    throw new Error("Auth storage state contains a cookie without a name or value.");
  }

  const args = [
    "--session",
    session,
    "cookies",
    "set",
    cookie.name,
    cookie.value,
    "--url",
    baseUrl,
  ];
  if (cookie.secure) args.push("--secure");
  if (cookie.httpOnly) args.push("--httpOnly");
  if (cookie.sameSite) args.push("--sameSite", cookie.sameSite);
  if (typeof cookie.expires === "number" && cookie.expires > 0) {
    args.push("--expires", String(cookie.expires));
  }
  return args;
}

// These values own the canonical projects.alleatogroup.com deployment. Keeping
// them explicit prevents an isolated checkout from silently hydrating test auth
// from a personal Vercel project that does not serve the production application.
const VERCEL_TEAM = process.env.ALLEATO_VERCEL_TEAM ?? "the-alleato-group";
const VERCEL_PROJECT = process.env.ALLEATO_VERCEL_PROJECT ?? "project-management-agent";

export function providerAuthEnvironment() {
  return { team: VERCEL_TEAM, project: VERCEL_PROJECT };
}

export function isAuthenticatedRouteUrl(currentUrl, expectedOrigin) {
  const current = new URL(currentUrl);
  return current.origin === expectedOrigin && !current.pathname.startsWith("/auth/login");
}

export function needsProviderAuthEnvironment(linkedProjectName) {
  return linkedProjectName !== VERCEL_PROJECT;
}

export function providerPlaywrightInvocation(playwrightCli = process.env.ALLEATO_PLAYWRIGHT_CLI) {
  const args = [
    "test",
    "tests/auth.setup.ts",
    "--config=config/playwright/playwright.config.ts",
    "--project=setup",
  ];
  return playwrightCli ? [playwrightCli, ...args] : ["npx", "playwright", ...args];
}

export function hasLocalAuthEnvironment(environment = process.env) {
  return Boolean(
    environment.NEXT_PUBLIC_SUPABASE_URL &&
    environment.SUPABASE_SERVICE_ROLE_KEY,
  );
}

function linkedVercelProjectName() {
  try {
    const linked = JSON.parse(fs.readFileSync(path.join(frontendDir, ".vercel", "project.json"), "utf8"));
    return typeof linked.projectName === "string" ? linked.projectName : null;
  } catch {
    return null;
  }
}

function ensureAuthEnvironment() {
  const currentProject = linkedVercelProjectName();
  if (!needsProviderAuthEnvironment(currentProject)) return;
  try {
    run("npx", ["vercel", "link", "--yes", "--scope", VERCEL_TEAM, "--project", VERCEL_PROJECT], { cwd: frontendDir });
  } catch (error) {
    throw new Error(
      [
        "Authenticated browser preflight could not hydrate its environment from the configured Vercel project.",
        "Cause: provider-backed test environment retrieval failed.",
        "Detection gap: isolated worktrees previously borrowed ignored files from another checkout.",
        "Prevention: this verifier now uses Vercel as the secure environment source of truth.",
        error instanceof Error ? error.message : String(error),
      ].join(" "),
    );
  }
}

function runProviderBackedPlaywrightAuth(baseUrl) {
  const authEnvironment = { ...process.env, PLAYWRIGHT_BASE_URL: baseUrl };
  const playwrightInvocation = providerPlaywrightInvocation();

  // The frontend's production Vercel project deliberately does not expose a
  // Supabase service-role key. When the authenticated runner has loaded an
  // existing secure local test environment, execute the same setup directly
  // rather than wrapping it in `vercel env run`, which would replace that key.
  if (hasLocalAuthEnvironment(authEnvironment)) {
    console.log("Using the secure local test environment for browser authentication.");
    const output = run(playwrightInvocation[0], playwrightInvocation.slice(1), {
      cwd: frontendDir,
      env: authEnvironment,
    });
    if (output) console.log(output);
    return;
  }

  console.log("Secure local test variables are unavailable; retrieving the configured Vercel environment.");

  // Sensitive Production variables are intentionally not materialized by
  // `vercel env pull` in every local credential context. `env run` injects
  // them only into this child process, avoiding both blank .env files and
  // cross-worktree secret copying.
  const output = run(
    "npx",
    [
      "vercel", "env", "run", "--environment", "production", "--scope", VERCEL_TEAM, "--",
      ...playwrightInvocation,
    ],
    {
      cwd: frontendDir,
      env: authEnvironment,
    },
  );
  if (output) console.log(output);
}

function hydrateAgentBrowserSession(baseUrl, session) {
  const state = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
  const cookies = state.cookies;
  if (!Array.isArray(cookies) || cookies.length === 0) {
    throw new Error(
      `Auth setup created ${authStatePath} without cookies; cannot authenticate the browser session.`,
    );
  }

  for (const cookie of cookies) {
    run("agent-browser", agentBrowserCookieSetArgs(cookie, baseUrl, session));
  }
}

function reuseAuthenticatedAgentBrowserSession(targetUrl, baseUrl, session) {
  try {
    run("agent-browser", ["--session", session, "open", targetUrl]);
    const currentUrl = run("agent-browser", ["--session", session, "get", "url"]);
    return isAuthenticatedRouteUrl(currentUrl, baseUrl);
  } catch {
    return false;
  }
}

function main() {
  const { baseUrl, targetUrl, session } = parseArgs(process.argv.slice(2));
  if (reuseAuthenticatedAgentBrowserSession(targetUrl, baseUrl, session)) {
    console.log(`Reused authenticated browser session: session=${session}`);
    console.log(`Verified route: ${targetUrl}`);
    console.log(`Next: agent-browser --session ${session} screenshot --full <artifact.png>`);
    return;
  }

  ensureAuthEnvironment();

  console.log(`Refreshing browser auth for ${baseUrl}...`);
  runProviderBackedPlaywrightAuth(baseUrl);

  if (!fs.existsSync(authStatePath)) {
    throw new Error(
      `Auth setup passed without creating ${authStatePath}. Verify frontend/tests/auth.setup.ts writes its storage state.`,
    );
  }

  // agent-browser ignores --state when its shared daemon is already running.
  // Set cookies in the requested isolated session instead of restarting the
  // shared daemon; this preserves other agents' browser work and makes the
  // preflight deterministic under concurrent verification.
  hydrateAgentBrowserSession(baseUrl, session);
  run("agent-browser", ["--session", session, "open", targetUrl]);
  const currentUrl = run("agent-browser", ["--session", session, "get", "url"]);
  if (!isAuthenticatedRouteUrl(currentUrl, baseUrl)) {
    throw new Error(
      [
        `Authenticated browser preflight failed: ${targetUrl} redirected to ${currentUrl}.`,
        "Cause: the refreshed storage state was not accepted by the target origin.",
        "Recovery: inspect frontend/tests/auth.setup.ts output and the production auth exchange before attempting screenshots.",
      ].join(" "),
    );
  }

  console.log(`Authenticated browser ready: session=${session}`);
  console.log(`Verified route: ${currentUrl}`);
  console.log(`Next: agent-browser --session ${session} screenshot --full <artifact.png>`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  try {
    main();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exit(1);
  }
}
