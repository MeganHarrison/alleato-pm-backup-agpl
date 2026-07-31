#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";
import { chromium } from "playwright";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, "../..");
const DEFAULT_AUTH_STATE = path.join(REPO_ROOT, "frontend/tests/.auth/user.json");
const DEFAULT_BASE_URL = "https://projects.alleatogroup.com";
const DEFAULT_PROJECT_ID = "760";
const DEFAULT_RUNS = 5;
const DEFAULT_WARMUPS = 1;
const DEFAULT_WAIT_AFTER_LOAD_MS = 2500;
const DEFAULT_SLOW_RESOURCE_MS = 500;

for (const envPath of [
  path.join(REPO_ROOT, ".env"),
  path.join(REPO_ROOT, ".env.local"),
  path.join(REPO_ROOT, "frontend/.env.local"),
  path.join(REPO_ROOT, "frontend/.env"),
]) {
  if (fs.existsSync(envPath)) {
    dotenv.config({ path: envPath, override: false, quiet: true });
  }
}

function parseArgs(argv) {
  const args = {
    baseUrl: process.env.PERF_BASE_URL ?? DEFAULT_BASE_URL,
    projectId: process.env.PERF_PROJECT_ID ?? DEFAULT_PROJECT_ID,
    runs: Number.parseInt(process.env.PERF_RUNS ?? "", 10) || DEFAULT_RUNS,
    warmups: Number.parseInt(process.env.PERF_WARMUPS ?? "", 10) || DEFAULT_WARMUPS,
    authState: process.env.PERF_AUTH_STATE ?? DEFAULT_AUTH_STATE,
    outputJson: process.env.PERF_OUTPUT_JSON ?? "",
    compareJson: process.env.PERF_COMPARE_JSON ?? "",
    waitAfterLoadMs:
      Number.parseInt(process.env.PERF_WAIT_AFTER_LOAD_MS ?? "", 10) ||
      DEFAULT_WAIT_AFTER_LOAD_MS,
    slowResourceMs:
      Number.parseInt(process.env.PERF_SLOW_RESOURCE_MS ?? "", 10) ||
      DEFAULT_SLOW_RESOURCE_MS,
    headed: process.env.PERF_HEADED === "1",
    browserChannel: process.env.PERF_BROWSER_CHANNEL ?? "",
    loginIfNeeded: process.env.PERF_LOGIN_IF_NEEDED !== "0",
    username: process.env.TEST_USER_1 ?? process.env.APP_USERNAME ?? "test1@mail.com",
    password: process.env.TEST_PASSWORD_1 ?? process.env.APP_PASSWORD ?? "test12026!!!",
    tracePattern: process.env.PERF_TRACE_PATTERN ?? "",
  };

  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    const next = argv[index + 1];
    if (arg === "--base-url" && next) {
      args.baseUrl = next;
      index += 1;
    } else if (arg === "--project-id" && next) {
      args.projectId = next;
      index += 1;
    } else if (arg === "--runs" && next) {
      args.runs = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--warmups" && next) {
      args.warmups = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--auth-state" && next) {
      args.authState = path.resolve(next);
      index += 1;
    } else if (arg === "--output-json" && next) {
      args.outputJson = path.resolve(next);
      index += 1;
    } else if (arg === "--compare-json" && next) {
      args.compareJson = path.resolve(next);
      index += 1;
    } else if (arg === "--wait-after-load-ms" && next) {
      args.waitAfterLoadMs = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--slow-resource-ms" && next) {
      args.slowResourceMs = Number.parseInt(next, 10);
      index += 1;
    } else if (arg === "--headed") {
      args.headed = true;
    } else if (arg === "--browser-channel" && next) {
      args.browserChannel = next;
      index += 1;
    } else if (arg === "--trace-pattern" && next) {
      args.tracePattern = next;
      index += 1;
    } else if (arg === "--no-login") {
      args.loginIfNeeded = false;
    } else if (arg === "--help" || arg === "-h") {
      printHelp();
      process.exit(0);
    } else {
      throw new Error(`Unknown or incomplete argument: ${arg}`);
    }
  }

  if (!Number.isInteger(args.runs) || args.runs < 1) {
    throw new Error("--runs must be a positive integer.");
  }
  if (!Number.isInteger(args.warmups) || args.warmups < 0) {
    throw new Error("--warmups must be zero or a positive integer.");
  }

  args.baseUrl = args.baseUrl.replace(/\/+$/, "");
  return args;
}

