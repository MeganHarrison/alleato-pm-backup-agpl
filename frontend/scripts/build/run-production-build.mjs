import { closeSync, existsSync, openSync, rmSync, unlinkSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawn, spawnSync } from "node:child_process";

import {
  CANONICAL_PRODUCTION_DIST_DIR,
  createBuildOutputMonitor,
  inspectBuildOutput,
  resolveProductionOutputBoundary,
} from "./build-output-boundary.mjs";
import { assertProductionDeploymentSource } from "./production-source-gate.mjs";
import { prepareRouteInventory } from "./prepare-route-inventory.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(frontendRoot, "..");
const disableScript = path.join(frontendRoot, "scripts/build/disable-nonprod-routes.mjs");
const restoreScript = path.join(frontendRoot, "scripts/build/restore-nonprod-routes.mjs");
const statePath = path.join(frontendRoot, ".next-nonprod-routes/disabled-routes.json");
const buildOutputBoundary = resolveProductionOutputBoundary(frontendRoot);
const nextDir = buildOutputBoundary.outputDir;
const nextBuildCacheDir = path.join(nextDir, "cache");
const buildLockPath = path.join(frontendRoot, ".next-production-build.lock");
const TRANSIENT_NEXT_BUILD_FAILURES = [
  /Cannot find module for page: \/_document/,
  /PageNotFoundError/,
  /app-build-manifest\.json/,
  /_buildManifest\.js\.tmp/,
  /Cannot find module '.*\.next\/server\/app\/.*\/route\.js'/,
  /Export encountered an error on .*\/route/,
  // Vercel emits this with "Failed" capitalized; make the matcher
  // case-insensitive so the existing retry → webpack fallback actually runs.
  /TurbopackInternalError: failed to write (?:app endpoint|to .*\.next\/)/i,
  /ENOENT: no such file or directory, open '.*\.next\//,
  /No such file or directory \(os error 2\)/,
  /Symlink node_modules is invalid, it points out of the filesystem root/,
];
const TURBOPACK_BUILD_ARGS = ["build", "--turbopack"];
const WEBPACK_BUILD_ARGS = ["build"];
const isVercel = process.env.VERCEL === "1" || process.env.VERCEL === "true";
const buildEngine = (process.env.NEXT_PRODUCTION_BUILD_ENGINE ?? "turbopack")
  .trim()
  .toLowerCase();
const nextBuildNodeOptions =
  process.env.NEXT_PRODUCTION_BUILD_NODE_OPTIONS?.trim() ||
  (isVercel ? "--max-old-space-size=11264" : "--max-old-space-size=16384");
const turbopackSilenceTimeoutMs = Math.max(
  1,
  Number.parseInt(process.env.NEXT_TURBOPACK_SILENCE_TIMEOUT_MS ?? "", 10) || 8 * 60 * 1000,
);
const webpackSilenceTimeoutMs = Math.max(
  1,
  Number.parseInt(process.env.NEXT_WEBPACK_SILENCE_TIMEOUT_MS ?? "", 10) || 12 * 60 * 1000,
);
const buildContractsScript = path.join(frontendRoot, "scripts/build/check-critical-build-contracts.mjs");

let activeChild = null;
let cleanedUp = false;
let buildLockFd = null;

function acquireBuildLock() {
  try {
    buildLockFd = openSync(buildLockPath, "wx");
    return;
  } catch (error) {
    if (error?.code === "EEXIST") {
      throw new Error(
        `[build] Another production build is already running (${buildLockPath}). ` +
          "Wait for it to finish instead of starting a concurrent compiler.",
      );
    }
    throw error;
  }
}

function releaseBuildLock() {
  if (buildLockFd == null) {
    return;
  }

  closeSync(buildLockFd);
  buildLockFd = null;
  unlinkSync(buildLockPath);
}

function formatDuration(ms) {
  const seconds = ms / 1000;
  if (seconds < 60) {
    return `${seconds.toFixed(1)}s`;
  }

  return `${(seconds / 60).toFixed(1)}min`;
}

async function timedStep(label, step) {
  const startedAt = Date.now();
  console.log(`[build] ${label} started`);
  try {
    return await step();
  } finally {
    console.log(`[build] ${label} finished in ${formatDuration(Date.now() - startedAt)}`);
  }
}

function runNodeScript(scriptPath, { cwd = frontendRoot } = {}) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [scriptPath], {
      cwd,
      env: process.env,
      stdio: "inherit",
    });

    child.on("error", reject);
    child.on("exit", (code, signal) => {
      if (signal) {
        reject(new Error(`Script terminated by signal ${signal}: ${scriptPath}`));
        return;
      }
      if (code !== 0) {
        reject(new Error(`Script exited with code ${code}: ${scriptPath}`));
        return;
      }
      resolve();
    });
  });
}

