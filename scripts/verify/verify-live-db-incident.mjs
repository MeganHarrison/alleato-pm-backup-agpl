#!/usr/bin/env node

import fs from "node:fs";
import process from "node:process";
import pg from "pg";

const PROJECT_REF = process.env.SUPABASE_PROJECT_REF || "lgveqfnpkxvzbnnwuled";
const RENDER_SERVICES_URL = "https://api.render.com/v1/services?limit=100";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";
const SUPABASE_HEALTH_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/health?services=db,pooler,rest`;
const SUPABASE_LOGS_URL = `https://api.supabase.com/v1/projects/${PROJECT_REF}/analytics/endpoints/logs.all`;
const DEFAULT_WINDOW_MINUTES = 30;

const REQUIRED_WEB_FLAGS = new Map([
  ["APP_DB_PRESSURE_GUARD_REQUIRED", "true"],
  ["BACKEND_API_ONLY", "true"],
  ["DISABLE_SCHEDULER", "true"],
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

const SAFE_RESUMED_CRON_ENV = new Map();
const SAFE_RESUMED_CRONS = new Set();
const DISABLED_CRON_SCHEDULE = "0 0 1 1 *";

function parseDotEnvFile(path) {
  if (!fs.existsSync(path)) return new Map();
  const values = new Map();
  const lines = fs.readFileSync(path, "utf8").split(/\r?\n/);
  for (const line of lines) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key) values.set(key, value);
  }
  return values;
}

function loadDotEnv(path = ".env") {
  const values = parseDotEnvFile(path);
  for (const [key, value] of values.entries()) {
    if (process.env[key] === undefined) {
      process.env[key] = value;
    }
  }
}

async function resolveSupabaseAccessToken() {
  const candidates = [];
  const seen = new Set();

  function add(label, value) {
    const token = String(value || "").trim();
    if (!token || seen.has(token)) return;
    seen.add(token);
    candidates.push({ label, token });
  }

  add("process.env:SUPABASE_ACCESS_TOKEN", process.env.SUPABASE_ACCESS_TOKEN);
  add("process.env:SUPABASE_MANAGEMENT_API_TOKEN", process.env.SUPABASE_MANAGEMENT_API_TOKEN);

  for (const path of [".env", "frontend/.env.local"]) {
    const values = parseDotEnvFile(path);
    add(`${path}:SUPABASE_ACCESS_TOKEN`, values.get("SUPABASE_ACCESS_TOKEN"));
    add(`${path}:SUPABASE_MANAGEMENT_API_TOKEN`, values.get("SUPABASE_MANAGEMENT_API_TOKEN"));
  }

  if (candidates.length === 0) {
    throw new Error("Missing required env var SUPABASE_ACCESS_TOKEN or SUPABASE_MANAGEMENT_API_TOKEN.");
  }

  const failures = [];
  for (const candidate of candidates) {
    const response = await fetch(SUPABASE_HEALTH_URL, {
      headers: { Authorization: `Bearer ${candidate.token}` },
    });
    if (response.ok) {
      if (candidate.label !== "process.env:SUPABASE_ACCESS_TOKEN" && candidate.label !== ".env:SUPABASE_ACCESS_TOKEN") {
        console.warn(`Using valid Supabase Management API token from ${candidate.label}; earlier candidates were unavailable or invalid.`);
      }
      return candidate.token;
    }
    const text = await response.text();
    failures.push(`${candidate.label}: HTTP ${response.status} ${text.slice(0, 120)}`);
  }

  throw new Error(
    [
      "No valid Supabase Management API token found for live DB incident verification.",
      "Checked SUPABASE_ACCESS_TOKEN and SUPABASE_MANAGEMENT_API_TOKEN from process env, .env, and frontend/.env.local.",
      "Failures:",
      ...failures.map((failure) => `- ${failure}`),
    ].join("\n"),
  );
}

function requireEnv(key) {
  const value = process.env[key];
  if (!value) throw new Error(`Missing required env var ${key}`);
  return value;
}

async function fetchJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return JSON.parse(text);
}

async function fetchJsonWithRetry(url, token, attempts = 3) {
  let lastError;
  for (let index = 0; index < attempts; index += 1) {
    try {
      return await fetchJson(url, token);
    } catch (error) {
      lastError = error;
      await new Promise((resolve) => setTimeout(resolve, 500 * (index + 1)));
    }
  }
  throw lastError;
}

