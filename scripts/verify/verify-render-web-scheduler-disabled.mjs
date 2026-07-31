#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import yaml from "js-yaml";

const BLUEPRINTS = ["render.yaml"];
const RENDER_SERVICES_URL = "https://api.render.com/v1/services?limit=100";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";

const REQUIRED_WEB_FLAGS = new Map([
  ["BACKEND_API_ONLY", "true"],
  ["DISABLE_SCHEDULER", "true"],
  ["ACUMATICA_FINANCIAL_SYNC_ENABLED", "false"],
  ["GRAPH_API_INGESTION_ENABLED", "false"],
  ["GRAPH_SYNC_ENABLED", "false"],
  ["GRAPH_SYNC_OUTLOOK", "false"],
  ["GRAPH_SYNC_TEAMS", "false"],
  ["GRAPH_SYNC_TEAMS_DM", "false"],
  ["GRAPH_SYNC_ONEDRIVE", "false"],
  ["GRAPH_SUBSCRIPTIONS_ENABLED", "false"],
  ["GRAPH_WEBHOOK_DRAIN_ENABLED", "false"],
  ["INTELLIGENCE_COMPILER_ENABLED", "false"],
  ["SOURCE_SYNC_HEALTH_RECOMPUTE_ENABLED", "false"],
  ["TASK_EXTRACTION_ENABLED", "false"],
]);

const REQUIRED_SUSPENDED_CRONS = new Set([
  "alleato-acumatica-financial-sync",
  "alleato-ai-provider-health",
  "alleato-daily-recap",
  "alleato-domain-packet-compiler",
  "alleato-fireflies-sync",
  "alleato-graph-sync",
  "alleato-microsoft-executive-assistant-check",
  "alleato-project-synthesis-sweep",
  "alleato-rag-health",
  "alleato-source-rag-health",
  "alleato-source-sync-health",
  "alleato-teams-channel-sync",
  "alleato-teams-dm-sync",
]);

const SAFE_RESTART_CRON_SCHEDULES = new Map([
  "alleato-executive-daily-brief-evening",
  "alleato-executive-daily-brief-morning",
  "alleato-outlook-attachment-promotion",
].map((name) => [name, null]));

SAFE_RESTART_CRON_SCHEDULES.set("alleato-executive-daily-brief-evening", "30 22,23 * * 1-5");
SAFE_RESTART_CRON_SCHEDULES.set("alleato-executive-daily-brief-morning", "0 11,12 * * 1-5");
SAFE_RESTART_CRON_SCHEDULES.set("alleato-outlook-attachment-promotion", "*/30 * * * *");

const SAFE_RESTART_REQUIRED_ENV = new Map([
  [
    "alleato-graph-sync",
    new Map([
      ["GRAPH_SYNC_TEAMS", "false"],
      ["GRAPH_SYNC_TEAMS_DM", "false"],
      ["GRAPH_SYNC_ONEDRIVE", "false"],
      ["GRAPH_SYNC_SHAREPOINT", "true"],
      ["GRAPH_DELTA_MAX_PAGES", "3"],
      ["GRAPH_DELTA_MAX_ITEMS", "250"],
      ["OUTLOOK_SYNC_MAX_USERS", "1"],
      ["SHAREPOINT_SYNC_MAX_FOLDERS", "2"],
      ["GRAPH_EMBEDDING_LIMIT", "25"],
      ["TEAMS_COMPILER_BATCH_SIZE", "25"],
    ]),
  ],
  [
    "alleato-teams-channel-sync",
    new Map([
      ["GRAPH_DELTA_MAX_PAGES", "3"],
      ["GRAPH_DELTA_MAX_ITEMS", "250"],
      ["TEAMS_CHANNEL_SYNC_MAX_CHANNELS", "3"],
    ]),
  ],
  [
    "alleato-teams-dm-sync",
    new Map([
      ["TEAMS_DM_SYNC_MAX_USERS", "1"],
      ["TEAMS_DM_EXPORT_PAGE_SIZE", "25"],
      ["TEAMS_DM_EXPORT_MAX_PAGES", "2"],
    ]),
  ],
]);

const DISABLED_CRON_SCHEDULE = "0 0 1 1 *";
const APP_DB_PRESSURE_GUARD_ENV = new Map([
  ["APP_DB_PRESSURE_GUARD_REQUIRED", "true"],
]);
const APP_DB_PRESSURE_GUARD_SECRET_KEYS = new Set(["DATABASE_URL"]);

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);
  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#")) continue;
    const index = trimmed.indexOf("=");
    if (index === -1) continue;
    const key = trimmed.slice(0, index).trim();
    const value = trimmed.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

function isStructurallyDisabledCron(service) {
  const schedule = service?.serviceDetails?.schedule || service?.schedule;
  const command = service?.serviceDetails?.envSpecificDetails?.dockerCommand || "";
  return schedule === DISABLED_CRON_SCHEDULE && command.includes("disabled while DB incident guard is active");
}

function normalizeValue(value) {
  return String(value ?? "").trim().toLowerCase();
}

function envMap(service) {
  return new Map(
    (service.envVars ?? [])
      .filter((entry) => entry && typeof entry.key === "string")
      .map((entry) => [entry.key, normalizeValue(entry.value)]),
  );
}

function rawEnvEntries(service) {
  return (service.envVars ?? []).filter((entry) => entry && typeof entry.key === "string");
}

function hasEnvKey(service, key) {
  return rawEnvEntries(service).some((entry) => entry.key === key);
}

