#!/usr/bin/env node

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { chromium } from "@playwright/test";
import dotenv from "dotenv";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const frontendDir = path.join(repoRoot, "frontend");
const runsRoot = path.join(repoRoot, "tests", "agent-browser-runs");
const runtimeRoot = path.join(runsRoot, ".runtime");
const cleanupScript = path.join(
  repoRoot,
  "scripts",
  "agent-browser",
  "agent-browser-cleanup.mjs",
);
const playwrightCli = path.join(
  frontendDir,
  "node_modules",
  "@playwright",
  "test",
  "cli.js",
);
// The proof runtime owns a stable port. Ambient BASE_URL values are commonly
// inherited from other test commands and must not silently redirect this tool
// to an arbitrary server.
const defaultUrl = "http://localhost:3100/";
const authMinimumTtlMs = 5 * 60 * 1000;

function usage() {
  return [
    "Usage: npm run verify:browser -- --route <path> [options]",
    "       npm run verify:browser -- --url <absolute-url> [options]",
    "Options:",
    "  --base-url <origin>       Origin used with --route (default: http://localhost:3100)",
    "  --name <task-name>        Artifact directory label",
    "  --session <owner-name>    Compatibility alias recorded as browser owner",
    "  --ready-selector <css>    Element that must appear before capture",
    "  --wait-ms <milliseconds>  Settle time after navigation (default: 750)",
    "  --headed                  Explicitly show the single managed browser",
    "  --desktop-only            Skip the 390px mobile capture",
    "  --stop-runtime            Stop the harness-owned local runtime and exit",
    "  --skip-cleanup            Keep evidence older than the retention window",
    "  --retention-hours <hours> Evidence retention (default: 48)",
  ].join("\n");
}

export function parseArgs(argv) {
  const options = {
    url: "",
    baseUrl: new URL(defaultUrl).origin,
    route: "",
    name: "browser-proof",
    owner: "alleato-route-proof",
    readySelector: "body",
    waitMs: 750,
    headed: false,
    desktopOnly: false,
    stopRuntime: false,
    skipCleanup: false,
    retentionHours: 48,
  };

  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    const next = () => argv[++index] ?? "";
    if (token === "--url") options.url = next();
    else if (token === "--base-url") options.baseUrl = next();
    else if (token === "--route") options.route = next();
    else if (token === "--name") options.name = next();
    else if (token === "--session") options.owner = next();
    else if (token === "--ready-selector") options.readySelector = next();
    else if (token === "--wait-ms") options.waitMs = Number(next());
    else if (token === "--retention-hours") {
      options.retentionHours = Number(next());
    } else if (token === "--headed") options.headed = true;
    else if (token === "--desktop-only") options.desktopOnly = true;
    else if (token === "--stop-runtime") options.stopRuntime = true;
    else if (token === "--skip-cleanup") options.skipCleanup = true;
    else if (token === "--auth-only") {
      // Compatibility flag. Auth readiness still produces screenshot proof.
    } else if (token === "--actions-file") {
      throw new Error(
        "--actions-file belonged to the retired agent-browser runner. Put interactive behavior in a focused Playwright spec; use this command for deterministic route proof.",
      );
    } else {
      throw new Error(`Unknown argument: ${token}\n${usage()}`);
    }
  }

  if (!Number.isFinite(options.waitMs) || options.waitMs < 0) {
    throw new Error(`Invalid --wait-ms value: ${options.waitMs}`);
  }
  if (!Number.isFinite(options.retentionHours) || options.retentionHours <= 0) {
    throw new Error(
      `Invalid --retention-hours value: ${options.retentionHours}`,
    );
  }

  const targetUrl = options.url
    ? new URL(options.url)
    : new URL(options.route || "/", options.baseUrl);
  const baseOrigin = new URL(options.baseUrl).origin;
  if (options.route && targetUrl.origin !== baseOrigin) {
    throw new Error("--route must stay on the --base-url origin.");
  }

  return {
    ...options,
    targetUrl: targetUrl.toString(),
    origin: targetUrl.origin,
  };
}

function slugify(value, maxLength = 64) {
  return value
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, maxLength);
}

function runId() {
  return new Date().toISOString().replaceAll(":", "-").replaceAll(".", "-");
}

