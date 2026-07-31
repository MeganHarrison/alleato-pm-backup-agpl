#!/usr/bin/env node

const RENDER_SERVICES_URL = "https://api.render.com/v1/services?limit=100";

const DB_PRESSURE_CRON_NAMES = new Set([
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

function requireRenderToken() {
  const token = process.env.RENDER_API_KEY;
  if (!token) {
    throw new Error("RENDER_API_KEY is required to suspend Render cron jobs");
  }
  return token;
}

async function renderFetch(url, token, init = {}) {
  const response = await fetch(url, {
    ...init,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  if (!response.ok) {
    throw new Error(`${response.status} ${response.statusText}: ${text.slice(0, 300)}`);
  }
  return text ? JSON.parse(text) : null;
}

async function main() {
  const token = requireRenderToken();
  const rows = await renderFetch(RENDER_SERVICES_URL, token);
  const services = rows.map((row) => row.service ?? row);
  const targets = services.filter(
    (service) => service.type === "cron_job" && DB_PRESSURE_CRON_NAMES.has(service.name),
  );

  if (targets.length === 0) {
    throw new Error("No DB-pressure Render cron jobs found");
  }

  for (const service of targets) {
    if (service.suspended === "suspended") {
      console.log(`already_suspended|${service.name}|${service.id}`);
      continue;
    }

    await renderFetch(`https://api.render.com/v1/services/${service.id}/suspend`, token, {
      method: "POST",
    });
    console.log(`suspended|${service.name}|${service.id}`);
  }
}

main().catch((error) => {
  console.error(`suspend-render-db-pressure-crons failed: ${error.message}`);
  process.exit(1);
});
