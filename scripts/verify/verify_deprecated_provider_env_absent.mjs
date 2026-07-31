#!/usr/bin/env node

import "dotenv/config";
import { execFileSync } from "node:child_process";

const deprecatedVercelKeys = [
  "EMBEDDING_API_KEY",
  "EMBEDDING_BASE_URL",
  "EMBEDDING_MODEL_CHOICE",
  "EMBEDDING_PROVIDER",
  "LLM_API_KEY",
  "OPENAI_VECTOR_STORE_ID",
  "RAG_PIPELINE_TYPE",
  "KNOWLEDGE_CHATKIT_API_DOMAIN_KEY",
  "NEXT_PUBLIC_CHATKIT_DOMAIN_KEY",
  "NEXT_PUBLIC_CHATKIT_WORKFLOW_ID",
  "NEXT_PUBLIC_ENABLE_AI_QUERIES",
  "NEXT_PUBLIC_ENABLE_STREAMING",
  "NEXT_PUBLIC_LANGFUSE_HOST_WITH_PROJECT",
];

const deprecatedRenderKeys = [
  "EMBEDDING_BASE_URL",
  "EMBEDDING_MODEL_CHOICE",
  "EMBEDDING_PROVIDER",
  "NEXT_PUBLIC_ENABLE_AI_QUERIES",
  "NEXT_PUBLIC_ENABLE_STREAMING",
  "RAG_PIPELINE_TYPE",
];

const renderToken = process.env.RENDER_API_KEY || process.env.RENDER_TOKEN;
const vercelScope = process.env.VERCEL_SCOPE || "meganharrisons-projects";
const strict = process.env.DEPRECATED_PROVIDER_ENV_STRICT === "1";

const failures = [];
const warnings = [];

function parseVercelKeys(output) {
  const found = new Set();
  for (const line of output.split(/\r?\n/)) {
    for (const key of deprecatedVercelKeys) {
      if (line.includes(key)) {
        found.add(key);
      }
    }
  }
  return [...found].sort();
}

async function listRenderServiceEnvKeys(serviceId) {
  const keys = [];
  let cursor = undefined;

  do {
    const url = new URL(`https://api.render.com/v1/services/${serviceId}/env-vars`);
    if (cursor) {
      url.searchParams.set("cursor", cursor);
    }

    const response = await fetch(url, {
      headers: {
        Authorization: `Bearer ${renderToken}`,
        Accept: "application/json",
      },
    });

    if (!response.ok) {
      throw new Error(`Render env read failed for ${serviceId}: ${response.status}`);
    }

    const page = await response.json();
    const rows = Array.isArray(page) ? page : page.envVars || page.results || [];
    for (const row of rows) {
      const key = row?.envVar?.key || row?.key;
      if (key) {
        keys.push(key);
      }
    }
    cursor = page?.nextPageCursor || page?.cursor || undefined;
  } while (cursor);

  return keys;
}

async function checkRender() {
  if (!renderToken) {
    warnings.push("Render check skipped: RENDER_API_KEY/RENDER_TOKEN is unavailable.");
    return;
  }

  const servicesResponse = await fetch("https://api.render.com/v1/services?limit=100", {
    headers: {
      Authorization: `Bearer ${renderToken}`,
      Accept: "application/json",
    },
  });

  if (!servicesResponse.ok) {
    throw new Error(`Render service list failed: ${servicesResponse.status}`);
  }

  const servicesPayload = await servicesResponse.json();
  const serviceRows = Array.isArray(servicesPayload)
    ? servicesPayload
    : servicesPayload.services || servicesPayload.results || [];

  const matches = [];
  for (const row of serviceRows) {
    const service = row?.service || row;
    const serviceId = service?.id;
    const serviceName = service?.name || serviceId;
    if (!serviceId) {
      continue;
    }

    const keys = await listRenderServiceEnvKeys(serviceId);
    for (const key of keys) {
      if (deprecatedRenderKeys.includes(key)) {
        matches.push(`${serviceName}:${key}`);
      }
    }
  }

  if (matches.length > 0) {
    failures.push(`Render deprecated env keys still present: ${matches.sort().join(", ")}`);
  }
}

function checkVercel() {
  try {
    const output = execFileSync("vercel", ["env", "ls", "--scope", vercelScope], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
      timeout: 60_000,
    });
    const found = parseVercelKeys(output);
    if (found.length > 0) {
      failures.push(`Vercel deprecated env keys still present: ${found.join(", ")}`);
    }
  } catch (error) {
    const reason = error instanceof Error ? error.message : String(error);
    warnings.push(`Vercel check skipped: ${reason}`);
  }
}

checkVercel();
await checkRender();

for (const warning of warnings) {
  console.warn(`[deprecated-provider-env] WARN ${warning}`);
}

if (failures.length > 0) {
  for (const failure of failures) {
    console.error(`[deprecated-provider-env] FAIL ${failure}`);
  }
  process.exit(1);
}

if (strict && warnings.length > 0) {
  console.error("[deprecated-provider-env] FAIL strict mode requires provider read access.");
  process.exit(1);
}

console.log("[deprecated-provider-env] PASS no deprecated provider env keys found.");