export function authStatePathForOrigin(origin) {
  const parsed = new URL(origin);
  const identity = slugify(
    `${parsed.protocol.replace(":", "")}-${parsed.hostname}-${parsed.port || (parsed.protocol === "https:" ? "443" : "80")}`,
  );
  return path.join(frontendDir, "tests", ".auth", `${identity}.json`);
}

export function classifyProtectedLanding(url) {
  try {
    const parsed = new URL(url);
    if (parsed.pathname.startsWith("/auth/login")) return { kind: "login" };
    if (parsed.pathname.startsWith("/access-denied")) {
      return {
        kind: "access-denied",
        reason: parsed.searchParams.get("reason") || "unspecified",
      };
    }
    return null;
  } catch {
    return { kind: "invalid-url" };
  }
}

export function hasUsableAuthState(authStatePath, origin, now = Date.now()) {
  try {
    if (!fs.existsSync(authStatePath)) return false;
    const state = JSON.parse(fs.readFileSync(authStatePath, "utf8"));
    const expected = new URL(origin);
    const authCookie = (state.cookies ?? []).find((cookie) =>
      /^sb-.*-auth-token$/.test(cookie.name),
    );
    if (!authCookie?.value || authCookie.domain !== expected.hostname) {
      return false;
    }
    if (Boolean(authCookie.secure) !== (expected.protocol === "https:")) {
      return false;
    }

    let sessionJson = authCookie.value;
    if (sessionJson.startsWith("base64-")) {
      sessionJson = Buffer.from(sessionJson.slice(7), "base64").toString(
        "utf8",
      );
    }
    const session = JSON.parse(sessionJson);
    const jwt = session?.access_token;
    if (typeof jwt !== "string") return false;
    const payload = JSON.parse(
      Buffer.from(jwt.split(".")[1], "base64url").toString("utf8"),
    );
    return Boolean(payload.exp && payload.exp * 1000 > now + authMinimumTtlMs);
  } catch {
    return false;
  }
}

function loadSecureEnvironment() {
  for (const envPath of [
    path.join(repoRoot, ".env"),
    path.join(frontendDir, ".env.local"),
    path.join(frontendDir, ".env"),
  ]) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
  process.env.TEST_USER_1 ||= process.env.APP_USERNAME;
  process.env.TEST_PASSWORD_1 ||= process.env.APP_PASSWORD;
}

function missingAuthEnvironment() {
  const groups = [
    ["NEXT_PUBLIC_SUPABASE_URL"],
    ["NEXT_PUBLIC_SUPABASE_ANON_KEY"],
    ["SUPABASE_SERVICE_ROLE_KEY"],
    ["TEST_USER_1", "APP_USERNAME"],
    ["TEST_PASSWORD_1", "APP_PASSWORD"],
  ];
  return groups
    .filter((names) => !names.some((name) => process.env[name]))
    .map((names) => names.join(" or "));
}

function redact(value) {
  let output = String(value || "");
  for (const secret of [
    process.env.TEST_PASSWORD_1,
    process.env.APP_PASSWORD,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
  ]) {
    if (secret) output = output.replaceAll(secret, "[redacted]");
  }
  return output;
}

function refreshAuthState(origin, authStatePath) {
  loadSecureEnvironment();
  const missing = missingAuthEnvironment();
  if (missing.length > 0) {
    throw new Error(
      [
        "Authenticated route proof cannot refresh its saved session.",
        `Missing secure environment names: ${missing.join(", ")}.`,
        "Recovery: run npm run machine:ready to provision this checkout, then rerun the same proof command.",
      ].join(" "),
    );
  }
  if (!fs.existsSync(playwrightCli)) {
    throw new Error(
      `Playwright is not installed at ${playwrightCli}. Run pnpm --dir frontend install --frozen-lockfile.`,
    );
  }

  fs.mkdirSync(path.dirname(authStatePath), { recursive: true });
  const result = spawnSync(
    process.execPath,
    [
      playwrightCli,
      "test",
      "tests/auth.setup.ts",
      "--config=config/playwright/playwright.no-webserver.config.ts",
      "--project=setup",
    ],
    {
      cwd: frontendDir,
      encoding: "utf8",
      timeout: 150_000,
      windowsHide: true,
      env: {
        ...process.env,
        PLAYWRIGHT_BASE_URL: origin,
        BASE_URL: origin,
        AUTH_STORAGE_STATE_PATH: authStatePath,
        AUTH_SETUP_PRESERVE_EXISTING_USER: "true",
        AUTH_SETUP_REQUIRE_EXISTING_USER: "true",
      },
    },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    const details = redact(`${result.stdout || ""}\n${result.stderr || ""}`)
      .trim()
      .split(/\r?\n/)
      .slice(-24)
      .join("\n");
    throw new Error(
      [
        `Auth refresh failed for ${origin} with exit code ${result.status}.`,
        "Cause: the pre-existing test identity, Supabase configuration, or protected-route verification was rejected.",
        `Details:\n${details}`,
      ].join("\n"),
    );
  }
  if (!hasUsableAuthState(authStatePath, origin)) {
    throw new Error(
      `Auth setup passed but did not create a usable origin-scoped state at ${authStatePath}.`,
    );
  }
}

