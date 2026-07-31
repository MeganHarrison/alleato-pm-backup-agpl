#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";

import yaml from "js-yaml";

const SERVICE_NAME = "alleato-acumatica-financial-sync";
const RENDER_SERVICES_URL = "https://api.render.com/v1/services?limit=100";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";

function loadDotEnv() {
  const envPath = path.resolve(".env");
  if (!fs.existsSync(envPath)) return;
  for (const line of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    if (!line || line.trim().startsWith("#")) continue;
    const index = line.indexOf("=");
    if (index === -1) continue;
    const key = line.slice(0, index).trim();
    const value = line.slice(index + 1).trim().replace(/^['"]|['"]$/g, "");
    if (key && process.env[key] === undefined) process.env[key] = value;
  }
}

async function fetchRenderJson(url, token) {
  const response = await fetch(url, {
    headers: { Authorization: `Bearer ${token}` },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${url} failed: ${response.status} ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

function verifySourceContract(failures) {
  const blueprint = yaml.load(fs.readFileSync("render.yaml", "utf8"));
  const services = Array.isArray(blueprint?.services) ? blueprint.services : [];
  const acumaticaCron = services.find((service) => service?.name === SERVICE_NAME);
  const backend = services.find(
    (service) => service?.type === "web" && service?.name === "alleato-backend",
  );

  if (acumaticaCron) {
    failures.push(`render.yaml still declares automatic cron ${SERVICE_NAME}`);
  }
  if (!backend) {
    failures.push("render.yaml is missing the alleato-backend web service");
  } else {
    const env = new Map(
      (backend.envVars ?? []).map((entry) => [
        entry.key,
        String(entry.value ?? "").trim().toLowerCase(),
      ]),
    );
    if (env.get("ACUMATICA_FINANCIAL_SYNC_ENABLED") !== "false") {
      failures.push(
        "alleato-backend must set ACUMATICA_FINANCIAL_SYNC_ENABLED=false",
      );
    }
  }

  const schedulerSource = fs.readFileSync(
    "backend/src/services/scheduler.py",
    "utf8",
  );
  if (
    schedulerSource.includes("run_acumatica_financial_sync_job") ||
    schedulerSource.includes('id="acumatica_financial_sync"')
  ) {
    failures.push("backend scheduler still contains an Acumatica job owner");
  }
}

async function verifyLiveRenderContract(failures) {
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    return {
      checked: false,
      detail:
        "RENDER_API_KEY is unavailable; live suspension must be verified separately.",
    };
  }

  const rows = await fetchRenderJson(RENDER_SERVICES_URL, token);
  const summary = rows
    .map((row) => row.service ?? row)
    .find((service) => service?.name === SERVICE_NAME);

  if (!summary) {
    return { checked: true, detail: `${SERVICE_NAME} is absent from Render` };
  }

  const service = await fetchRenderJson(
    `${RENDER_SERVICE_URL}/${summary.id}`,
    token,
  );
  if (service.suspended !== "suspended") {
    failures.push(
      `live Render cron ${SERVICE_NAME} must be suspended; found ${service.suspended || "<unknown>"}`,
    );
  }
  return {
    checked: true,
    detail: `${SERVICE_NAME} state=${service.suspended || "<unknown>"}`,
  };
}

loadDotEnv();

const failures = [];
verifySourceContract(failures);
const live = await verifyLiveRenderContract(failures);

console.log(`Source contract: ${failures.length === 0 ? "manual-only" : "invalid"}`);
console.log(`Live Render: ${live.checked ? live.detail : `NOT CHECKED — ${live.detail}`}`);

if (failures.length > 0) {
  console.error("Acumatica automatic sync guard: FAIL");
  for (const failure of failures) console.error(`- ${failure}`);
  process.exit(1);
}

console.log(
  `Acumatica automatic sync guard: ${live.checked ? "PASS" : "SOURCE PASS / LIVE BLOCKED"}`,
);
