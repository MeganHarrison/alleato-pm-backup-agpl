#!/usr/bin/env node
import "dotenv/config";

import fs from "node:fs";
import yaml from "js-yaml";

const ACTIVE_BACKEND_HOST = "alleato-backend-rbnj.onrender.com";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";
const RENDER_SERVICE_ID = process.env.RENDER_BACKEND_SERVICE_ID || "srv-d8271ohj2pic739klb7g";
const SHORT_TIMEOUT_MS = Number(process.env.DEEP_AGENTS_RENDER_ENV_TIMEOUT_MS || 30000);
const REQUIRE_LIVE_RENDER_ENV =
  process.env.RENDER_ENV_STRICT === "true" || process.env.REQUIRE_RENDER_PROVIDER_READBACK === "true";

const REQUIRED_ENV = new Map([
  ["DEEP_AGENTS_DOCS_RESEARCH_ENABLED", "true"],
  ["DEEP_AGENTS_DOCS_RESEARCH_MODEL", "gpt-5.4-mini"],
  ["LANGCHAIN_DOCS_MCP_URL", "https://docs.langchain.com/mcp"],
  ["DEEP_AGENTS_LLM_WIKI_ENABLED", "true"],
  ["DEEP_AGENTS_LLM_WIKI_MODEL", "gpt-5.4-mini"],
  ["LLM_WIKI_OUTPUT_ROOT", "/data/llm-wiki"],
  ["DOCS_RESEARCH_OUTPUT_ROOT", "/data/docs-research"],
  ["CONTENT_BUILDER_OUTPUT_ROOT", "/data/content-builder"],
]);

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

function normalize(value) {
  if (typeof value === "boolean") return String(value);
  return String(value ?? "").trim();
}

function readBackendService(manifestPath) {
  const parsed = yaml.load(fs.readFileSync(manifestPath, "utf8"));
  const services = Array.isArray(parsed?.services) ? parsed.services : [];
  return services.find((service) => service?.type === "web" && service?.name === "alleato-backend");
}

function verifyManifest(manifestPath) {
  const service = readBackendService(manifestPath);
  if (!service) {
    fail(`${manifestPath}: missing web service named alleato-backend`);
    return;
  }
  const envVars = Array.isArray(service.envVars) ? service.envVars : [];
  const envMap = new Map(envVars.map((item) => [item?.key, normalize(item?.value)]));
  for (const [key, expected] of REQUIRED_ENV.entries()) {
    const actual = envMap.get(key);
    if (actual !== expected) {
      fail(`${manifestPath}: expected ${key}=${expected}; found ${actual || "<missing>"}`);
    }
  }
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHORT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

async function verifyLiveRenderEnv() {
  const token = process.env.RENDER_API_KEY || process.env.RENDER_TOKEN;
  if (!token) {
    const message = "RENDER_API_KEY or RENDER_TOKEN is not available; skipped live Render env check.";
    if (REQUIRE_LIVE_RENDER_ENV) {
      fail(message);
    } else {
      warn(message);
    }
    return null;
  }

  const headers = {
    accept: "application/json",
    authorization: `Bearer ${token}`,
  };

  const service = await fetchJsonWithTimeout(`${RENDER_SERVICE_URL}/${RENDER_SERVICE_ID}`, { headers });
  const servicePayload = service.service ?? service;
  const serviceUrl = String(servicePayload?.serviceDetails?.url ?? "");
  if (!serviceUrl.includes(ACTIVE_BACKEND_HOST)) {
    fail(
      `Render service ${RENDER_SERVICE_ID} does not point at ${ACTIVE_BACKEND_HOST}; found ${serviceUrl || "<missing>"}`,
    );
  }

  const rows = await fetchJsonWithTimeout(`${RENDER_SERVICE_URL}/${RENDER_SERVICE_ID}/env-vars?limit=100`, {
    headers,
  });
  const envMap = new Map(
    (Array.isArray(rows) ? rows : [])
      .map((row) => row.envVar ?? row)
      .filter((row) => row?.key)
      .map((row) => [row.key, normalize(row.value)]),
  );

  for (const [key, expected] of REQUIRED_ENV.entries()) {
    const actual = envMap.get(key);
    if (actual !== expected) {
      fail(`Live Render env expected ${key}=${expected}; found ${actual || "<missing>"}`);
    }
  }

  return {
    serviceId: RENDER_SERVICE_ID,
    serviceUrl,
    checkedKeys: [...REQUIRED_ENV.keys()],
  };
}

async function main() {
  verifyManifest("render.yaml");
  const live = await verifyLiveRenderEnv();

  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (failures.length > 0) {
    console.error("Deep Agents docs/wiki Render env verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Deep Agents docs/wiki Render env verification passed");
  console.log(JSON.stringify({ manifests: ["render.yaml"], live }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