function isLocalOrigin(origin) {
  const hostname = new URL(origin).hostname;
  return (
    hostname === "localhost" || hostname === "127.0.0.1" || hostname === "[::1]"
  );
}

async function httpStatus(url, timeoutMs = 3000) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    const response = await fetch(url, {
      redirect: "manual",
      signal: controller.signal,
    });
    return response.status;
  } catch {
    return 0;
  } finally {
    clearTimeout(timeout);
  }
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

function runtimePaths(origin) {
  const parsed = new URL(origin);
  const port = parsed.port || (parsed.protocol === "https:" ? "443" : "80");
  return {
    port,
    statePath: path.join(runtimeRoot, `local-${port}.json`),
    logPath: path.join(runtimeRoot, `local-${port}.log`),
  };
}

function readJson(file) {
  try {
    return JSON.parse(fs.readFileSync(file, "utf8"));
  } catch {
    return null;
  }
}

function stopRuntimeProcess(state) {
  if (!state || state.repoRoot !== repoRoot || !isPidRunning(state.pid)) return;
  if (process.platform === "win32") {
    spawnSync("taskkill.exe", ["/PID", String(state.pid), "/T", "/F"], {
      encoding: "utf8",
      windowsHide: true,
    });
  } else {
    process.kill(-state.pid, "SIGTERM");
  }
}

export async function stopOwnedLocalRuntime(origin) {
  if (!isLocalOrigin(origin)) {
    throw new Error("--stop-runtime only applies to a localhost origin.");
  }
  const { statePath, port } = runtimePaths(origin);
  const state = readJson(statePath);
  if (!state) {
    console.log(
      `[route-proof] no harness-owned runtime recorded for port ${port}`,
    );
    return;
  }
  if (state.repoRoot !== repoRoot) {
    throw new Error(
      `Refusing to stop runtime PID ${state.pid}; its recorded owner is ${state.repoRoot}, not ${repoRoot}.`,
    );
  }
  stopRuntimeProcess(state);
  fs.rmSync(statePath, { force: true });
  console.log(
    `[route-proof] stopped harness-owned local runtime on port ${port}`,
  );
}

async function waitForRuntime(origin, timeoutMs = 150_000) {
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const status = await httpStatus(origin, 3000);
    if (status >= 200 && status < 400) return status;
    await new Promise((resolve) => setTimeout(resolve, 500));
  }
  return 0;
}

function tail(file, lines = 30) {
  try {
    return fs
      .readFileSync(file, "utf8")
      .split(/\r?\n/)
      .slice(-lines)
      .join("\n");
  } catch {
    return "(runtime log unavailable)";
  }
}

