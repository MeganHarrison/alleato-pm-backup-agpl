#!/usr/bin/env node

import { execSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { pathToFileURL } from "node:url";

const baseRef = process.env.GUARDRAIL_BASE_REF || "origin/main";
const scope = process.env.GUARDRAIL_SCOPE === "all" ? "all" : "changed";
const baselinePath = path.resolve(
  process.cwd(),
  process.env.GUARDRAIL_BASELINE_PATH || "scripts/guardrail-route-debt-baseline.txt",
);

export function resolveRawErrorEnforcement({
  guardrailScope,
  envValue,
}) {
  if (envValue === "true") return true;
  if (envValue === "false") return false;
  return guardrailScope === "changed";
}

const enforceRawErrors = resolveRawErrorEnforcement({
  guardrailScope: scope,
  envValue: process.env.GUARDRAIL_ENFORCE_RAW_ERRORS,
});

function run(cmd) {
  return execSync(cmd, { stdio: ["ignore", "pipe", "pipe"] })
    .toString()
    .trim();
}

function readBaseline(filePath) {
  if (!existsSync(filePath)) return new Set();
  return new Set(
    readFileSync(filePath, "utf8")
      .split("\n")
      .map((v) => v.trim())
      .filter((v) => v && !v.startsWith("#")),
  );
}

function getAllRoutes() {
  const out = run("rg --files frontend/src/app/api | rg '/route\\.ts$' || true");
  return out
    .split("\n")
    .map((v) => v.trim())
    .filter(Boolean)
    .sort();
}

function getChangedRoutes() {
  const diffFromBase = run(`git diff --name-status ${baseRef}...HEAD || true`);
  const diffStaged = run("git diff --name-status --cached || true");
  const diffWorking = run("git diff --name-status || true");

  const changedFiles = new Set();
  for (const diff of [diffFromBase, diffStaged, diffWorking]) {
    for (const line of diff.split("\n")) {
      const [status, ...files] = line.trim().split(/\s+/);
      if (!status) continue;
      if (status === "D") continue;
      const file = files[files.length - 1];
      if (file) changedFiles.add(file);
    }
  }

  return [...changedFiles]
    .filter(
      (file) =>
        file.startsWith("frontend/src/app/api/") &&
        file.endsWith("/route.ts") &&
        existsSync(file),
    )
    .sort();
}

export function lineHasRawErrorResponse(line) {
  return (
    /NextResponse\.json\(\s*\{\s*error\s*:/.test(line) ||
    /new Response\(\s*["'`]Unauthorized["'`]/.test(line)
  );
}

function getAddedRawErrorRoutes() {
  const diffCommands = [
    `git diff --unified=0 ${baseRef}...HEAD -- frontend/src/app/api || true`,
    "git diff --unified=0 --cached -- frontend/src/app/api || true",
    "git diff --unified=0 -- frontend/src/app/api || true",
  ];

  const rawRoutes = new Set();
  for (const command of diffCommands) {
    const diff = run(command);
    let currentRoute = null;
    for (const line of diff.split("\n")) {
      if (line.startsWith("+++ b/")) {
        const route = line.slice("+++ b/".length);
        currentRoute = route.endsWith("/route.ts") ? route : null;
        continue;
      }
      if (!currentRoute || !line.startsWith("+") || line.startsWith("+++")) {
        continue;
      }
      if (lineHasRawErrorResponse(line.slice(1))) {
        rawRoutes.add(currentRoute);
      }
    }
  }
  return [...rawRoutes].sort();
}

function analyzeRoute(route) {
  const content = readFileSync(route, "utf8");
  let hasGuardrailWrapper = content.includes("withApiGuardrails");
  const reExportMatch = content.match(/export\s+\{\s*(?:GET|POST|PUT|PATCH|DELETE|HEAD)(?:\s*,\s*(?:GET|POST|PUT|PATCH|DELETE|HEAD))*\s+\}\s+from\s+["'](.+)["']/);
  if (!hasGuardrailWrapper && reExportMatch) {
    const target = path.resolve(path.dirname(route), reExportMatch[1]);
    const targetPath = target.endsWith(".ts") ? target : `${target}.ts`;
    if (existsSync(targetPath)) {
      hasGuardrailWrapper = readFileSync(targetPath, "utf8").includes("withApiGuardrails");
    }
  }
  const hasApiErrorResponse = content.includes("apiErrorResponse(");
  const hasStructuredPath = hasGuardrailWrapper || hasApiErrorResponse;
  const hasRawErrorResponse =
    /NextResponse\.json\(\s*\{\s*error\s*:/.test(content) ||
    /new Response\(\s*["'`]Unauthorized["'`]/.test(content);

  return {
    route,
    hasStructuredPath,
    hasRawErrorResponse,
  };
}

export function buildGuardrailReport({
  guardrailScope = scope,
  rawErrorEnforced = enforceRawErrors,
  debtBaselinePath = baselinePath,
} = {}) {
  const routes = guardrailScope === "all" ? getAllRoutes() : getChangedRoutes();
  const baseline = readBaseline(debtBaselinePath);
  const checks = routes.map(analyzeRoute);

  const noStructuredHandling = checks
    .filter((c) => !c.hasStructuredPath)
    .map((c) => c.route)
    .sort();

  const rawErrorRoutes = guardrailScope === "changed"
    ? getAddedRawErrorRoutes()
    : checks
      .filter((c) => c.hasRawErrorResponse)
      .map((c) => c.route)
      .sort();

  const failures = [];
  if (guardrailScope === "changed") {
    for (const route of noStructuredHandling) {
      failures.push(`${route}: missing withApiGuardrails or apiErrorResponse`);
    }
    if (rawErrorEnforced) {
      for (const route of rawErrorRoutes) {
        failures.push(`${route}: raw error response detected (use shared envelope)`);
      }
    }
  } else {
    const baselineMissing = noStructuredHandling.filter((route) => !baseline.has(route));
    const baselineResolved = [...baseline].filter(
      (route) => route.endsWith("/route.ts") && !noStructuredHandling.includes(route),
    );

    for (const route of baselineMissing) {
      failures.push(
        `${route}: non-compliant route is not in baseline; migrate route or explicitly add debt entry`,
      );
    }
    for (const route of baselineResolved) {
      failures.push(
        `${route}: baseline entry is stale (route now compliant); remove it from baseline`,
      );
    }
  }

  return {
    routes,
    noStructuredHandling,
    rawErrorRoutes,
    failures,
    rawErrorEnforced,
    guardrailScope,
  };
}

function main() {
  const report = buildGuardrailReport();
  if (report.routes.length === 0) {
    console.log(`No ${report.guardrailScope} API routes to validate.`);
    process.exit(0);
  }

  console.log(
    `Guardrail report (${report.guardrailScope}): routes=${report.routes.length}, without_structured_handling=${report.noStructuredHandling.length}, raw_error_routes=${report.rawErrorRoutes.length}, enforce_raw_errors=${report.rawErrorEnforced}`,
  );

  if (report.failures.length > 0) {
    console.error("Guardrail check failed:");
    for (const failure of report.failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log(`Guardrail check passed for ${report.routes.length} ${report.guardrailScope} route(s).`);
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  main();
}
