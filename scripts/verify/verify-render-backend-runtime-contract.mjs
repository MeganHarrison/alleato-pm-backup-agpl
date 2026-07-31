#!/usr/bin/env node
import fs from "node:fs";
import path from "node:path";

const MANIFEST_PATH = "render.yaml";
const ACTIVE_BACKEND_HOST = "alleato-backend-rbnj.onrender.com";
const RENDER_SERVICE_URL = "https://api.render.com/v1/services";
const RENDER_SERVICE_ID = process.env.RENDER_BACKEND_SERVICE_ID || "srv-d8271ohj2pic739klb7g";
const SHORT_TIMEOUT_MS = Number(process.env.RENDER_BACKEND_RUNTIME_VERIFY_TIMEOUT_MS || 30000);
const REQUIRE_LIVE_READBACK =
  process.env.RENDER_ENV_STRICT === "true" ||
  process.env.REQUIRE_RENDER_PROVIDER_READBACK === "true" ||
  process.env.RENDER_BACKEND_RUNTIME_STRICT === "true";

const failures = [];
const warnings = [];

function fail(message) {
  failures.push(message);
}

function warn(message) {
  warnings.push(message);
}

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

function normalizeValue(value) {
  if (typeof value === "boolean") return String(value);
  return String(value ?? "").trim();
}

function stripDotPrefix(value) {
  return String(value ?? "").replace(/^[.][/\\]?/, "");
}

function normalizeRepoPath(...parts) {
  const filtered = parts
    .flat()
    .map((part) => stripDotPrefix(part))
    .filter(Boolean);
  return path.posix.normalize(filtered.join("/")).replace(/^\/+/, "");
}

function getManifestContract() {
  const lines = fs.readFileSync(MANIFEST_PATH, "utf8").split(/\r?\n/);
  let inServices = false;
  let block = null;
  let inEnvVars = false;

  for (const line of lines) {
    const indent = line.match(/^ */)?.[0].length ?? 0;
    const trimmed = line.trim();

    if (!inServices) {
      if (trimmed === "services:") {
        inServices = true;
      }
      continue;
    }

    if (indent === 2 && trimmed.startsWith("- type:")) {
      if (block?.name === "alleato-backend") {
        break;
      }
      block = {
        type: trimmed.slice("- type:".length).trim(),
        name: "",
        runtime: "",
        rootDir: "",
        dockerfilePath: "",
        dockerContext: "",
        healthCheckPath: "",
      };
      inEnvVars = false;
      continue;
    }

    if (!block) {
      continue;
    }

    if (indent <= 2 && trimmed && !trimmed.startsWith("-")) {
      if (block.name === "alleato-backend") {
        break;
      }
      continue;
    }

    if (trimmed === "envVars:") {
      inEnvVars = true;
      continue;
    }

    if (inEnvVars && indent <= 4 && trimmed) {
      inEnvVars = false;
    }

    if (inEnvVars) {
      continue;
    }

    if (indent === 4) {
      if (trimmed.startsWith("name:")) block.name = trimmed.slice("name:".length).trim();
      if (trimmed.startsWith("runtime:")) block.runtime = trimmed.slice("runtime:".length).trim();
      if (trimmed.startsWith("rootDir:")) block.rootDir = trimmed.slice("rootDir:".length).trim();
      if (trimmed.startsWith("dockerfilePath:")) {
        block.dockerfilePath = trimmed.slice("dockerfilePath:".length).trim();
      }
      if (trimmed.startsWith("dockerContext:")) block.dockerContext = trimmed.slice("dockerContext:".length).trim();
      if (trimmed.startsWith("healthCheckPath:")) {
        block.healthCheckPath = trimmed.slice("healthCheckPath:".length).trim();
      }
    }
  }

  if (!block || block.name !== "alleato-backend" || block.type !== "web") {
    fail(`${MANIFEST_PATH}: missing web service named alleato-backend`);
    return null;
  }

  return {
    runtime: normalizeValue(block.runtime).toLowerCase(),
    effectiveRootDir: normalizeRepoPath(block.rootDir),
    effectiveDockerContext: normalizeRepoPath(block.rootDir, block.dockerContext),
    effectiveDockerfile: normalizeRepoPath(block.rootDir, block.dockerfilePath),
    healthCheckPath: normalizeValue(block.healthCheckPath),
  };
}