async function ensureLocalRuntime(origin) {
  if (!isLocalOrigin(origin)) return { kind: "external", started: false };
  const parsed = new URL(origin);
  if (parsed.protocol !== "http:") {
    throw new Error(
      "Local route proof currently requires an http:// localhost origin.",
    );
  }

  fs.mkdirSync(runtimeRoot, { recursive: true });
  const { port, statePath, logPath } = runtimePaths(origin);
  const state = readJson(statePath);
  const status = await httpStatus(origin);
  if (
    state?.repoRoot === repoRoot &&
    isPidRunning(state.pid) &&
    status >= 200 &&
    status < 400
  ) {
    return { kind: "managed-local", started: false, pid: state.pid, logPath };
  }

  if (status >= 200 && status < 400) {
    throw new Error(
      [
        `Local port ${port} is healthy but is not owned by this proof harness.`,
        "Cause: reusing an arbitrary server can capture another checkout or revision.",
        `Recovery: choose an unused port with --base-url http://localhost:<port>, or stop the actual owner explicitly.`,
      ].join(" "),
    );
  }

  if (state?.repoRoot === repoRoot) {
    stopRuntimeProcess(state);
    fs.rmSync(statePath, { force: true });
  } else if (state) {
    throw new Error(
      `Runtime state ${statePath} belongs to ${state.repoRoot}; refusing to replace it.`,
    );
  }

  const logFd = fs.openSync(logPath, "a");
  const child = spawn(
    process.execPath,
    [path.join(repoRoot, "scripts", "dev", "dev-launcher.mjs")],
    {
      cwd: repoRoot,
      detached: true,
      windowsHide: true,
      stdio: ["ignore", logFd, logFd],
      env: { ...process.env, PORT: port },
    },
  );
  fs.closeSync(logFd);
  child.unref();
  fs.writeFileSync(
    statePath,
    `${JSON.stringify(
      {
        pid: child.pid,
        port,
        origin,
        repoRoot,
        startedAt: new Date().toISOString(),
        logPath,
      },
      null,
      2,
    )}\n`,
  );

  const readyStatus = await waitForRuntime(origin);
  if (!readyStatus) {
    stopRuntimeProcess({ pid: child.pid, repoRoot });
    fs.rmSync(statePath, { force: true });
    throw new Error(
      [
        `Local frontend did not become ready at ${origin} within 150 seconds.`,
        `Runtime log: ${logPath}`,
        `Last log lines:\n${tail(logPath)}`,
      ].join("\n"),
    );
  }
  return { kind: "managed-local", started: true, pid: child.pid, logPath };
}

export function acquireBrowserLock(
  owner,
  lockPath = path.join(runtimeRoot, "browser-proof.lock.json"),
) {
  fs.mkdirSync(runtimeRoot, { recursive: true });
  fs.mkdirSync(path.dirname(lockPath), { recursive: true });
  const existing = readJson(lockPath);
  if (existing && isPidRunning(existing.pid)) {
    throw new Error(
      [
        `A route-proof browser is already owned by PID ${existing.pid} (${existing.owner}).`,
        `Lock: ${lockPath}`,
        "Recovery: wait for that proof to finish. A stale lock is removed automatically after its owner exits.",
      ].join(" "),
    );
  }
  fs.rmSync(lockPath, { force: true });
  fs.writeFileSync(
    lockPath,
    `${JSON.stringify(
      {
        pid: process.pid,
        owner,
        startedAt: new Date().toISOString(),
        repoRoot,
      },
      null,
      2,
    )}\n`,
    { flag: "wx" },
  );
  return () => fs.rmSync(lockPath, { force: true });
}

function assertArtifact(file) {
  const stats = fs.statSync(file);
  if (stats.size <= 0) {
    throw new Error(`Screenshot capture produced an empty artifact: ${file}`);
  }
}

async function visibleLoadingIndicators(page) {
  return page.evaluate(() => {
    const selectors = [
      '[aria-busy="true"]',
      '[data-loading="true"]',
      '[role="progressbar"]',
      ".animate-pulse",
      ".animate-spin",
    ];
    const visible = (element) => {
      const style = window.getComputedStyle(element);
      const rect = element.getBoundingClientRect();
      return (
        style.display !== "none" &&
        style.visibility !== "hidden" &&
        Number(style.opacity) !== 0 &&
        rect.width > 0 &&
        rect.height > 0
      );
    };
    return selectors.flatMap((selector) =>
      Array.from(document.querySelectorAll(selector))
        .filter(visible)
        .map((element) => ({
          selector,
          text: (element.textContent || "").trim().slice(0, 80),
        })),
    );
  });
}

async function waitForSettledUi(page, timeoutMs = 30_000) {
  const deadline = Date.now() + timeoutMs;
  let clearSince = 0;
  let lastIndicators = [];
  while (Date.now() < deadline) {
    lastIndicators = await visibleLoadingIndicators(page);
    if (lastIndicators.length === 0) {
      clearSince ||= Date.now();
      if (Date.now() - clearSince >= 750) return;
    } else {
      clearSince = 0;
    }
    await page.waitForTimeout(250);
  }
  throw new Error(
    [
      `Route remained visibly loading for ${timeoutMs}ms at ${page.url()}.`,
      `Visible indicators: ${JSON.stringify(lastIndicators.slice(0, 8))}`,
      "Recovery: inspect the route API/browser error logs or pass --ready-selector for the route's final content boundary.",
    ].join(" "),
  );
}

