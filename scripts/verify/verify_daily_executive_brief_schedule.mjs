#!/usr/bin/env node

import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import path from "node:path";

import dotenv from "dotenv";
import pg from "pg";

import {
  buildAppDatabaseConnectionString,
  getAppDatabaseUrl,
} from "./app-db-connection.mjs";

const repoRoot = path.resolve(import.meta.dirname, "..", "..");
const renderYaml = readFileSync(path.join(repoRoot, "render.yaml"), "utf8");
dotenv.config({ path: path.join(repoRoot, ".env"), quiet: true });

const SERVICE_NAME = "alleato-daily-executive-brief-0600-et";
const EXPECTED_REPO = "https://github.com/The-Alleato-Group/project-management";
const EXPECTED_SCHEDULE = "*/15 10-13 * * 1-5";
const EXPECTED_DOCKERFILE = "./backend/Dockerfile.executive-brief";

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function valueArg(name) {
  const index = process.argv.indexOf(name);
  return index >= 0 ? process.argv[index + 1] ?? null : null;
}

function verifyRepositoryContract() {
  const required = [
    `name: ${SERVICE_NAME}`,
    `schedule: "${EXPECTED_SCHEDULE}"`,
    `dockerfilePath: ${EXPECTED_DOCKERFILE}`,
    "value: America/New_York",
    'value: "06:00"',
    'value: "1,2,3,4,5"',
  ];
  for (const marker of required) {
    assert(renderYaml.includes(marker), `render.yaml is missing Daily Brief contract: ${marker}`);
  }
  assert(
    !renderYaml.includes("name: alleato-executive-daily-brief-evening"),
    "render.yaml must not restore the retired evening Executive Daily Brief cron.",
  );
}

function loadRenderServices() {
  const result = spawnSync("render", ["services", "--output", "json"], {
    cwd: repoRoot,
    encoding: "utf8",
    timeout: 30_000,
    maxBuffer: 20 * 1024 * 1024,
  });
  if (result.error) throw new Error(`Render CLI failed to start: ${result.error.message}`);
  if (result.status !== 0) {
    throw new Error(`Render CLI failed (${result.status}): ${result.stderr.slice(0, 1000)}`);
  }
  return JSON.parse(result.stdout);
}

function verifyLiveRender(services) {
  const entry = services.find(({ service }) => service?.name === SERVICE_NAME);
  assert(entry, `Live Render cron '${SERVICE_NAME}' is missing.`);
  const service = entry.service;
  const details = service.serviceDetails ?? {};
  const docker = details.envSpecificDetails ?? {};
  assert(service.type === "cron_job", `${SERVICE_NAME} is not a cron job.`);
  assert(service.suspended === "not_suspended", `${SERVICE_NAME} is suspended.`);
  assert(service.repo === EXPECTED_REPO, `${SERVICE_NAME} repo drift: ${service.repo}`);
  assert(service.branch === "main", `${SERVICE_NAME} branch drift: ${service.branch}`);
  assert(service.autoDeploy === "yes", `${SERVICE_NAME} auto-deploy is not enabled.`);
  assert(details.schedule === EXPECTED_SCHEDULE, `${SERVICE_NAME} schedule drift: ${details.schedule}`);
  assert(
    docker.dockerfilePath === EXPECTED_DOCKERFILE,
    `${SERVICE_NAME} Dockerfile drift: ${docker.dockerfilePath}`,
  );

  const oldEvening = services.find(
    ({ service: candidate }) => candidate?.id === "crn-d827cijbc2fs73c3uqsg",
  )?.service;
  assert(
    !oldEvening || oldEvening.suspended === "suspended",
    "Retired evening Executive Daily Brief cron must remain suspended.",
  );
  return {
    id: service.id,
    name: service.name,
    schedule: details.schedule,
    suspended: service.suspended,
    repo: service.repo,
    branch: service.branch,
    lastSuccessfulRunAt: details.lastSuccessfulRunAt ?? null,
  };
}

async function loadLatestPacket() {
  const rawUrl = getAppDatabaseUrl();
  assert(rawUrl, "Application database URL is unavailable for packet-ledger verification.");
  const client = new pg.Client({
    connectionString: await buildAppDatabaseConnectionString(rawUrl, { includeSslMode: false }),
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  try {
    const result = await client.query(
      `
        select p.id, p.packet_type, p.generated_at,
               p.packet_json->>'businessDate' as business_date,
               p.compiler_version
        from public.intelligence_packets p
        join public.intelligence_targets t on t.id = p.target_id
        where t.slug = 'daily-executive-brief'
        order by p.generated_at desc nulls last
        limit 1
      `,
    );
    return result.rows[0] ?? null;
  } finally {
    await client.end();
  }
}

async function main() {
  verifyRepositoryContract();
  const liveRender = verifyLiveRender(loadRenderServices());
  const latestPacket = await loadLatestPacket();
  assert(latestPacket, "Canonical Daily Executive Brief packet ledger is empty.");
  assert(latestPacket.packet_type === "current", "Latest Daily Brief packet is not current.");
  assert(
    latestPacket.compiler_version === "manual_daily_executive_brief_v1",
    `Latest Daily Brief compiler drift: ${latestPacket.compiler_version}`,
  );
  const expectedBusinessDate = valueArg("--expect-business-date");
  if (expectedBusinessDate) {
    assert(
      latestPacket.business_date === expectedBusinessDate,
      `Expected business date ${expectedBusinessDate}, found ${latestPacket.business_date}.`,
    );
  }
  console.log(
    JSON.stringify(
      { status: "PASS", repositoryContract: "pass", liveRender, latestPacket },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(`[verify-executive-daily-brief-schedule] ${error.message}`);
  process.exit(1);
});