function printHelp() {
  console.log(`Project Home speed probe

Usage:
  node scripts/perf/project-home-speed.mjs [options]

Options:
  --base-url <url>              Default: ${DEFAULT_BASE_URL}
  --project-id <id>             Default: ${DEFAULT_PROJECT_ID}
  --runs <n>                    Measured runs. Default: ${DEFAULT_RUNS}
  --warmups <n>                 Unreported warmup runs. Default: ${DEFAULT_WARMUPS}
  --auth-state <path>           Playwright storage state. Default: frontend/tests/.auth/user.json
  --output-json <path>          Save raw run data and summary.
  --compare-json <path>         Compare current medians against a prior output file.
  --wait-after-load-ms <ms>     Wait after load before reading LCP/resources. Default: ${DEFAULT_WAIT_AFTER_LOAD_MS}
  --slow-resource-ms <ms>       Slow resource threshold. Default: ${DEFAULT_SLOW_RESOURCE_MS}
  --browser-channel <channel>   Optional installed browser channel, e.g. chrome.
  --trace-pattern <text>        Include CDP request initiators for matching resource URLs.
  --no-login                    Do not refresh auth if redirected to login.
  --headed                     Run headed for debugging.

Environment variable equivalents:
  PERF_BASE_URL, PERF_PROJECT_ID, PERF_RUNS, PERF_WARMUPS, PERF_AUTH_STATE,
  PERF_OUTPUT_JSON, PERF_COMPARE_JSON, PERF_WAIT_AFTER_LOAD_MS, PERF_SLOW_RESOURCE_MS, PERF_HEADED=1
  PERF_BROWSER_CHANNEL, PERF_TRACE_PATTERN, PERF_LOGIN_IF_NEEDED=0, TEST_USER_1, TEST_PASSWORD_1
`);
}

function readStorageState(authStatePath, targetUrl) {
  if (!fs.existsSync(authStatePath)) {
    throw new Error(
      [
        `Missing auth state at ${authStatePath}.`,
        "Run: cd frontend && npx playwright test tests/auth.setup.ts",
      ].join(" "),
    );
  }

  const state = JSON.parse(fs.readFileSync(authStatePath, "utf-8"));
  const url = new URL(targetUrl);
  const hostname = url.hostname;
  const isHttps = url.protocol === "https:";
  const cookies = Array.isArray(state.cookies) ? state.cookies : [];
  const supabaseAuthCookie = cookies.find((cookie) =>
    /^sb-.*-auth-token$/.test(cookie.name),
  );

  if (!supabaseAuthCookie) {
    throw new Error(`Auth state at ${authStatePath} does not include a Supabase auth cookie.`);
  }

  const normalizedCookies = cookies.map((cookie) => {
    if (!/^sb-.*-auth-token$/.test(cookie.name)) return cookie;
    return {
      ...cookie,
      domain: hostname,
      secure: isHttps,
      sameSite: cookie.sameSite ?? "Lax",
    };
  });

  return {
    cookies: normalizedCookies,
    origins: Array.isArray(state.origins) ? state.origins : [],
  };
}

function percentile(values, p) {
  if (values.length === 0) return null;
  const sorted = [...values].sort((a, b) => a - b);
  const index = (sorted.length - 1) * p;
  const lower = Math.floor(index);
  const upper = Math.ceil(index);
  if (lower === upper) return sorted[lower];
  return sorted[lower] + (sorted[upper] - sorted[lower]) * (index - lower);
}

function median(values) {
  return percentile(values, 0.5);
}

function round(value) {
  return typeof value === "number" && Number.isFinite(value) ? Math.round(value) : null;
}

function metricSummary(runs, metric) {
  const values = runs
    .map((run) => run.metrics[metric])
    .filter((value) => typeof value === "number" && Number.isFinite(value));
  return {
    min: round(Math.min(...values)),
    median: round(median(values)),
    p75: round(percentile(values, 0.75)),
    max: round(Math.max(...values)),
  };
}

function formatMs(value) {
  return typeof value === "number" && Number.isFinite(value) ? `${Math.round(value)}ms` : "n/a";
}

