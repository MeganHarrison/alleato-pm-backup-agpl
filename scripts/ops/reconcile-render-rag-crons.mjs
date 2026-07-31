#!/usr/bin/env node

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";
import yaml from "js-yaml";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const renderApi = "https://api.render.com/v1";
const confirmation = "RESUME_RAG_PIPELINE";

const groups = Object.freeze({
  source: [
    "alleato-fireflies-sync",
    "alleato-graph-sync",
    "alleato-teams-channel-sync",
    "alleato-teams-dm-sync",
    "alleato-graph-subscription-reconcile",
    "alleato-graph-webhook-drain",
  ],
  health: [
    "alleato-source-sync-health",
    "alleato-rag-health",
    "alleato-ai-provider-health",
    "alleato-source-rag-health",
    "alleato-pipeline-alert",
  ],
  intelligence: [
    "alleato-domain-packet-compiler",
    "alleato-project-synthesis-sweep",
  ],
});

const maximumSuccessfulRunAgeHours = Object.freeze({
  "alleato-fireflies-sync": 3,
  "alleato-graph-sync": 5,
  "alleato-teams-channel-sync": 3,
  "alleato-teams-dm-sync": 3,
  "alleato-graph-subscription-reconcile": 8,
  "alleato-graph-webhook-drain": 1,
  "alleato-source-sync-health": 2,
  "alleato-rag-health": 36,
  "alleato-ai-provider-health": 3,
  "alleato-source-rag-health": 1,
  "alleato-pipeline-alert": 2,
  "alleato-domain-packet-compiler": 12,
  "alleato-project-synthesis-sweep": 36,
});

const optionalSecretKeys = new Set([
  "OPENAI_API_KEY",
  "SLACK_WEBHOOK_URL",
]);

function unwrap(value) {
  return value?.service ?? value?.envVar ?? value?.job ?? value;
}

function normalizedCommand(service) {
  return String(
    service?.serviceDetails?.envSpecificDetails?.dockerCommand ??
      service?.serviceDetails?.dockerCommand ??
      "",
  )
    .trim()
    .replace(/\s+/g, " ");
}

function expectedCommand(service) {
  return String(service?.dockerCommand ?? "")
    .trim()
    .replace(/\s+/g, " ");
}

function requiredSecretKeys(service) {
  const keys = (service.envVars ?? [])
    .filter(
      (entry) =>
        entry?.sync === false &&
        typeof entry.key === "string" &&
        !optionalSecretKeys.has(entry.key),
    )
    .map((entry) => entry.key);
  if (
    service.name === "alleato-ai-provider-health" &&
    !keys.includes("AI_GATEWAY_API_KEY")
  ) {
    keys.push("AI_GATEWAY_API_KEY");
  }
  return keys;
}

export function loadExpectedRenderRagCronContracts(
  manifestPath = path.join(repoRoot, "render.yaml"),
) {
  const manifest = yaml.load(fs.readFileSync(manifestPath, "utf8"));
  const services = Array.isArray(manifest?.services) ? manifest.services : [];
  const expectedNames = new Set(Object.values(groups).flat());
  const contracts = services
    .filter(
      (service) =>
        service?.type === "cron" && expectedNames.has(service?.name),
    )
    .map((service) => ({
      name: service.name,
      schedule: String(service.schedule ?? ""),
      command: expectedCommand(service),
      requiredSecretKeys: requiredSecretKeys(service),
    }));

  const found = new Set(contracts.map((contract) => contract.name));
  const missing = [...expectedNames].filter((name) => !found.has(name));
  if (missing.length > 0) {
    throw new Error(
      `render.yaml is missing canonical RAG cron owners: ${missing.join(", ")}`,
    );
  }
  return contracts;
}

function namesForGroup(group) {
  if (group === "all") return [...new Set(Object.values(groups).flat())];
  if (!Object.hasOwn(groups, group)) {
    throw new Error(
      `Unknown cron group "${group}". Use source, health, intelligence, or all.`,
    );
  }
  return [...groups[group]];
}

async function renderRequest(token, endpoint, init = {}) {
  const response = await fetch(`${renderApi}${endpoint}`, {
    ...init,
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
      ...(init.body ? { "content-type": "application/json" } : {}),
      ...(init.headers ?? {}),
    },
  });
  const text = await response.text();
  let payload = null;
  if (text) {
    try {
      payload = JSON.parse(text);
    } catch {
      payload = text.slice(0, 300);
    }
  }
  if (!response.ok) {
    throw new Error(
      `Render ${init.method ?? "GET"} ${endpoint} failed with HTTP ${response.status}: ${
        typeof payload === "string" ? payload : JSON.stringify(payload)
      }`,
    );
  }
  return payload;
}