function runRestoreSync() {
  // On Vercel the container is ephemeral — skip restore so that Vercel's own
  // post-build file tracing (NFT) can still lstat the .nonprod files it recorded
  // during the build. Restoring them before NFT runs causes ENOENT failures.
  if (process.env.VERCEL) {
    return;
  }

  if (cleanedUp || !existsSync(statePath)) {
    return;
  }

  cleanedUp = true;
  const result = spawnSync(process.execPath, [restoreScript], {
    cwd: frontendRoot,
    env: process.env,
    stdio: "inherit",
  });

  if (result.status !== 0) {
    throw new Error(`[build] Failed to restore non-production routes (exit ${result.status ?? "unknown"})`);
  }
}

function removeNextDir(reason) {
  if (!existsSync(nextDir)) {
    return;
  }

  // Turbopack can finish its child process while a small number of manifest
  // files are still being closed. Without retries, the intended retry/fallback
  // path fails with ENOTEMPTY and hides the actual build result.
  rmSync(nextDir, {
    recursive: true,
    force: true,
    maxRetries: 8,
    retryDelay: 250,
  });
  console.log(`[build] Removed frontend/.next (${reason})`);
}

function isTransientNextBuildFailure(output) {
  return TRANSIENT_NEXT_BUILD_FAILURES.some((pattern) => pattern.test(output));
}

function getSilenceTimeoutMs(label) {
  if (label === "Turbopack") {
    return turbopackSilenceTimeoutMs;
  }
  if (label === "Webpack") {
    return webpackSilenceTimeoutMs;
  }
  return null;
}

function nextInvocation(args) {
  const nextEntrypoint = path.join(frontendRoot, "node_modules/next/dist/bin/next");
  if (!existsSync(nextEntrypoint)) {
    throw new Error(
      `[build] Next.js CLI entrypoint was not found at ${nextEntrypoint}. Install frontend dependencies first.`,
    );
  }
  return { command: process.execPath, args: [nextEntrypoint, ...args] };
}

async function runNextBuildAttempt({ attempt, args, label }) {
  // Every production `frontend` deployment failed with an OOM SIGKILL for
  // ~15+ hours starting 2026-07-28, across dozens of unrelated commits
  // (confirmed via Vercel's own build-system report). The onset lines up
  // with this branch: on Vercel, the first Turbopack attempt used to skip
  // clearing `.next`, deliberately preserving Vercel's restored
  // `.next/cache`. Many of those builds were themselves killed mid-write, so
  // the persisted cache restored into each subsequent build was very likely
  // growing unbounded and/or partially corrupted — every build then loaded a
  // progressively larger/broken cache before compilation even started.
  // Always clearing `.next` first breaks that spiral. This trades away
  // incremental-build speed (cold builds again, ~8-10 min) for correctness.
  // Re-introduce cache preservation only alongside a safeguard that bounds
  // or periodically resets cache size.
  removeNextDir("prevent stale manifest/cache failures");

  let buildOutput = "";
  let silenceTimer = null;
  let terminatedForSilence = false;
  let outputLimitError = null;
  let outputMonitor = null;
  const silenceTimeoutMs = getSilenceTimeoutMs(label);
  const exitCode = await new Promise((resolve, reject) => {
    console.log(`[build] Starting ${label} production build attempt ${attempt}`);
    console.log(`[build] ${label} production build NODE_OPTIONS=${nextBuildNodeOptions}`);
    if (silenceTimeoutMs != null) {
      console.log(
        `[build] ${label} silence timeout ${Math.round(silenceTimeoutMs / 1000)}s before guardrail triggers`,
      );
    }
    const invocation = nextInvocation(args);
    activeChild = spawn(invocation.command, invocation.args, {
      cwd: frontendRoot,
      env: {
        ...process.env,
        NODE_OPTIONS: nextBuildNodeOptions,
        NEXT_DIST_DIR: CANONICAL_PRODUCTION_DIST_DIR,
        NEXT_TSCONFIG_PATH: "tsconfig.json",
      },
      stdio: ["inherit", "pipe", "pipe"],
    });

    outputMonitor = createBuildOutputMonitor({
      ...buildOutputBoundary,
      // Webpack's cache is a transient compiler artifact, not deployable output.
      // It can peak well above the final `.next` payload on Vercel; the final
      // output check below still measures every deployable artifact after removal.
      excludedPaths: [nextBuildCacheDir],
      onLimitExceeded(error) {
        outputLimitError = error;
        activeChild?.kill("SIGTERM");
      },
    });

    const resetSilenceTimer = () => {
      if (silenceTimeoutMs == null) {
        return;
      }
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      silenceTimer = setTimeout(() => {
        terminatedForSilence = true;
        console.warn(
          `[build] ${label} produced no output for ${Math.round(
            silenceTimeoutMs / 1000,
          )}s; terminating attempt ${attempt}.`,
        );
        activeChild?.kill("SIGTERM");
      }, silenceTimeoutMs);
    };

    resetSilenceTimer();
    activeChild.stdout.on("data", (chunk) => {
      buildOutput += chunk.toString();
      process.stdout.write(chunk);
      resetSilenceTimer();
    });
    activeChild.stderr.on("data", (chunk) => {
      buildOutput += chunk.toString();
      process.stderr.write(chunk);
      resetSilenceTimer();
    });
    activeChild.on("error", (error) => {
      outputMonitor?.stop();
      reject(error);
    });
    activeChild.on("exit", (code, signal) => {
      outputMonitor?.stop();
      if (silenceTimer) {
        clearTimeout(silenceTimer);
      }
      activeChild = null;
      if (outputLimitError) {
        reject(outputLimitError);
        return;
      }
      if (signal) {
        if (terminatedForSilence) {
          resolve(124);
          return;
        }
        reject(new Error(`next build terminated by signal ${signal}`));
        return;
      }
      resolve(code ?? 1);
    });
  });

  if (exitCode === 124 && label === "Turbopack") {
    console.warn("[build] Falling back to standard Next production build after Turbopack stall.");
    return runNextBuildAttempt({
      attempt: 1,
      args: WEBPACK_BUILD_ARGS,
      label: "Webpack",
    });
  }

  if (exitCode === 124 && label === "Webpack") {
    throw new Error(
      `[build] Webpack produced no output for ${Math.round(
        webpackSilenceTimeoutMs / 1000,
      )}s after Turbopack fallback. Failing loudly instead of hanging indefinitely.`,
    );
  }

  if (exitCode !== 0 && label === "Turbopack" && isTransientNextBuildFailure(buildOutput)) {
    if (attempt === 1) {
      console.warn("[build] Turbopack hit a transient manifest/page-data artifact failure; clearing .next and retrying once.");
      return runNextBuildAttempt({ attempt: 2, args, label });
    }
    console.warn("[build] Next build hit a transient manifest/page-data artifact failure; clearing .next and retrying once.");
    console.warn("[build] Falling back to standard Next production build after repeated Turbopack artifact failures.");
    return runNextBuildAttempt({
      attempt: 1,
      args: WEBPACK_BUILD_ARGS,
      label: "Webpack",
    });
  }

  return exitCode;
}