function collectResourceSummary(runs, slowResourceMs) {
  const resourcesByName = new Map();
  for (const run of runs) {
    for (const resource of run.resources) {
      const current = resourcesByName.get(resource.name) ?? {
        name: resource.name,
        initiatorType: resource.initiatorType,
        count: 0,
        durations: [],
        transferSizes: [],
      };
      current.count += 1;
      current.durations.push(resource.duration);
      current.transferSizes.push(resource.transferSize);
      resourcesByName.set(resource.name, current);
    }
  }

  return [...resourcesByName.values()]
    .map((resource) => ({
      name: resource.name,
      initiatorType: resource.initiatorType,
      count: resource.count,
      medianDurationMs: round(median(resource.durations)),
      maxDurationMs: round(Math.max(...resource.durations)),
      medianTransferSizeBytes: round(median(resource.transferSizes)),
    }))
    .filter((resource) => resource.maxDurationMs >= slowResourceMs || resource.name.includes("/api/"))
    .sort((a, b) => (b.maxDurationMs ?? 0) - (a.maxDurationMs ?? 0))
    .slice(0, 20);
}

function buildSummary({ args, targetUrl, runs }) {
  return {
    targetUrl,
    measuredRuns: runs.length,
    generatedAt: new Date().toISOString(),
    options: {
      baseUrl: args.baseUrl,
      projectId: args.projectId,
      waitAfterLoadMs: args.waitAfterLoadMs,
      slowResourceMs: args.slowResourceMs,
    },
    metrics: {
      ttfbMs: metricSummary(runs, "ttfbMs"),
      domContentLoadedMs: metricSummary(runs, "domContentLoadedMs"),
      loadMs: metricSummary(runs, "loadMs"),
      firstContentfulPaintMs: metricSummary(runs, "firstContentfulPaintMs"),
      largestContentfulPaintMs: metricSummary(runs, "largestContentfulPaintMs"),
      totalResourceDurationMs: metricSummary(runs, "totalResourceDurationMs"),
      apiRequestCount: metricSummary(runs, "apiRequestCount"),
      resourceCount: metricSummary(runs, "resourceCount"),
    },
    slowResources: collectResourceSummary(runs, args.slowResourceMs),
    runs,
  };
}

function printSummary(summary, compareSummary) {
  const rows = [
    ["TTFB", "ttfbMs"],
    ["DOMContentLoaded", "domContentLoadedMs"],
    ["Load", "loadMs"],
    ["FCP", "firstContentfulPaintMs"],
    ["LCP", "largestContentfulPaintMs"],
    ["Total resource duration", "totalResourceDurationMs"],
    ["API request count", "apiRequestCount"],
    ["Resource count", "resourceCount"],
  ];

  console.log(`\nProject Home speed probe`);
  console.log(`Target: ${summary.targetUrl}`);
  console.log(`Runs: ${summary.measuredRuns}`);
  console.log("");
  console.log("Metric                    min      median   p75      max      delta vs compare");
  console.log("------------------------  -------  -------  -------  -------  ----------------");

  for (const [label, key] of rows) {
    const metric = summary.metrics[key];
    const compareMetric = compareSummary?.metrics?.[key];
    const delta =
      compareMetric?.median != null && metric.median != null
        ? metric.median - compareMetric.median
        : null;
    const deltaText = delta == null ? "" : `${delta >= 0 ? "+" : ""}${Math.round(delta)}${key.includes("Count") ? "" : "ms"}`;
    const formatter = key.includes("Count") ? String : formatMs;
    console.log(
      `${label.padEnd(24)}  ${formatter(metric.min).padEnd(7)}  ${formatter(metric.median).padEnd(7)}  ${formatter(metric.p75).padEnd(7)}  ${formatter(metric.max).padEnd(7)}  ${deltaText}`,
    );
  }

  console.log("\nSlow/API resources by max duration:");
  if (summary.slowResources.length === 0) {
    console.log("  None over threshold.");
  } else {
    for (const resource of summary.slowResources.slice(0, 12)) {
      console.log(
        `  ${formatMs(resource.maxDurationMs).padStart(7)} max | ${formatMs(resource.medianDurationMs).padStart(7)} median | x${String(resource.count).padEnd(2)} | ${resource.name}`,
      );
    }
  }

  const failedRuns = summary.runs.filter((run) => run.failedRequests.length > 0);
  if (failedRuns.length > 0) {
    console.log("\nFailed requests:");
    for (const run of failedRuns) {
      for (const failure of run.failedRequests) {
        console.log(`  run ${run.run}: ${failure.method} ${failure.url} -> ${failure.failure}`);
      }
    }
  }

  const tracedRuns = summary.runs.filter((run) => run.traces?.length > 0);
  if (tracedRuns.length > 0) {
    console.log("\nTraced request initiators:");
    for (const run of tracedRuns) {
      for (const trace of run.traces) {
        console.log(`  run ${run.run}: ${trace.method} ${trace.url}`);
        console.log(`    type: ${trace.type}`);
        console.log(`    initiator: ${JSON.stringify(trace.initiator)}`);
      }
    }
  }
}