async function listServices(token) {
  const rows = await renderRequest(token, "/services?limit=100");
  return (Array.isArray(rows) ? rows : []).map(unwrap).filter(Boolean);
}

async function loadEnvironment(token, serviceId) {
  const rows = await renderRequest(
    token,
    `/services/${serviceId}/env-vars?limit=100`,
  );
  return new Map(
    (Array.isArray(rows) ? rows : [])
      .map(unwrap)
      .filter((entry) => typeof entry?.key === "string")
      .map((entry) => [entry.key, String(entry.value ?? "")]),
  );
}

async function loadJobs(token, serviceId) {
  const rows = await renderRequest(
    token,
    `/services/${serviceId}/jobs?limit=20`,
  );
  return (Array.isArray(rows) ? rows : []).map(unwrap).filter(Boolean);
}

async function loadDeploys(token, serviceId) {
  const rows = await renderRequest(
    token,
    `/services/${serviceId}/deploys?limit=20`,
  );
  return (Array.isArray(rows) ? rows : []).map(unwrap).filter(Boolean);
}

function latestSuccessfulJob(jobs) {
  return jobs.find((job) => job.status === "succeeded") ?? null;
}

function ageHours(value) {
  const timestamp = Date.parse(String(value ?? ""));
  if (!Number.isFinite(timestamp)) return null;
  return Math.max(0, (Date.now() - timestamp) / 3_600_000);
}

export async function auditRenderRagCrons({
  token,
  group = "all",
  requireRecentSuccess = true,
  allowSuspended = false,
} = {}) {
  if (!token) {
    throw new Error(
      "RENDER_API_KEY is required for live Render RAG cron verification.",
    );
  }

  const selectedNames = namesForGroup(group);
  const contracts = new Map(
    loadExpectedRenderRagCronContracts()
      .filter((contract) => selectedNames.includes(contract.name))
      .map((contract) => [contract.name, contract]),
  );
  const services = await listServices(token);
  const serviceByName = new Map(
    services
      .filter((service) => service?.type === "cron_job")
      .map((service) => [service.name, service]),
  );
  const results = [];

  for (const name of selectedNames) {
    const contract = contracts.get(name);
    const summary = serviceByName.get(name);
    const failures = [];
    if (!summary?.id) {
      results.push({
        name,
        ok: false,
        failures: ["service is missing from live Render"],
      });
      continue;
    }

    const detailPayload = await renderRequest(
      token,
      `/services/${summary.id}`,
    );
    const service = unwrap(detailPayload);
    const environment = await loadEnvironment(token, summary.id);
    const jobs = await loadJobs(token, summary.id);
    const latestSuccess = latestSuccessfulJob(jobs);
    const lastSuccessfulRunAt =
      latestSuccess?.finishedAt ??
      latestSuccess?.startedAt ??
      latestSuccess?.createdAt ??
      service?.serviceDetails?.lastSuccessfulRunAt ??
      service?.lastSuccessfulRunAt ??
      null;
    const runAgeHours = ageHours(lastSuccessfulRunAt);

    if (service.type !== "cron_job") {
      failures.push(`expected cron_job, found ${service.type ?? "<missing>"}`);
    }
    if (!allowSuspended && service.suspended !== "not_suspended") {
      failures.push(`service is ${service.suspended ?? "suspended/unknown"}`);
    }
    const liveSchedule = String(
      service?.serviceDetails?.schedule ?? service?.schedule ?? "",
    );
    if (liveSchedule !== contract.schedule) {
      failures.push(
        `schedule drift: expected ${contract.schedule}, found ${
          liveSchedule || "<missing>"
        }`,
      );
    }
    if (normalizedCommand(service) !== contract.command) {
      failures.push("docker command differs from render.yaml");
    }
    for (const key of contract.requiredSecretKeys) {
      if (!environment.has(key) || !environment.get(key)?.trim()) {
        failures.push(`required environment key ${key} is missing`);
      }
    }
    if (
      ["source", "health", "intelligence"].some((candidate) =>
        groups[candidate].includes(name),
      ) &&
      environment.get("APP_DB_PRESSURE_GUARD_REQUIRED") !== "true"
    ) {
      failures.push(
        "APP_DB_PRESSURE_GUARD_REQUIRED must be true before this cron is active",
      );
    }
    const maximumAge = maximumSuccessfulRunAgeHours[name];
    if (requireRecentSuccess) {
      if (runAgeHours === null) {
        failures.push("no successful Render run is recorded");
      } else if (runAgeHours > maximumAge) {
        failures.push(
          `last successful run is ${runAgeHours.toFixed(
            1,
          )}h old; maximum is ${maximumAge}h`,
        );
      }
    }

    results.push({
      id: summary.id,
      name,
      ok: failures.length === 0,
      suspended: service.suspended ?? null,
      schedule: liveSchedule || null,
      lastSuccessfulRunAt,
      runAgeHours:
        runAgeHours === null ? null : Number(runAgeHours.toFixed(2)),
      requiredEnvironmentKeysPresent:
        contract.requiredSecretKeys.length -
        failures.filter((failure) =>
          failure.startsWith("required environment key"),
        ).length,
      requiredEnvironmentKeyCount: contract.requiredSecretKeys.length,
      failures,
    });
  }

  return {
    ok: results.every((result) => result.ok),
    group,
    generatedAt: new Date().toISOString(),
    results,
  };
}