function renderCronSnapshot(name, service) {
  const command = service?.serviceDetails?.envSpecificDetails?.dockerCommand || "";
  const schedule = service?.serviceDetails?.schedule || service?.schedule;
  const structurallyDisabled =
    service?.structurallyDisabled ||
    (
      schedule === DISABLED_CRON_SCHEDULE &&
      command.includes("disabled while DB incident guard is active")
    );
  return {
    name,
    suspended: service?.suspended,
    schedule,
    structurallyDisabled,
  };
}

async function fetchRenderEnvMap(serviceId, token) {
  const rows = await fetchJson(`${RENDER_SERVICE_URL}/${serviceId}/env-vars?limit=100`, token);
  return new Map(
    rows
      .map((row) => row.envVar ?? row)
      .filter((row) => row?.key)
      .map((row) => [row.key, String(row.value ?? "").trim().toLowerCase()]),
  );
}

async function checkRenderCrons(token) {
  const rows = await fetchJson(RENDER_SERVICES_URL, token);
  const cronRowsByName = new Map();
  const cronIdsByName = new Map();
  const failures = [];
  for (const item of rows) {
    const service = item.service ?? item;
    if (service?.type !== "cron_job" || !String(service.name || "").startsWith("alleato-")) {
      continue;
    }
    cronIdsByName.set(service.name, service.id);
    cronRowsByName.set(service.name, renderCronSnapshot(service.name, service));
  }

  for (const name of REQUIRED_SUSPENDED_CRONS) {
    const id = cronIdsByName.get(name);
    if (!id) {
      continue;
    }
    let service;
    try {
      service = await fetchJsonWithRetry(`${RENDER_SERVICE_URL}/${id}`, token);
    } catch (error) {
      failures.push(`${name}=direct_check_failed (${error.message})`);
      continue;
    }
    const snapshot = renderCronSnapshot(name, service);
    cronRowsByName.set(name, snapshot);
    if (snapshot.suspended !== "suspended" && !snapshot.structurallyDisabled) {
      failures.push(`${name}=${snapshot.suspended || "unknown"}`);
    }
  }

  for (const name of SAFE_RESUMED_CRONS) {
    const id = cronIdsByName.get(name);
    if (!id) {
      failures.push(`${name}=missing`);
      continue;
    }
    let service;
    try {
      service = await fetchJsonWithRetry(`${RENDER_SERVICE_URL}/${id}`, token);
    } catch (error) {
      failures.push(`${name}=direct_check_failed (${error.message})`);
      continue;
    }
    const snapshot = renderCronSnapshot(name, service);
    cronRowsByName.set(name, snapshot);
    if (snapshot.suspended !== "not_suspended") {
      failures.push(`${name}=not_resumed (${snapshot.suspended || "unknown"})`);
      continue;
    }
    const expectedEnv = SAFE_RESUMED_CRON_ENV.get(name);
    if (!expectedEnv) {
      continue;
    }
    const env = await fetchRenderEnvMap(id, token);
    for (const [key, expected] of expectedEnv.entries()) {
      const actual = env.get(key) || "<missing>";
      if (actual !== expected) {
        failures.push(`${name}.${key}=${actual}`);
      }
    }
  }

  return { cronRows: [...cronRowsByName.values()], failures };
}

async function checkRenderWebEnv(token) {
  const rows = await fetchJson(RENDER_SERVICES_URL, token);
  const backend = rows
    .map((item) => item.service ?? item)
    .find((service) => service?.type === "web_service" && service.name === "alleato-backend");
  if (!backend?.id) {
    return { rows: [], failures: ["alleato-backend=missing"] };
  }

  const envRows = await fetchJson(`${RENDER_SERVICE_URL}/${backend.id}/env-vars?limit=100`, token);
  const env = new Map(
    envRows
      .map((row) => row.envVar)
      .filter((row) => row?.key)
      .map((row) => [row.key, String(row.value ?? "").trim().toLowerCase()]),
  );

  const rowsToPrint = [];
  const failures = [];
  for (const [key, expected] of REQUIRED_WEB_FLAGS.entries()) {
    const actual = env.get(key) || "<missing>";
    rowsToPrint.push(`${key}=${actual}`);
    if (actual !== expected) {
      failures.push(`${key}=${actual}`);
    }
  }

  return { rows: rowsToPrint, failures };
}