async function collectRun({ browser, args, targetUrl, storageState, runNumber, measured }) {
  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 },
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  const failedRequests = [];
  const traces = [];

  if (args.tracePattern) {
    const cdpSession = await context.newCDPSession(page);
    await cdpSession.send("Network.enable");
    cdpSession.on("Network.requestWillBeSent", (event) => {
      if (!event.request.url.includes(args.tracePattern)) return;
      traces.push({
        url: event.request.url,
        type: event.type,
        method: event.request.method,
        initiator: event.initiator,
      });
    });
  }

  page.on("requestfailed", (request) => {
    const failure = request.failure()?.errorText ?? "request failed";
    if (failure === "net::ERR_ABORTED" && request.url().includes("_rsc=")) {
      return;
    }
    failedRequests.push({
      method: request.method(),
      url: request.url(),
      failure,
    });
  });

  await page.addInitScript(() => {
    window.__projectHomePerf = {
      firstContentfulPaintMs: null,
      largestContentfulPaintMs: null,
    };

    const paintObserver = new PerformanceObserver((list) => {
      for (const entry of list.getEntries()) {
        if (entry.name === "first-contentful-paint") {
          window.__projectHomePerf.firstContentfulPaintMs = entry.startTime;
        }
      }
    });
    paintObserver.observe({ type: "paint", buffered: true });

    const lcpObserver = new PerformanceObserver((list) => {
      const entries = list.getEntries();
      const last = entries[entries.length - 1];
      if (last) {
        window.__projectHomePerf.largestContentfulPaintMs = last.startTime;
      }
    });
    lcpObserver.observe({ type: "largest-contentful-paint", buffered: true });
  });

  await page.goto(targetUrl, { waitUntil: "load", timeout: 90_000 });
  await page.waitForTimeout(args.waitAfterLoadMs);

  const pageData = await page.evaluate(() => {
    const navigation = performance.getEntriesByType("navigation")[0];
    const resources = performance.getEntriesByType("resource").map((entry) => ({
      name: entry.name,
      initiatorType: entry.initiatorType,
      duration: entry.duration,
      transferSize: entry.transferSize,
      responseStart: entry.responseStart,
      responseEnd: entry.responseEnd,
      startTime: entry.startTime,
    }));
    const vitals = window.__projectHomePerf ?? {};

    return {
      url: window.location.href,
      navigation: navigation
        ? {
            startTime: navigation.startTime,
            responseStart: navigation.responseStart,
            domContentLoadedEventEnd: navigation.domContentLoadedEventEnd,
            loadEventEnd: navigation.loadEventEnd,
            duration: navigation.duration,
          }
        : null,
      resources,
      vitals,
    };
  });

  await context.close();

  const finalUrl = new URL(pageData.url);
  if (finalUrl.pathname.includes("/auth/login")) {
    throw new Error(
      [
        `Navigation ended on login instead of the target page: ${pageData.url}`,
        "Cause: the auth state is missing or expired for this base URL.",
        "Detection gap: page speed probes must fail instead of timing the login page.",
        "Prevention: rerun with valid credentials/auth state, or allow the script to refresh login before measuring.",
      ].join(" "),
    );
  }

  const resources = pageData.resources.map((resource) => ({
    ...resource,
    duration: round(resource.duration) ?? 0,
    transferSize: round(resource.transferSize) ?? 0,
  }));
  const apiResources = resources.filter((resource) => resource.name.includes("/api/"));
  const totalResourceDurationMs = resources.reduce((sum, resource) => sum + resource.duration, 0);
  const navigation = pageData.navigation;

  return {
    run: runNumber,
    measured,
    url: pageData.url,
    metrics: {
      ttfbMs: round(navigation?.responseStart),
      domContentLoadedMs: round(navigation?.domContentLoadedEventEnd),
      loadMs: round(navigation?.loadEventEnd),
      firstContentfulPaintMs: round(pageData.vitals.firstContentfulPaintMs),
      largestContentfulPaintMs: round(pageData.vitals.largestContentfulPaintMs),
      totalResourceDurationMs: round(totalResourceDurationMs),
      apiRequestCount: apiResources.length,
      resourceCount: resources.length,
    },
    resources,
    failedRequests,
    traces,
  };
}

