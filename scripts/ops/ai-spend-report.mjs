#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");

function loadEnv(relativePath) {
  const filePath = path.isAbsolute(relativePath)
    ? relativePath
    : path.join(repoRoot, relativePath);
  if (!fs.existsSync(filePath)) return;
  for (const line of fs.readFileSync(filePath, "utf8").split(/\r?\n/)) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) continue;
    const index = trimmed.indexOf("=");
    const key = trimmed.slice(0, index).trim();
    let value = trimmed.slice(index + 1).trim();
    if (/^(['"]).*\1$/.test(value)) value = value.slice(1, -1);
    if (!process.env[key]) process.env[key] = value;
  }
}

loadEnv(".env");
loadEnv("frontend/.env");
loadEnv("frontend/.env.local");
if (process.env.ALLEATO_ENV_FILE) loadEnv(process.env.ALLEATO_ENV_FILE);

const daysArg = process.argv.find((value) => value.startsWith("--days="));
const days = Math.max(1, Number(daysArg?.split("=")[1] || 7));
const asJson = process.argv.includes("--json");
const strictCoverage = process.argv.includes("--strict-coverage");
const registry = JSON.parse(
  fs.readFileSync(path.join(repoRoot, "config/ai-runtime-owners.json"), "utf8"),
);
const supabaseUrl = process.env.RAG_SUPABASE_URL;
const serviceKey = process.env.RAG_SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceKey) {
  throw new Error("RAG_SUPABASE_URL and RAG_SUPABASE_SERVICE_ROLE_KEY are required");
}
const startDate = new Date();
startDate.setUTCDate(startDate.getUTCDate() - (days - 1));
const start = startDate.toISOString().slice(0, 10);
const sourceRows = [];
for (let offset = 0; ; offset += 1000) {
  const endpoint = new URL(`${supabaseUrl}/rest/v1/pipeline_model_usage`);
  endpoint.searchParams.set(
    "select",
    "usage_date,provider,model,operation,total_tokens,estimated_cost_usd",
  );
  endpoint.searchParams.set("usage_date", `gte.${start}`);
  endpoint.searchParams.set("order", "usage_date.desc");
  const response = await fetch(endpoint, {
    headers: {
      apikey: serviceKey,
      Authorization: `Bearer ${serviceKey}`,
      Range: `${offset}-${offset + 999}`,
    },
  });
  if (!response.ok) {
    throw new Error(`pipeline_model_usage read failed: ${response.status}`);
  }
  const page = await response.json();
  sourceRows.push(...page);
  if (page.length < 1000) break;
}
const aggregated = new Map();
for (const row of sourceRows) {
  const key = [row.usage_date, row.provider, row.model, row.operation].join("\u0000");
  const current = aggregated.get(key) || {
    usage_date: row.usage_date,
    provider: row.provider,
    model: row.model,
    operation: row.operation,
    calls: 0,
    tokens: 0,
    estimated_cost_usd: 0,
  };
  current.calls += 1;
  current.tokens += Number(row.total_tokens || 0);
  current.estimated_cost_usd += Number(row.estimated_cost_usd || 0);
  aggregated.set(key, current);
}
const rows = [...aggregated.values()]
  .map((row) => ({
    ...row,
    estimated_cost_usd: row.estimated_cost_usd.toFixed(6),
  }))
  .sort(
    (a, b) =>
      b.usage_date.localeCompare(a.usage_date) ||
      Number(b.estimated_cost_usd) - Number(a.estimated_cost_usd),
  );

const coverage = registry.callsite_groups.map((group) => ({
  id: group.id,
  runtime: group.runtime,
  tracking_status: group.tracking_status,
  budget_status: group.budget_status,
  deployment_state: group.deployment_state,
}));
const incomplete = coverage.filter(
  (group) =>
    group.deployment_state === "active" &&
    group.tracking_status !== "ledgered",
);
const total = rows.reduce(
  (sum, row) => sum + Number(row.estimated_cost_usd || 0),
  0,
);
const report = {
  generated_at: new Date().toISOString(),
  days,
  tracked_estimated_cost_usd: Number(total.toFixed(6)),
  authoritative_provider_total: null,
  warning:
    "Tracked estimate is not total provider spend. Reconcile against OpenAI and Gateway billing.",
  rows,
  coverage,
  active_coverage_gaps: incomplete,
};

if (asJson) {
  console.log(JSON.stringify(report, null, 2));
} else {
  console.log(`Tracked AI estimate (${days}d): $${report.tracked_estimated_cost_usd.toFixed(6)}`);
  console.log(report.warning);
  console.log("");
  console.log("Date       Provider         Model                     Operation                         Calls       Est. USD");
  for (const row of rows) {
    console.log(
      `${row.usage_date.padEnd(10)} ${String(row.provider).padEnd(16)} ${String(row.model).padEnd(25)} ${String(row.operation).padEnd(33)} ${String(row.calls).padStart(6)} ${String(row.estimated_cost_usd).padStart(14)}`,
    );
  }
  console.log("");
  console.log(`Active coverage gaps: ${incomplete.length}`);
  for (const gap of incomplete) {
    console.log(`- ${gap.id}: ${gap.tracking_status}, budget=${gap.budget_status}`);
  }
}
if (strictCoverage && incomplete.length) process.exit(1);