async function main() {
  assertProductionDeploymentSource();
  acquireBuildLock();

  if (!["turbopack", "webpack"].includes(buildEngine)) {
    throw new Error(
      `[build] Unsupported NEXT_PRODUCTION_BUILD_ENGINE="${buildEngine}". Expected "turbopack" or "webpack".`,
    );
  }

  console.log(
    `[build-output] Canonical output ${nextDir}; safety limit ${buildOutputBoundary.maxBytes} bytes`,
  );

  await timedStep("Verify critical build contracts", () => runNodeScript(buildContractsScript));

  await timedStep("Disable non-production routes", () => runNodeScript(disableScript));

  await timedStep("Prepare route inventory", () => prepareRouteInventory());

  const exitCode = await timedStep("Next production build", () => {
    if (buildEngine === "webpack") {
      console.log("[build] NEXT_PRODUCTION_BUILD_ENGINE=webpack; skipping Turbopack production build.");
      return runNextBuildAttempt({
        attempt: 1,
        args: WEBPACK_BUILD_ARGS,
        label: "Webpack",
      });
    }

    return runNextBuildAttempt({
      attempt: 1,
      args: TURBOPACK_BUILD_ARGS,
      label: "Turbopack",
    });
  });

  if (exitCode === 0) {
    await timedStep("Verify build output boundary", () => {
      rmSync(nextBuildCacheDir, {
        recursive: true,
        force: true,
        maxRetries: 8,
        retryDelay: 250,
      });
      const result = inspectBuildOutput(buildOutputBoundary);
      console.log(
        `[build-output] Verified ${result.sizeBytes} bytes with no nested Next.js dist directories`,
      );
    });
  }

  await timedStep("Restore non-production routes", () => {
    runRestoreSync();
  });
  process.exit(exitCode);
}

process.on("exit", releaseBuildLock);

for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => {
    try {
      if (activeChild) {
        activeChild.kill(signal);
      }
      runRestoreSync();
    } finally {
      process.exit(128);
    }
  });
}

process.on("uncaughtException", (error) => {
  try {
    runRestoreSync();
  } finally {
    console.error(error);
    process.exit(1);
  }
});

process.on("unhandledRejection", (error) => {
  try {
    runRestoreSync();
  } finally {
    console.error(error);
    process.exit(1);
  }
});

main().catch((error) => {
  try {
    runRestoreSync();
  } finally {
    console.error(error);
    process.exit(1);
  }
});