async function refreshAuthIfNeeded({ browser, args, targetUrl, storageState }) {
  if (!args.loginIfNeeded) return storageState;

  const context = await browser.newContext({
    storageState,
    viewport: { width: 1440, height: 1000 },
  });
  const page = await context.newPage();

  try {
    await page.goto(targetUrl, { waitUntil: "domcontentloaded", timeout: 60_000 });
    if (!new URL(page.url()).pathname.includes("/auth/login")) {
      return await context.storageState();
    }

    await page.locator("#email").fill(args.username, { timeout: 30_000 });
    await page.locator("#password").fill(args.password, { timeout: 30_000 });
    await page.waitForTimeout(3000);
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      await page.getByRole("button", { name: /login|sign in/i }).click();
      const redirected = await page
        .waitForURL((url) => !url.pathname.includes("/auth/login"), {
          timeout: 15_000,
        })
        .then(() => true)
        .catch(() => false);
      if (redirected) break;
      if (attempt === 2) {
        throw new Error("Login form submitted but did not leave /auth/login.");
      }
      await page.locator("#password").fill(args.password, { timeout: 30_000 });
      await page.waitForTimeout(1500);
    }

    return await context.storageState();
  } catch (error) {
    throw new Error(
      [
        "Unable to establish an authenticated browser session before the perf run.",
        `Cause: ${error instanceof Error ? error.message : String(error)}`,
        "Detection gap: an unauthenticated perf run would measure login instead of Project Home.",
        "Prevention: refresh frontend/tests/.auth/user.json or provide TEST_USER_1 / TEST_PASSWORD_1.",
      ].join(" "),
    );
  } finally {
    await context.close();
  }
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const targetUrl = `${args.baseUrl}/${args.projectId}/home`;
  let storageState = readStorageState(args.authState, targetUrl);
  const browser = await chromium.launch({
    channel: args.browserChannel || undefined,
    headless: !args.headed,
  });
  const allRuns = [];

  try {
    storageState = await refreshAuthIfNeeded({ browser, args, targetUrl, storageState });
    const totalRuns = args.warmups + args.runs;
    for (let index = 0; index < totalRuns; index += 1) {
      const runNumber = index + 1;
      const measured = index >= args.warmups;
      process.stdout.write(
        `${measured ? "Measured" : "Warmup"} run ${runNumber}/${totalRuns}... `,
      );
      const run = await collectRun({
        browser,
        args,
        targetUrl,
        storageState,
        runNumber,
        measured,
      });
      allRuns.push(run);
      process.stdout.write(
        `load=${formatMs(run.metrics.loadMs)} lcp=${formatMs(run.metrics.largestContentfulPaintMs)} api=${run.metrics.apiRequestCount}\n`,
      );
    }
  } finally {
    await browser.close();
  }

  const measuredRuns = allRuns.filter((run) => run.measured);
  const summary = buildSummary({ args, targetUrl, runs: measuredRuns });
  const compareSummary = args.compareJson
    ? JSON.parse(fs.readFileSync(args.compareJson, "utf-8"))
    : null;

  printSummary(summary, compareSummary);

  if (args.outputJson) {
    fs.mkdirSync(path.dirname(args.outputJson), { recursive: true });
    fs.writeFileSync(args.outputJson, `${JSON.stringify(summary, null, 2)}\n`);
    console.log(`\nWrote ${args.outputJson}`);
  }
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