async function captureRoute(options, authStatePath, runDir) {
  let browser;
  const consoleLines = [];
  const errorLines = [];
  const responseFailures = [];
  try {
    browser = await chromium.launch({ headless: !options.headed });
    const context = await browser.newContext({
      storageState: authStatePath,
      viewport: { width: 1440, height: 900 },
      reducedMotion: "reduce",
    });
    const page = await context.newPage();
    page.on("console", (message) => {
      consoleLines.push(`[${message.type()}] ${message.text()}`);
    });
    page.on("pageerror", (error) => errorLines.push(error.message));
    page.on("response", (response) => {
      if (response.status() >= 500) {
        responseFailures.push(`${response.status()} ${response.url()}`);
      }
    });

    const response = await page.goto(options.targetUrl, {
      waitUntil: "domcontentloaded",
      timeout: 90_000,
    });
    if (response && response.status() >= 400) {
      throw new Error(
        `Route navigation returned HTTP ${response.status()} for ${options.targetUrl}.`,
      );
    }
    await page.locator(options.readySelector).first().waitFor({
      state: "visible",
      timeout: 30_000,
    });
    if (options.waitMs) await page.waitForTimeout(options.waitMs);
    await waitForSettledUi(page);

    const landing = classifyProtectedLanding(page.url());
    if (landing) {
      const error = new Error(
        landing.kind === "access-denied"
          ? `Authenticated identity reached access-denied (${landing.reason}) at ${page.url()}.`
          : `Saved auth was rejected and redirected to ${page.url()}.`,
      );
      error.code = landing.kind === "login" ? "AUTH_REJECTED" : "ACCESS_DENIED";
      throw error;
    }

    const desktopPath = path.join(runDir, "desktop-1440x900.png");
    await page.screenshot({ path: desktopPath, fullPage: false });
    assertArtifact(desktopPath);

    let mobilePath = null;
    if (!options.desktopOnly) {
      await page.setViewportSize({ width: 390, height: 844 });
      await page.waitForTimeout(Math.min(Math.max(options.waitMs, 250), 1000));
      await waitForSettledUi(page);
      mobilePath = path.join(runDir, "mobile-390x844.png");
      await page.screenshot({ path: mobilePath, fullPage: false });
      assertArtifact(mobilePath);
    }

    await context.storageState({ path: authStatePath });
    fs.writeFileSync(
      path.join(runDir, "console.log"),
      `${consoleLines.join("\n")}\n`,
    );
    fs.writeFileSync(
      path.join(runDir, "browser-errors.log"),
      `${[...errorLines, ...responseFailures].join("\n")}\n`,
    );

    if (errorLines.length > 0) {
      throw new Error(
        [
          `Route emitted ${errorLines.length} uncaught browser error(s) at ${page.url()}.`,
          `Browser error log: ${path.join(runDir, "browser-errors.log")}`,
          "Recovery: fix or explicitly isolate the page runtime error before using its screenshots as completion evidence.",
        ].join(" "),
      );
    }

    return {
      finalUrl: page.url(),
      desktopPath,
      mobilePath,
      consoleCount: consoleLines.length,
      pageErrorCount: errorLines.length,
      serverErrorCount: responseFailures.length,
    };
  } finally {
    if (browser) await browser.close();
  }
}

