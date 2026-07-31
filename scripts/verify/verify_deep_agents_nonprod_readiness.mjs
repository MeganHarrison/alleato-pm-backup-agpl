#!/usr/bin/env node
import "dotenv/config";

import fs from "node:fs";
import yaml from "js-yaml";

const ACTIVE_BACKEND_HOST = "alleato-backend-rbnj.onrender.com";
const DEFAULT_BACKEND_URL = `https://${ACTIVE_BACKEND_HOST}`;
const backendUrl = (
  process.env.PYTHON_BACKEND_URL ||
  process.env.RENDER_BACKEND_URL ||
  process.env.BACKEND_URL ||
  DEFAULT_BACKEND_URL
).replace(/\/$/, "");

const expectEnabled = process.env.DEEP_AGENTS_EXPECT_ENABLED === "true";
const adminApiKey = process.env.ADMIN_API_KEY;
const DEFAULT_FETCH_TIMEOUT_MS = Number(process.env.DEEP_AGENTS_VERIFY_FETCH_TIMEOUT_MS || 120000);
const SHORT_FETCH_TIMEOUT_MS = Number(process.env.DEEP_AGENTS_VERIFY_SHORT_FETCH_TIMEOUT_MS || 30000);
const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

async function fetchWithTimeout(label, url, options = {}, timeoutMs = DEFAULT_FETCH_TIMEOUT_MS) {
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

function findBackendService(manifestPath) {
  const parsed = yaml.load(fs.readFileSync(manifestPath, "utf8"));
  const services = Array.isArray(parsed?.services) ? parsed.services : [];
  return services.find((service) => service?.type === "web" && service?.name === "alleato-backend");
}

function getEnvValue(service, key) {
  const envVars = Array.isArray(service?.envVars) ? service.envVars : [];
  const match = envVars.find((item) => item?.key === key);
  return match?.value;
}

function verifyManifest(manifestPath) {
  const service = findBackendService(manifestPath);
  if (!service) {
    fail(`${manifestPath}: missing web service named alleato-backend`);
    return;
  }

  const retired = [
    "DEEP_AGENTS_PROJECT_INTELLIGENCE_ENABLED",
    "DEEP_AGENTS_PROJECT_INTELLIGENCE_RUNTIME",
    "DEEP_AGENTS_PROJECT_INTELLIGENCE_MODEL",
  ];

  for (const key of retired) {
    const actual = getEnvValue(service, key);
    if (actual !== undefined) {
      fail(`${manifestPath}: retired ${key} is still configured`);
    }
  }
}

async function verifyRenderApiServiceMapping() {
  const apiKey = process.env.RENDER_API_KEY;
  if (!apiKey) {
    warn("RENDER_API_KEY is not available; skipped Render service mapping check.");
    return;
  }

  const response = await fetchWithTimeout(
    "Render service mapping check",
    "https://api.render.com/v1/services?limit=100",
    {
      headers: { accept: "application/json", authorization: `Bearer ${apiKey}` },
    },
    SHORT_FETCH_TIMEOUT_MS,
  );
  const payload = await response.json().catch(() => ({}));
  if (!response.ok) {
    warn(`Render service mapping check failed with HTTP ${response.status}.`);
    return;
  }

  const entries = Array.isArray(payload) ? payload : payload.services ?? [];
  const backendServices = entries
    .map((entry) => entry.service ?? entry)
    .filter((service) => service?.name === "alleato-backend");
  const activeService = backendServices.find((service) =>
    String(service?.serviceDetails?.url ?? "").includes(ACTIVE_BACKEND_HOST),
  );
  if (!activeService) {
    fail(
      `Render API key does not expose the active ${ACTIVE_BACKEND_HOST} service. Refusing to use any other Render backend service.`,
    );
  }
}

async function main() {
  verifyManifest("render.yaml");

  if (!backendUrl.includes(ACTIVE_BACKEND_HOST)) {
    fail(`Backend URL must point at ${ACTIVE_BACKEND_HOST}; found ${backendUrl}`);
  }

  const healthResponse = await fetchWithTimeout(
    "Active backend health check",
    `${backendUrl}/health`,
    {
      headers: { accept: "application/json" },
    },
    SHORT_FETCH_TIMEOUT_MS,
  );
  const health = await healthResponse.json().catch(() => ({}));
  if (!healthResponse.ok || health.status !== "healthy") {
    fail(`Active backend health failed: HTTP ${healthResponse.status}, status=${health.status ?? "missing"}`);
  }
  if (health.ai_gateway_configured !== true) {
    fail("Active backend health does not show AI Gateway configured.");
  }
  if (health.supabase_service_configured !== true) {
    fail("Active backend health does not show Supabase service configured.");
  }

  let researchEndpointState = "not_checked";
  let researchEndpointMode = null;
  let researchSourceCount = 0;
  let toolInventory = null;
  if (!adminApiKey) {
    fail("ADMIN_API_KEY is required for the Deep Agents endpoint readiness probe.");
  } else {
    const inventoryResponse = await fetchWithTimeout(
      "Deep Agents tool inventory probe",
      `${backendUrl}/api/intelligence/deep-agent/tool-inventory`,
      {
        headers: {
          accept: "application/json",
          "x-admin-api-key": adminApiKey,
        },
      },
      SHORT_FETCH_TIMEOUT_MS,
    );
    const inventoryPayload = await inventoryResponse.json().catch(() => ({}));
    if (!inventoryResponse.ok) {
      fail(`Deep Agents tool inventory probe failed with HTTP ${inventoryResponse.status}.`);
    }
    toolInventory = {
      status: inventoryPayload.status ?? null,
      runtime: inventoryPayload.runtime ?? null,
      toolCount: inventoryPayload.toolCount ?? 0,
      subagentCount: inventoryPayload.subagentCount ?? 0,
      tools: Array.isArray(inventoryPayload.tools) ? inventoryPayload.tools : [],
      subagents: Array.isArray(inventoryPayload.subagents) ? inventoryPayload.subagents : [],
      subagentDetails: Array.isArray(inventoryPayload.subagentDetails)
        ? inventoryPayload.subagentDetails
        : [],
      knownMissing: Array.isArray(inventoryPayload.knownMissing) ? inventoryPayload.knownMissing : [],
    };
    const requiredTools = [
      "resolve_project_by_name",
      "query_db",
      "search_unstructured",
      "draft_rfi",
      "acumatica_vendor_spend",
    ];
    const missingTools = requiredTools.filter((tool) => !toolInventory.tools.includes(tool));
    if (expectEnabled && missingTools.length > 0) {
      fail(`Deep Agents enabled check is missing required standalone tools: ${missingTools.join(", ")}.`);
    }
    if (expectEnabled && toolInventory.subagentCount < 5) {
      fail(`Deep Agents enabled check requires 5 subagents; found ${toolInventory.subagentCount}.`);
    }
    const requiredStructuredSubagents = new Map([
      ["financial-analyst", "FinancialAnalystPacket"],
      ["risk-analyst", "RiskAnalystPacket"],
      ["communications-analyst", "CommunicationsAnalystPacket"],
    ]);
    const subagentDetailsByName = new Map(
      toolInventory.subagentDetails.map((subagent) => [subagent?.name, subagent]),
    );
    if (expectEnabled) {
      for (const [name, responseFormat] of requiredStructuredSubagents) {
        const detail = subagentDetailsByName.get(name);
        if (!detail) {
          fail(`Deep Agents enabled check is missing subagent inventory detail for ${name}.`);
          continue;
        }
        if (detail.structuredOutput !== true || detail.responseFormat !== responseFormat) {
          fail(
            `Deep Agents enabled check requires ${name} structured output ${responseFormat}; found structuredOutput=${String(
              detail.structuredOutput,
            )}, responseFormat=${detail.responseFormat ?? "missing"}.`,
          );
        }
      }
    }

    const researchResponse = await fetchWithTimeout(
      "Deep Agents research endpoint probe",
      `${backendUrl}/api/intelligence/research`,
      {
        method: "POST",
        headers: {
          accept: "application/json",
          "content-type": "application/json",
          "x-admin-api-key": adminApiKey,
        },
        body: JSON.stringify({
          userId: "deep-agents-nonprod-readiness",
          sessionId: "deep-agents-nonprod-readiness-research",
          question:
            "In one short paragraph, confirm public web research is available and cite one public source URL.",
          maxSearches: 1,
        }),
      },
    );
    const researchPayload = await researchResponse.json().catch(() => ({}));
    researchEndpointMode = researchPayload.mode ?? null;
    researchSourceCount = Array.isArray(researchPayload.sources) ? researchPayload.sources.length : 0;
    if (
      researchResponse.status === 503 &&
      String(researchPayload.detail ?? "").includes("Deep Agents research is disabled")
    ) {
      researchEndpointState = "disabled";
    } else if (researchResponse.ok && researchEndpointMode === "deep_agents") {
      researchEndpointState = "deep_agents";
    } else if (researchResponse.ok) {
      researchEndpointState = researchEndpointMode ?? "enabled_unknown_mode";
    } else {
      fail(`Deep Agents research endpoint probe failed with HTTP ${researchResponse.status}.`);
    }
  }

  if (expectEnabled && researchEndpointState !== "deep_agents") {
    fail(`DEEP_AGENTS_EXPECT_ENABLED=true requires research endpoint mode deep_agents; found ${researchEndpointState}.`);
  }

  await verifyRenderApiServiceMapping();
  verifyVercelProductionBridgeEnv();

  const result = {
    backendUrl,
    health: {
      status: health.status ?? null,
      ai_gateway_configured: health.ai_gateway_configured === true,
      supabase_service_configured: health.supabase_service_configured === true,
    },
    researchEndpointState,
    researchEndpointMode,
    researchSourceCount,
    toolInventory,
    expectEnabled,
    warnings,
  };

  if (failures.length > 0) {
    console.error("Deep Agents non-production readiness check failed:");
    for (const item of failures) console.error(`- ${item}`);
    if (warnings.length > 0) {
      console.error("Warnings:");
      for (const item of warnings) console.error(`- ${item}`);
    }
    console.error(JSON.stringify(result, null, 2));
    process.exit(1);
  }

  console.log("Deep Agents non-production readiness check passed");
  console.log(JSON.stringify(result, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