async function setPressureGuard(token, serviceId) {
  await renderRequest(
    token,
    `/services/${serviceId}/env-vars/APP_DB_PRESSURE_GUARD_REQUIRED`,
    {
      method: "PUT",
      body: JSON.stringify({ value: "true" }),
    },
  );
  const environment = await loadEnvironment(token, serviceId);
  if (environment.get("APP_DB_PRESSURE_GUARD_REQUIRED") !== "true") {
    throw new Error(
      `Render did not persist APP_DB_PRESSURE_GUARD_REQUIRED=true for ${serviceId}.`,
    );
  }
}

async function setIndividualEnvironmentValue(
  token,
  serviceId,
  key,
  value,
) {
  await renderRequest(
    token,
    `/services/${serviceId}/env-vars/${encodeURIComponent(key)}`,
    {
      method: "PUT",
      body: JSON.stringify({ value }),
    },
  );
  const environment = await loadEnvironment(token, serviceId);
  if (environment.get(key) !== value) {
    throw new Error(
      `Render did not persist ${key} for ${serviceId}.`,
    );
  }
}

async function waitForDeploy(token, serviceId, startedAfterMs) {
  const timeoutMs = Number(
    process.env.RENDER_RAG_DEPLOY_TIMEOUT_MS ?? 45 * 60_000,
  );
  const pollMs = Number(
    process.env.RENDER_RAG_DEPLOY_POLL_INTERVAL_MS ?? 15_000,
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const deploys = await loadDeploys(token, serviceId);
    const candidate = deploys.find((deploy) => {
      const created = Date.parse(
        String(deploy.createdAt ?? deploy.startedAt ?? deploy.finishedAt ?? ""),
      );
      return Number.isFinite(created) && created >= startedAfterMs - 5_000;
    });
    if (candidate?.status === "live") return candidate;
    if (
      candidate &&
      ["build_failed", "canceled", "cancelled", "deactivated"].includes(
        candidate.status,
      )
    ) {
      throw new Error(
        `Render deploy ${candidate.id ?? "<unknown>"} ended ${candidate.status}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(`Timed out waiting for a Render deploy for ${serviceId}.`);
}

async function waitForTriggeredJob(token, serviceId, triggeredAfterMs) {
  const timeoutMs = Number(
    process.env.RENDER_RAG_CRON_RUN_TIMEOUT_MS ?? 30 * 60_000,
  );
  const pollMs = Number(
    process.env.RENDER_RAG_CRON_POLL_INTERVAL_MS ?? 15_000,
  );
  const deadline = Date.now() + timeoutMs;
  while (Date.now() < deadline) {
    const jobs = await loadJobs(token, serviceId);
    const candidate = jobs.find((job) => {
      const created = Date.parse(
        String(job.createdAt ?? job.startedAt ?? job.finishedAt ?? ""),
      );
      return Number.isFinite(created) && created >= triggeredAfterMs - 5_000;
    });
    if (candidate?.status === "succeeded") return candidate;
    if (
      candidate &&
      ["failed", "canceled", "cancelled"].includes(candidate.status)
    ) {
      throw new Error(
        `Triggered Render job ${candidate.id ?? "<unknown>"} ended ${candidate.status}.`,
      );
    }
    await new Promise((resolve) => setTimeout(resolve, pollMs));
  }
  throw new Error(
    `Timed out waiting for a terminal Render cron run for ${serviceId}.`,
  );
}

export async function reconcileRenderRagCrons({
  token,
  group = "source",
  runNow = false,
} = {}) {
  const preflight = await auditRenderRagCrons({
    token,
    group,
    requireRecentSuccess: false,
    allowSuspended: true,
  });
  const unrecoverable = preflight.results.filter((result) =>
    result.failures.some(
      (failure) =>
        failure.includes("missing from live Render") ||
        failure.includes("schedule drift") ||
        failure.includes("docker command differs") ||
        (failure.includes("required environment key") &&
          !failure.includes("AI_GATEWAY_API_KEY")),
    ),
  );
  if (unrecoverable.length > 0) {
    throw new Error(
      `Render RAG cron preflight failed: ${unrecoverable
        .map((result) => `${result.name}: ${result.failures.join("; ")}`)
        .join(" | ")}`,
    );
  }

  const services = await listServices(token);
  const backend = services.find(
    (service) =>
      service?.type === "web_service" &&
      service?.name === "alleato-backend",
  );
  if (!backend?.id) {
    throw new Error(
      "Live Render backend service alleato-backend is missing; cannot source the canonical AI Gateway credential.",
    );
  }
  const backendEnvironment = await loadEnvironment(token, backend.id);
  const gatewayKey = backendEnvironment.get("AI_GATEWAY_API_KEY")?.trim();
  if (!gatewayKey) {
    throw new Error(
      "Live Render backend has no AI_GATEWAY_API_KEY to copy to RAG cron owners.",
    );
  }

  const actions = [];
  for (const service of preflight.results) {
    const environment = await loadEnvironment(token, service.id);
    let environmentChanged = false;
    if (environment.get("APP_DB_PRESSURE_GUARD_REQUIRED") !== "true") {
      await setPressureGuard(token, service.id);
      environmentChanged = true;
      actions.push({ action: "pressure_guard_enabled", name: service.name });
    }
    if (
      service.failures.some((failure) =>
        failure.includes("AI_GATEWAY_API_KEY"),
      )
    ) {
      await setIndividualEnvironmentValue(
        token,
        service.id,
        "AI_GATEWAY_API_KEY",
        gatewayKey,
      );
      environmentChanged = true;
      actions.push({ action: "gateway_key_reconciled", name: service.name });
    }

    const deployStartedAt = Date.now();
    if (service.suspended !== "not_suspended") {
      await renderRequest(token, `/services/${service.id}/resume`, {
        method: "POST",
      });
      actions.push({ action: "resumed", name: service.name });
    } else {
      actions.push({ action: "already_active", name: service.name });
    }
    if (environmentChanged) {
      await renderRequest(token, `/services/${service.id}/deploy`, {
        method: "POST",
      });
      const deploy = await waitForDeploy(
        token,
        service.id,
        deployStartedAt,
      );
      actions.push({
        action: "deploy_live",
        name: service.name,
        deployId: deploy.id ?? null,
      });
    }

    if (runNow) {
      const triggeredAfterMs = Date.now();
      await renderRequest(token, `/cron-jobs/${service.id}/runs`, {
        method: "POST",
      });
      const job = await waitForTriggeredJob(
        token,
        service.id,
        triggeredAfterMs,
      );
      actions.push({
        action: "run_succeeded",
        name: service.name,
        jobId: job.id ?? null,
        finishedAt: job.finishedAt ?? null,
      });
    }
  }

  const audit = await auditRenderRagCrons({
    token,
    group,
    requireRecentSuccess: runNow,
  });
  return { ok: audit.ok, group, runNow, actions, audit };
}

function parseArgs(argv) {
  const options = {
    action: "audit",
    group: "all",
    confirm: "",
  };
  for (const arg of argv) {
    if (arg.startsWith("--action=")) options.action = arg.split("=")[1];
    else if (arg.startsWith("--group=")) options.group = arg.split("=")[1];
    else if (arg.startsWith("--confirm=")) options.confirm = arg.split("=")[1];
    else throw new Error(`Unknown argument: ${arg}`);
  }
  return options;
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  const token = process.env.RENDER_API_KEY?.trim();
  let report;
  if (options.action === "audit") {
    report = await auditRenderRagCrons({
      token,
      group: options.group,
    });
  } else if (
    options.action === "reconcile" ||
    options.action === "reconcile-and-run"
  ) {
    if (options.confirm !== confirmation) {
      throw new Error(
        `Mutating actions require --confirm=${confirmation}.`,
      );
    }
    report = await reconcileRenderRagCrons({
      token,
      group: options.group,
      runNow: options.action === "reconcile-and-run",
    });
  } else {
    throw new Error(
      `Unknown action "${options.action}". Use audit, reconcile, or reconcile-and-run.`,
    );
  }

  console.log(JSON.stringify(report, null, 2));
  if (!report.ok) process.exitCode = 1;
}

const invokedDirectly =
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  main().catch((error) => {
    console.error(`Render RAG cron reconciliation failed: ${error.message}`);
    process.exitCode = 1;
  });
}