function verifyManifestContract(contract) {
  if (!contract) return;

  if (contract.runtime !== "docker") {
    fail(`${MANIFEST_PATH}: alleato-backend runtime must be docker; found ${contract.runtime || "<missing>"}`);
  }
  if (contract.effectiveDockerContext !== "backend") {
    fail(
      `${MANIFEST_PATH}: alleato-backend effective docker context must resolve to backend; found ${contract.effectiveDockerContext || "<missing>"}`,
    );
  }
  if (contract.effectiveDockerfile !== "backend/Dockerfile") {
    fail(
      `${MANIFEST_PATH}: alleato-backend effective dockerfile must resolve to backend/Dockerfile; found ${contract.effectiveDockerfile || "<missing>"}`,
    );
  }
  if (contract.healthCheckPath !== "/health") {
    fail(
      `${MANIFEST_PATH}: alleato-backend healthCheckPath must be /health; found ${contract.healthCheckPath || "<missing>"}`,
    );
  }
}

async function fetchJsonWithTimeout(url, options = {}) {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), SHORT_TIMEOUT_MS);
  try {
    const response = await fetch(url, { ...options, signal: controller.signal });
    const text = await response.text();
    let payload = {};
    try {
      payload = text ? JSON.parse(text) : {};
    } catch {
      payload = { raw: text.slice(0, 500) };
    }
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}: ${JSON.stringify(payload).slice(0, 500)}`);
    }
    return payload;
  } finally {
    clearTimeout(timeout);
  }
}

function getLiveContract(payload) {
  const service = payload.service ?? payload;
  const details = service?.serviceDetails ?? {};
  const envSpecific = details?.envSpecificDetails ?? {};

  return {
    serviceName: normalizeValue(service?.name),
    serviceUrl: normalizeValue(details?.url),
    runtime: normalizeValue(details?.runtime || details?.env).toLowerCase(),
    effectiveRootDir: normalizeRepoPath(service?.rootDir),
    effectiveDockerContext: normalizeRepoPath(service?.rootDir, envSpecific?.dockerContext),
    effectiveDockerfile: normalizeRepoPath(service?.rootDir, envSpecific?.dockerfilePath),
    healthCheckPath: normalizeValue(details?.healthCheckPath),
    buildCommand: normalizeValue(envSpecific?.buildCommand),
    startCommand: normalizeValue(envSpecific?.startCommand),
  };
}

function compareContracts(expected, live) {
  if (live.serviceName !== "alleato-backend") {
    fail(`Render live service ${RENDER_SERVICE_ID} is not named alleato-backend; found ${live.serviceName || "<missing>"}`);
  }
  if (!live.serviceUrl.includes(ACTIVE_BACKEND_HOST)) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} must point at ${ACTIVE_BACKEND_HOST}; found ${live.serviceUrl || "<missing>"}`,
    );
  }
  if (live.runtime !== "docker") {
    fail(`Render live service ${RENDER_SERVICE_ID} runtime must be docker; found ${live.runtime || "<missing>"}`);
  }
  if (live.effectiveDockerContext !== expected.effectiveDockerContext) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} docker context mismatch; expected ${expected.effectiveDockerContext}, found ${live.effectiveDockerContext || "<missing>"}`,
    );
  }
  if (live.effectiveDockerfile !== expected.effectiveDockerfile) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} dockerfile mismatch; expected ${expected.effectiveDockerfile}, found ${live.effectiveDockerfile || "<missing>"}`,
    );
  }
  if (live.healthCheckPath !== expected.healthCheckPath) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} health check mismatch; expected ${expected.healthCheckPath}, found ${live.healthCheckPath || "<missing>"}`,
    );
  }
  if (live.buildCommand) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} must not use a Node buildCommand for the backend; found ${live.buildCommand}`,
    );
  }
  if (live.startCommand) {
    fail(
      `Render live service ${RENDER_SERVICE_ID} must not use a Node startCommand for the backend; found ${live.startCommand}`,
    );
  }
}

async function verifyLiveRenderContract(expected) {
  const token = process.env.RENDER_API_KEY || process.env.RENDER_TOKEN;
  if (!token) {
    const message = "RENDER_API_KEY or RENDER_TOKEN is not available; skipped live Render backend runtime readback.";
    if (REQUIRE_LIVE_READBACK) {
      fail(message);
    } else {
      warn(message);
    }
    return null;
  }

  const payload = await fetchJsonWithTimeout(`${RENDER_SERVICE_URL}/${RENDER_SERVICE_ID}`, {
    headers: {
      accept: "application/json",
      authorization: `Bearer ${token}`,
    },
  });

  const live = getLiveContract(payload);
  compareContracts(expected, live);
  return live;
}

async function main() {
  loadDotEnv();
  const manifestContract = getManifestContract();
  verifyManifestContract(manifestContract);
  const live = manifestContract ? await verifyLiveRenderContract(manifestContract) : null;

  for (const warning of warnings) {
    console.warn(`warning: ${warning}`);
  }

  if (failures.length > 0) {
    console.error("Render backend runtime contract verification failed:");
    for (const failure of failures) {
      console.error(`- ${failure}`);
    }
    process.exit(1);
  }

  console.log("Render backend runtime contract verification passed");
  console.log(JSON.stringify({ manifest: manifestContract, live }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