function writeSummary(runDir, data) {
  const relative = (file) =>
    file
      ? path.relative(repoRoot, file).replaceAll("\\", "/")
      : "not requested";
  const status = data.result.serverErrorCount ? "PASS WITH WARNINGS" : "PASS";
  const lines = [
    `# Authenticated Route Proof - ${data.name}`,
    "",
    `- Status: **${status}**`,
    `- Target: \`${data.targetUrl}\``,
    `- Final URL: \`${data.result.finalUrl}\``,
    `- Auth state: \`${relative(data.authStatePath)}\``,
    `- Auth refreshed: \`${data.authRefreshed}\``,
    `- Runtime: \`${data.runtime.kind}\` (${data.runtime.started ? "started" : "reused/external"})`,
    `- Browser owner: \`${data.owner}\``,
    `- Browser mode: \`${data.headed ? "visible (explicit opt-in)" : "headless"}\``,
    `- Browser lifecycle: \`one process, closed after capture\``,
    `- Desktop screenshot: \`${relative(data.result.desktopPath)}\``,
    `- Mobile screenshot: \`${relative(data.result.mobilePath)}\``,
    `- Console entries: \`${data.result.consoleCount}\``,
    `- Page errors: \`${data.result.pageErrorCount}\``,
    `- HTTP 5xx responses: \`${data.result.serverErrorCount}\``,
    "",
    ...(data.result.serverErrorCount
      ? [
          "Warning: screenshot capture completed, but one or more background requests returned 5xx. Inspect `browser-errors.log`; do not describe the route as fully healthy.",
          "",
        ]
      : []),
    "The local runtime is intentionally reusable. Stop only the harness-owned runtime with `npm run verify:browser:stop`.",
    "",
  ];
  const summaryPath = path.join(runDir, "VERIFICATION_SUMMARY.md");
  fs.writeFileSync(summaryPath, `${lines.join("\n")}\n`);
  return summaryPath;
}

export async function runMain(argv = process.argv.slice(2)) {
  const options = parseArgs(argv);
  if (options.stopRuntime) {
    await stopOwnedLocalRuntime(options.origin);
    return;
  }

  fs.mkdirSync(runsRoot, { recursive: true });
  if (!options.skipCleanup) {
    spawnSync(
      process.execPath,
      [
        cleanupScript,
        "--hours",
        String(options.retentionHours),
        "--run-root",
        runsRoot,
      ],
      { cwd: repoRoot, stdio: "inherit", windowsHide: true },
    );
  }

  const runDir = path.join(
    runsRoot,
    `${runId()}-${slugify(options.name || "browser-proof")}`,
  );
  fs.mkdirSync(runDir, { recursive: true });
  console.log(`[route-proof] run_dir=${path.relative(repoRoot, runDir)}`);

  let releaseLock = () => {};
  try {
    // Claim the complete proof lifecycle before startup or auth refresh. This
    // prevents concurrent commands from spawning competing servers or auth
    // browsers before the screenshot browser lock is acquired.
    releaseLock = acquireBrowserLock(options.owner);
    const runtime = await ensureLocalRuntime(options.origin);
    const authStatePath = authStatePathForOrigin(options.origin);
    let authRefreshed = false;
    if (!hasUsableAuthState(authStatePath, options.origin)) {
      console.log(
        `[route-proof] refreshing origin-scoped auth for ${options.origin}`,
      );
      refreshAuthState(options.origin, authStatePath);
      authRefreshed = true;
    } else {
      console.log(
        `[route-proof] reusing origin-scoped auth for ${options.origin}`,
      );
    }

    let result;
    try {
      result = await captureRoute(options, authStatePath, runDir);
    } catch (error) {
      if (error?.code !== "AUTH_REJECTED") throw error;
      console.log(
        "[route-proof] saved auth was rejected; refreshing once and retrying",
      );
      refreshAuthState(options.origin, authStatePath);
      authRefreshed = true;
      result = await captureRoute(options, authStatePath, runDir);
    }

    const summaryPath = writeSummary(runDir, {
      name: options.name,
      targetUrl: options.targetUrl,
      authStatePath,
      authRefreshed,
      runtime,
      owner: options.owner,
      headed: options.headed,
      result,
    });
    const terminalStatus = result.serverErrorCount
      ? "PASS_WITH_WARNINGS"
      : "PASS";
    console.log(
      `[route-proof] ${terminalStatus} summary=${path.relative(repoRoot, summaryPath)}`,
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    const failurePath = path.join(runDir, "FAILURE.txt");
    fs.writeFileSync(
      failurePath,
      `${message}\n\nCause: route proof stopped at the first failing startup, auth, authorization, or browser boundary.\nRecovery: follow the specific recovery action above, then rerun the same command.\n`,
    );
    console.error(message);
    console.error(
      `[route-proof] failure_artifact=${path.relative(repoRoot, failurePath)}`,
    );
    throw error;
  } finally {
    releaseLock();
  }
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runMain().catch(() => {
    process.exitCode = 1;
  });
}
