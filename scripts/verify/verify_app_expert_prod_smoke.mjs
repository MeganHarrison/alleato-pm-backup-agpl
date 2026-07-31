#!/usr/bin/env node

/**
 * App Expert production smoke
 * ---------------------------
 * Fast deployment/readiness guard for the read-only App Expert specialist.
 * Full answer quality belongs to `rag:verify:app-expert-evals:prod`; this
 * smoke catches deployment drift, disabled flags, missing route exposure, and
 * an ungrounded endpoint response.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const ACTIVE_RENDER_SERVICE_ID = "srv-d8271ohj2pic739klb7g";
const ACTIVE_BACKEND_HOST = "alleato-backend-rbnj.onrender.com";
const DEFAULT_BACKEND_URL = `https://${ACTIVE_BACKEND_HOST}`;
const backendUrl = (
  process.env.APP_EXPERT_SMOKE_BACKEND_URL ||
  process.env.APP_EXPERT_EVAL_BACKEND_URL ||
  process.env.PYTHON_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  process.env.BACKEND_URL ||
  DEFAULT_BACKEND_URL
).replace(/\/+$/u, "");
const endpointUrl = `${backendUrl}/api/intelligence/app-expert`;
const adminApiKey = process.env.ADMIN_API_KEY?.trim();
const renderApiKey = process.env.RENDER_API_KEY?.trim();
const timeoutMs = Number(process.env.APP_EXPERT_SMOKE_TIMEOUT_MS ?? 45_000);
const failures = [];
const warnings = [];
const evidence = [];

function fail(message) {
  failures.push(message);
  evidence.push({ status: "fail", message });
}

function warn(message) {
  warnings.push(message);
  evidence.push({ status: "warn", message });
}

function pass(message) {
  evidence.push({ status: "pass", message });
}

function requireCondition(condition, message) {
  if (condition) pass(message);
  else fail(message);
}

function readJson(relativePath) {
  return JSON.parse(fs.readFileSync(path.join(repoRoot, relativePath), "utf8"));
}

async function fetchWithTimeout(label, url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);
  try {
    return await fetch(url, {
      ...options,
      signal: controller.signal,
    });
  } catch (error) {
    if (error?.name === "AbortError") {
      throw new Error(`${label} timed out after ${timeoutMs}ms`);
    }
    throw error;
  } finally {
    clearTimeout(timeout);
  }
}

async function readJsonResponse(label, response) {
  const text = await response.text();
  try {
    return text ? JSON.parse(text) : {};
  } catch {
    fail(`${label} returned non-JSON response: ${text.slice(0, 300)}`);
    return {};
  }
}

function getEnvVarValue(entries, key) {
  for (const entry of entries) {
    const candidate = entry?.envVar ?? entry;
    if (candidate?.key === key) return candidate?.value;
  }
  return undefined;
}

async function verifyRenderFlags() {
  if (!renderApiKey) {
    warn("RENDER_API_KEY is not available; skipped Render env read-back.");
    return null;
  }

  const response = await fetchWithTimeout(
    "Render App Expert env check",
    `https://api.render.com/v1/services/${ACTIVE_RENDER_SERVICE_ID}/env-vars`,
    {
      headers: {
        accept: "application/json",
        authorization: `Bearer ${renderApiKey}`,
      },
    },
  );
  const payload = await readJsonResponse("Render App Expert env check", response);
  if (!response.ok) {
    fail(`Render App Expert env check failed with HTTP ${response.status}.`);
    return null;
  }

  const entries = Array.isArray(payload) ? payload : payload.envVars ?? [];
  const enabled = getEnvVarValue(entries, "DEEP_AGENTS_APP_EXPERT_ENABLED");
  const model = getEnvVarValue(entries, "DEEP_AGENTS_APP_EXPERT_MODEL");
  requireCondition(enabled === "true", "Render has DEEP_AGENTS_APP_EXPERT_ENABLED=true");
  requireCondition(Boolean(model), "Render has DEEP_AGENTS_APP_EXPERT_MODEL configured");
  return { enabled, model };
}

async function verifyBackendHealth() {
  const response = await fetchWithTimeout("active backend health", `${backendUrl}/health`, {
    headers: { accept: "application/json" },
  });
  const health = await readJsonResponse("active backend health", response);
  requireCondition(response.ok, `active backend /health returns HTTP ${response.status}`);
  requireCondition(health.status === "healthy", "active backend reports healthy status");
  requireCondition(health.ai_gateway_configured === true, "active backend has AI Gateway configured");
  requireCondition(health.supabase_service_configured === true, "active backend has Supabase service configured");
  return health;
}

async function verifyOpenApiExposure() {
  const response = await fetchWithTimeout("OpenAPI route exposure", `${backendUrl}/openapi.json`, {
    headers: { accept: "application/json" },
  });
  const openapi = await readJsonResponse("OpenAPI route exposure", response);
  requireCondition(response.ok, `OpenAPI returns HTTP ${response.status}`);
  requireCondition(
    Boolean(openapi?.paths?.["/api/intelligence/app-expert"]?.post),
    "OpenAPI exposes POST /api/intelligence/app-expert",
  );
  return Boolean(openapi?.paths?.["/api/intelligence/app-expert"]?.post);
}

function findSmokeCase() {
  const suite = readJson("docs/ai-plan/evals/app-expert-eval-suite.json");
  return (suite.cases ?? []).find((testCase) => testCase.id === "appnav-change-events-location");
}

async function verifyAppExpertResponse() {
  if (!adminApiKey) {
    fail("ADMIN_API_KEY is required for App Expert endpoint smoke.");
    return null;
  }

  const smokeCase = findSmokeCase();
  if (!smokeCase) {
    fail("Missing smoke eval case: appnav-change-events-location.");
    return null;
  }

  const response = await fetchWithTimeout("App Expert endpoint smoke", endpointUrl, {
    method: "POST",
    headers: {
      accept: "application/json",
      "content-type": "application/json",
      "x-admin-api-key": adminApiKey,
    },
    body: JSON.stringify({
      userId: "app-expert-prod-smoke",
      sessionId: "app-expert-prod-smoke",
      question: smokeCase.question,
      currentRoute: smokeCase.currentRoute,
      projectId: smokeCase.projectId,
    }),
  });
  const payload = await readJsonResponse("App Expert endpoint smoke", response);
  requireCondition(response.ok, `App Expert endpoint returns HTTP ${response.status}`);
  requireCondition(payload.mode === "deep_agents", "App Expert endpoint returns mode=deep_agents");
  requireCondition(typeof payload.answer === "string" && payload.answer.trim().length > 0, "App Expert answer is non-empty");
  requireCondition(Array.isArray(payload.sources) && payload.sources.length > 0, "App Expert response includes sources");
  requireCondition(Array.isArray(payload.toolTrace) && payload.toolTrace.length > 0, "App Expert response includes toolTrace");

  const observed = [
    payload.answer,
    JSON.stringify(payload.sources ?? []),
    JSON.stringify(payload.toolTrace ?? []),
  ].join("\n").toLowerCase();
  for (const requiredText of smokeCase.expected?.mustInclude ?? smokeCase.mustInclude ?? []) {
    requireCondition(
      observed.includes(String(requiredText).toLowerCase()),
      `App Expert smoke includes required text: ${requiredText}`,
    );
  }
  for (const excludedText of smokeCase.expected?.mustExclude ?? smokeCase.mustExclude ?? []) {
    requireCondition(
      !observed.includes(String(excludedText).toLowerCase()),
      `App Expert smoke excludes forbidden text: ${excludedText}`,
    );
  }
  requireCondition(
    !/\b(required generated artifacts are missing|artifact status:\s*missing|APP_EXPERT_ARTIFACT_MISSING)\b/iu.test(
      observed,
    ),
    "App Expert smoke does not report missing generated artifacts",
  );
  const hasGeneratedArtifactEvidence =
    (Array.isArray(payload.sources) &&
      payload.sources.some((source) => {
        const sourceType = String(source?.sourceType ?? "").toLowerCase();
        const route = String(source?.route ?? source?.title ?? source?.filePath ?? "").toLowerCase();
        return (
          sourceType === "sitemap" &&
          (route.includes("/change-events") ||
            route.includes("docs/alleato-os-docs/help/articles/change-events.mdx") ||
            route.includes("frontend/src/app") ||
            route.includes("/src/app"))
        );
      })) ||
    observed.includes("get_app_sitemap") ||
    observed.includes("search_app_sitemap") ||
    observed.includes("search_feature_registry") ||
    observed.includes("app-sitemap.generated.json") ||
    observed.includes("feature-registry.generated.json");
  requireCondition(
    hasGeneratedArtifactEvidence,
    "App Expert smoke used generated app artifacts",
  );

  return {
    mode: payload.mode ?? null,
    sourceCount: Array.isArray(payload.sources) ? payload.sources.length : 0,
    toolTraceCount: Array.isArray(payload.toolTrace) ? payload.toolTrace.length : 0,
  };
}

async function main() {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    console.error(`Invalid APP_EXPERT_SMOKE_TIMEOUT_MS: ${timeoutMs}`);
    process.exit(1);
  }

  requireCondition(
    backendUrl.includes(ACTIVE_BACKEND_HOST),
    `App Expert smoke targets active backend host ${ACTIVE_BACKEND_HOST}`,
  );

  const [health, renderEnv, openapiExposed, appExpert] = await Promise.all([
    verifyBackendHealth(),
    verifyRenderFlags(),
    verifyOpenApiExposure(),
    verifyAppExpertResponse(),
  ]);

  const summary = {
    status: failures.length > 0 ? "fail" : warnings.length > 0 ? "warn" : "pass",
    backendUrl,
    endpointUrl,
    activeRenderServiceId: ACTIVE_RENDER_SERVICE_ID,
    health: health
      ? {
          status: health.status ?? null,
          ai_gateway_configured: health.ai_gateway_configured === true,
          supabase_service_configured: health.supabase_service_configured === true,
        }
      : null,
    renderEnv,
    openapiExposed,
    appExpert,
    totals: {
      checks: evidence.length,
      passed: evidence.filter((item) => item.status === "pass").length,
      warnings: warnings.length,
      failures: failures.length,
    },
    failures,
    warnings,
    evidence,
    nextFullGate: "npm run rag:verify:app-expert-evals:prod",
  };

  if (failures.length > 0) {
    console.error("App Expert production smoke failed:");
    for (const failure of failures) console.error(`- ${failure}`);
    if (warnings.length > 0) {
      console.error("Warnings:");
      for (const warning of warnings) console.error(`- ${warning}`);
    }
    console.error(JSON.stringify(summary, null, 2));
    process.exit(1);
  }

  console.log("App Expert production smoke passed");
  console.log(JSON.stringify(summary, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.stack ?? error.message : String(error));
  process.exit(1);
});