function verifyBlueprintCronGuardrail(blueprintPath, service) {
  if (service?.type !== "cron" || !String(service.name || "").startsWith("alleato-")) {
    return;
  }
  const env = envMap(service);
  for (const [key, expected] of APP_DB_PRESSURE_GUARD_ENV.entries()) {
    const actual = env.get(key);
    if (actual !== expected) {
      failures.push(
        `${blueprintPath}: ${service.name} must set ${key}=${expected}; found ${actual || "<missing>"}`,
      );
    }
  }
  for (const key of APP_DB_PRESSURE_GUARD_SECRET_KEYS) {
    if (!hasEnvKey(service, key)) {
      failures.push(`${blueprintPath}: ${service.name} must define ${key} so the DB pressure guard can fail closed`);
    }
  }
}

const failures = [];

loadDotEnv();

for (const blueprintPath of BLUEPRINTS) {
  const absolutePath = path.resolve(blueprintPath);
  const parsed = yaml.load(fs.readFileSync(absolutePath, "utf8"));
  const services = Array.isArray(parsed?.services) ? parsed.services : [];
  const backend = services.find(
    (service) => service?.type === "web" && service?.name === "alleato-backend",
  );

  if (!backend) {
    failures.push(`${blueprintPath}: missing web service named alleato-backend`);
    continue;
  }

  const env = envMap(backend);
  for (const [key, expected] of REQUIRED_WEB_FLAGS.entries()) {
    const actual = env.get(key);
    if (actual !== expected) {
      failures.push(
        `${blueprintPath}: alleato-backend must set ${key}=${expected}; found ${actual || "<missing>"}`,
      );
    }
  }

  for (const service of services) {
    verifyBlueprintCronGuardrail(blueprintPath, service);
  }
}

async function fetchRenderJson(url, token) {
  const response = await fetch(url, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function fetchRenderJsonWithRetry(url, token, attempts = 3) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fetchRenderJson(url, token);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1)));
    }
  }
  throw lastError;
}

async function verifyRenderEnv(serviceId, serviceName, token) {
  const expectedEnv = new Map([
    ...APP_DB_PRESSURE_GUARD_ENV,
    ...(SAFE_RESTART_REQUIRED_ENV.get(serviceName) ?? new Map()),
  ]);

  const envRows = await fetchRenderJsonWithRetry(
    `${RENDER_SERVICE_URL}/${serviceId}/env-vars?limit=100`,
    token,
  );
  const liveEnv = new Map(
    envRows.map((row) => {
      const envVar = row.envVar ?? row;
      return [envVar.key, normalizeValue(envVar.value)];
    }),
  );

  for (const [key, expected] of expectedEnv.entries()) {
    const actual = liveEnv.get(key);
    if (actual !== expected) {
      failures.push(
        `Render cron ${serviceName} must set ${key}=${expected} before resume; found ${actual || "<missing>"}`,
      );
    }
  }
  for (const key of APP_DB_PRESSURE_GUARD_SECRET_KEYS) {
    if (!liveEnv.has(key)) {
      failures.push(`Render cron ${serviceName} must define ${key} before resume`);
    }
  }
}

async function verifyRenderCronSuspensions() {
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    return;
  }

  let services;
  try {
    services = await fetchRenderJson(RENDER_SERVICES_URL, token);
  } catch (error) {
    failures.push(
      `Render API cron guard failed: ${error.message}`,
    );
  }

  if (services) {
    const idsByName = new Map();
    for (const item of services) {
      const service = item.service ?? item;
      if (
        service?.type === "cron_job" &&
        (REQUIRED_SUSPENDED_CRONS.has(service.name) || SAFE_RESTART_CRON_SCHEDULES.has(service.name))
      ) {
        idsByName.set(service.name, service.id);
      }
      if (
        service?.type === "cron_job" &&
        REQUIRED_SUSPENDED_CRONS.has(service.name) &&
        service.suspended !== "suspended" &&
        !isStructurallyDisabledCron(service)
      ) {
        console.warn(
          `Render cron ${service.name} list endpoint is stale or unsafe; direct service checks remain the source of truth`,
        );
      }
    }

    for (const name of REQUIRED_SUSPENDED_CRONS) {
      const id = idsByName.get(name);
      if (!id) {
        continue;
      }
      let service;
      try {
        service = await fetchRenderJsonWithRetry(`${RENDER_SERVICE_URL}/${id}`, token);
      } catch (error) {
        failures.push(`Render cron ${name} direct check failed: ${error.message}`);
        continue;
      }
      if (service.suspended !== "suspended" && !isStructurallyDisabledCron(service)) {
        failures.push(
          `Render cron ${name} must stay suspended or structurally disabled while DB incident guard is active; found ${service.suspended || "<unknown>"}`,
        );
      }
    }

    for (const [name, expectedSchedule] of SAFE_RESTART_CRON_SCHEDULES.entries()) {
      const id = idsByName.get(name);
      if (!id) {
        continue;
      }
      let service;
      try {
        service = await fetchRenderJsonWithRetry(`${RENDER_SERVICE_URL}/${id}`, token);
      } catch (error) {
        failures.push(`Render cron ${name} direct check failed: ${error.message}`);
        continue;
      }
      const schedule = service?.serviceDetails?.schedule || service?.schedule;
      if (service.suspended !== "suspended" && schedule !== expectedSchedule) {
        failures.push(
          `Render cron ${name} may only be resumed on schedule ${expectedSchedule}; found ${schedule || "<unknown>"}`,
        );
      }
      await verifyRenderEnv(id, name, token);
    }
  }
}

await verifyRenderCronSuspensions();

if (failures.length > 0) {
  console.error("Render web scheduler guardrail failed:");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("Render web scheduler guardrail passed.");
