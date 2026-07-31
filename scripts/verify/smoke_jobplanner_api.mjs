#!/usr/bin/env node

/**
 * JobPlanner API read-sync smoke.
 *
 * Validates the vendor-provided ApiKey header auth and read endpoints without
 * printing request headers, secrets, or raw JobPlanner records.
 */

import path from "node:path";
import { fileURLToPath } from "node:url";

import dotenv from "dotenv";

const __filename = fileURLToPath(import.meta.url);
const repoRoot = path.resolve(path.dirname(__filename), "../..");

dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });
dotenv.config({ path: path.join(repoRoot, ".env.local"), quiet: true });
dotenv.config({ path: path.join(repoRoot, "frontend/.env.local"), quiet: true });

const apiKey = process.env.JOBPLANNER_API_KEY?.trim();
const configuredProjectId = process.env.JOBPLANNER_PROJECT_ID?.trim();
const timeoutMs = Number(process.env.JOBPLANNER_SMOKE_TIMEOUT_MS ?? 30_000);

const endpoints = [
  {
    label: "project details",
    baseUrl: "https://api.jobplanner.com",
    path: "/projects/{projectId}",
  },
  {
    label: "project attachments",
    baseUrl: "https://api.jobplanner.com",
    path: "/projects/{projectId}/attachments",
  },
  {
    label: "project RFIs",
    baseUrl: "https://api.jobplanner.com",
    path: "/projects/{projectId}/rfi",
  },
  {
    label: "project submittals",
    baseUrl: "https://api.jobplanner.com",
    path: "/projects/{projectId}/submittals",
  },
  {
    label: "project budget",
    baseUrl: "https://api-v2.jobplanner.com",
    path: "/projects/{projectId}/budgets",
  },
  {
    label: "commitment change orders",
    baseUrl: "https://api-v2.jobplanner.com",
    path: "/projects/{projectId}/commitmentchangeorders",
  },
  {
    label: "prime contract change orders",
    baseUrl: "https://api-v2.jobplanner.com",
    path: "/projects/{projectId}/primecontractchangeorders",
  },
  {
    label: "meetings",
    baseUrl: "https://api-v2.jobplanner.com",
    path: "/projects/{projectId}/meetings",
  },
];

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

function summarizePayload(payload) {
  if (Array.isArray(payload)) {
    return {
      shape: "array",
      count: payload.length,
      sampleKeys: payload[0] && typeof payload[0] === "object" ? Object.keys(payload[0]).sort().slice(0, 12) : [],
    };
  }

  if (payload && typeof payload === "object") {
    const arrayEntry = Object.entries(payload).find(([, value]) => Array.isArray(value));
    return {
      shape: "object",
      keys: Object.keys(payload).sort().slice(0, 16),
      arrayField: arrayEntry?.[0] ?? null,
      count: arrayEntry ? arrayEntry[1].length : null,
      sampleKeys:
        arrayEntry?.[1]?.[0] && typeof arrayEntry[1][0] === "object"
          ? Object.keys(arrayEntry[1][0]).sort().slice(0, 12)
          : [],
    };
  }

  return { shape: typeof payload };
}

function findArray(payload) {
  if (Array.isArray(payload)) return payload;
  if (!payload || typeof payload !== "object") return [];

  for (const key of ["projects", "data", "items", "results", "value"]) {
    if (Array.isArray(payload[key])) return payload[key];
  }

  const firstArray = Object.values(payload).find((value) => Array.isArray(value));
  return firstArray ?? [];
}

function findProjectId(payload) {
  const projects = findArray(payload);
  for (const project of projects) {
    if (!project || typeof project !== "object") continue;
    const candidate = project.id ?? project.projectId ?? project.ProjectId ?? project.projectID ?? project.ID;
    if (candidate !== undefined && candidate !== null && String(candidate).trim()) {
      return String(candidate).trim();
    }
  }
  return null;
}

async function fetchJson(label, url) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  let response;
  try {
    response = await fetch(url, {
      headers: {
        accept: "application/json",
        ApiKey: apiKey,
      },
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

  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      throw new Error(`${label} returned HTTP ${response.status} with a non-JSON body (${text.length} bytes).`);
    }
  }

  return { response, payload };
}

async function verifyEndpoint(label, url) {
  try {
    const { response, payload } = await fetchJson(label, url);
    const summary = summarizePayload(payload);
    requireCondition(response.ok, `${label} returned HTTP ${response.status}`);
    if (response.ok) {
      pass(`${label} payload metadata: ${JSON.stringify(summary)}`);
    } else {
      fail(`${label} response metadata: ${JSON.stringify(summary)}`);
    }
    return { ok: response.ok, payload, summary };
  } catch (error) {
    fail(`${label} failed: ${error.message}`);
    return { ok: false, payload: null, summary: null };
  }
}

async function main() {
  if (!apiKey) {
    throw new Error("JOBPLANNER_API_KEY is required. Set it in the environment; do not commit it.");
  }

  const projectList = await verifyEndpoint("project list", "https://api.jobplanner.com/projects");
  const projectId = configuredProjectId || findProjectId(projectList.payload);

  requireCondition(Boolean(projectId), "project id is available for project-scoped endpoint checks");
  if (!projectId) {
    warn("Set JOBPLANNER_PROJECT_ID to check project-scoped endpoints when the project list shape changes.");
  } else {
    for (const endpoint of endpoints) {
      const url = `${endpoint.baseUrl}${endpoint.path.replace("{projectId}", encodeURIComponent(projectId))}`;
      await verifyEndpoint(endpoint.label, url);
    }
  }

  console.log(JSON.stringify({ evidence, warnings, failures }, null, 2));

  if (failures.length > 0) {
    throw new Error(`JobPlanner API smoke failed with ${failures.length} failure(s).`);
  }
}

main().catch((error) => {
  console.error(error.message);
  process.exitCode = 1;
});