async function checkSupabaseHealth(token) {
  const rows = await fetchJsonWithRetry(SUPABASE_HEALTH_URL, token);
  const failures = rows
    .filter((row) => row.status !== "ACTIVE_HEALTHY" || row.healthy !== true)
    .map((row) => `${row.name}=${row.status}`);
  return { rows, failures };
}

async function checkSupavisorFailures(token, windowMinutes) {
  const end = new Date();
  const start = new Date(end.getTime() - windowMinutes * 60_000);
  const url = new URL(SUPABASE_LOGS_URL);
  url.searchParams.set(
    "sql",
    [
      "select timestamp, event_message",
      "from supavisor_logs",
      "where lower(event_message) like '%maxclients%'",
      "   or lower(event_message) like '%unable to check out connection%'",
      "order by timestamp desc",
      "limit 20",
    ].join(" "),
  );
  url.searchParams.set("iso_timestamp_start", start.toISOString());
  url.searchParams.set("iso_timestamp_end", end.toISOString());
  const body = await fetchJsonWithRetry(url, token);
  if (body.error) {
    throw new Error(`Supabase logs query failed: ${JSON.stringify(body.error)}`);
  }
  const rows = body.result || [];
  return { rows, failures: rows.map((row) => row.event_message) };
}

async function checkConnectionCount(databaseUrl) {
  const normalizedDatabaseUrl = new URL(databaseUrl);
  normalizedDatabaseUrl.searchParams.delete("sslmode");
  const client = new pg.Client({
    connectionString: normalizedDatabaseUrl.toString(),
    connectionTimeoutMillis: 5000,
    application_name: "alleato-live-db-incident-verifier",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const total = await client.query("select count(*)::int as sessions from pg_stat_activity");
    const byApp = await client.query(`
      select
        coalesce(nullif(application_name, ''), '<none>') as application_name,
        coalesce(state, '<none>') as state,
        count(*)::int as sessions
      from pg_stat_activity
      group by 1, 2
      order by sessions desc
      limit 15
    `);
    return { sessions: total.rows[0].sessions, byApp: byApp.rows };
  } finally {
    await client.end();
  }
}

function printSection(title, rows) {
  console.log(`\n== ${title} ==`);
  for (const row of rows) {
    console.log(typeof row === "string" ? row : JSON.stringify(row));
  }
}

loadDotEnv();

const windowMinutes = Number(process.argv.find((arg) => arg.startsWith("--minutes="))?.split("=")[1] || DEFAULT_WINDOW_MINUTES);
const renderToken = requireEnv("RENDER_API_KEY");
const supabaseToken = await resolveSupabaseAccessToken();
const databaseUrl = requireEnv("DATABASE_URL");

const failures = [];

const render = await checkRenderCrons(renderToken);
printSection(
  "Render Cron State",
  render.cronRows.map((row) => {
    const mode = row.structurallyDisabled ? "disabled" : row.suspended;
    return `${mode.padEnd(14)} ${row.name} ${row.schedule || ""}`;
  }),
);
failures.push(...render.failures.map((failure) => `Render cron unsafe: ${failure}`));

const renderWeb = await checkRenderWebEnv(renderToken);
printSection("Render Web Scheduler Flags", renderWeb.rows);
failures.push(...renderWeb.failures.map((failure) => `Render web scheduler flag unsafe: ${failure}`));

const health = await checkSupabaseHealth(supabaseToken);
printSection("Supabase Health", health.rows);
failures.push(...health.failures.map((failure) => `Supabase unhealthy: ${failure}`));

const logs = await checkSupavisorFailures(supabaseToken, windowMinutes);
printSection(`Supavisor Pool Failures Last ${windowMinutes}m`, logs.rows);
failures.push(...logs.failures.map((failure) => `Supavisor failure: ${failure}`));

try {
  const connections = await checkConnectionCount(databaseUrl);
  printSection("Connection Count", [
    `sessions=${connections.sessions}`,
    ...connections.byApp.map((row) => `${String(row.sessions).padStart(3)} ${row.application_name} ${row.state}`),
  ]);
} catch (error) {
  printSection("Connection Count", [`unavailable: ${error.message}`]);
  failures.push(`Connection count unavailable: ${error.message}`);
}

if (failures.length > 0) {
  console.error("\nLive DB incident verifier: FAIL");
  for (const failure of failures) {
    console.error(`- ${failure}`);
  }
  process.exit(1);
}

console.log("\nLive DB incident verifier: PASS");
