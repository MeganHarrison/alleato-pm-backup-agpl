import { spawn } from "node:child_process";
import {
  existsSync,
  lstatSync,
  readFileSync,
  readdirSync,
  realpathSync,
  rmSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import os from "node:os";
import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { writeDevTsconfig } from "./write-dev-tsconfig.mjs";

const scriptPath = fileURLToPath(import.meta.url);
const scriptDir = path.dirname(scriptPath);
const frontendDir = path.resolve(scriptDir, "../..");
const repoRoot = path.resolve(frontendDir, "..");
const unixLauncherPath = path.join(repoRoot, "scripts", "dev", "start-frontend-clean.sh");

function fail(message) {
  throw new Error(message);
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

function isPathInside(targetPath, basePath) {
  const relative = path.relative(basePath, targetPath);
  return relative !== ".." && !relative.startsWith(`..${path.sep}`) && !path.isAbsolute(relative);
}

export function buildLauncherOptions(env = process.env, platform = process.platform) {
  const port = String(env.PORT || "3000").trim();
  return {
    platform,
    port,
    devHeapMb: String(env.DEV_HEAP_MB || "12288").trim(),
    nextDevEngine: String(env.NEXT_DEV_ENGINE || "webpack").trim(),
    nextDistDir: String(env.NEXT_DIST_DIR || `.next-dev-${port}`).trim(),
    nextTsconfigPath: String(env.NEXT_TSCONFIG_PATH || `.tsconfig-dev-${port}.json`).trim(),
    pidFile:
      platform === "win32"
        ? path.join(os.tmpdir(), `project-management-next-dev-${port}.pid`)
        : `/tmp/project-management-next-dev-${port}.pid`,
  };
}

export function resolveNextBinary(targetFrontendDir = frontendDir, platform = process.platform) {
  return path.join(targetFrontendDir, "node_modules", ".bin", platform === "win32" ? "next.cmd" : "next");
}

export function resolveWindowsLaunchSpec(nextBinary, nextArgs) {
  return {
    command: nextBinary,
    args: nextArgs,
    shell: true,
  };
}

export function findEscapedNodeModulesLink(targetFrontendDir = frontendDir) {
  const nodeModulesDir = path.join(targetFrontendDir, "node_modules");
  if (!existsSync(nodeModulesDir)) return null;

  const rootStat = lstatSync(nodeModulesDir);
  if (rootStat.isSymbolicLink()) {
    const resolved = realpathSync(nodeModulesDir);
    if (!isPathInside(resolved, targetFrontendDir)) {
      return `${nodeModulesDir} -> ${resolved}`;
    }
  }

  for (const entry of readdirSync(nodeModulesDir, { withFileTypes: true })) {
    if (!entry.isSymbolicLink()) continue;
    const linkPath = path.join(nodeModulesDir, entry.name);
    const resolved = realpathSync(linkPath);
    if (!isPathInside(resolved, targetFrontendDir)) {
      return `${linkPath} -> ${resolved}`;
    }
  }

  return null;
}

export function assertLocalNodeModules(targetFrontendDir = frontendDir) {
  const escapedLink = findEscapedNodeModulesLink(targetFrontendDir);
  if (!escapedLink) return;
  fail(
    [
      "[frontend-dev] Refusing to start with node_modules symlinked outside this checkout.",
      `[frontend-dev] First escaped dependency: ${escapedLink}`,
      "[frontend-dev] Repair with:",
      `[frontend-dev]   rm -rf "${path.join(targetFrontendDir, "node_modules")}" "${path.join(targetFrontendDir, ".next")}"`,
      `[frontend-dev]   pnpm --dir "${targetFrontendDir}" install --frozen-lockfile`,
    ].join("\n"),
  );
}

function readManagedPid(pidFile) {
  if (!existsSync(pidFile)) return null;
  const value = readFileSync(pidFile, "utf8").trim();
  return /^[0-9]+$/.test(value) ? Number(value) : null;
}

function writeManagedPid(pidFile, pid) {
  writeFileSync(pidFile, `${pid}\n`, "utf8");
}

function removeManagedPid(pidFile) {
  try {
    unlinkSync(pidFile);
  } catch {}
}

function isPidRunning(pid) {
  if (!Number.isInteger(pid) || pid <= 0) return false;
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

async function isServerHealthy(port) {
  try {
    const response = await fetch(`http://127.0.0.1:${port}`, {
      redirect: "manual",
      signal: AbortSignal.timeout(3000),
    });
    return response.status >= 200 && response.status < 400;
  } catch {
    return false;
  }
}

async function adoptOrRestartManagedProcess(options) {
  const managedPid = readManagedPid(options.pidFile);
  if (!managedPid) {
    removeManagedPid(options.pidFile);
    return false;
  }

  if (isPidRunning(managedPid) && (await isServerHealthy(options.port))) {
    console.log(
      `[frontend-dev] Server already running (PID ${managedPid}) and healthy at http://localhost:${options.port} - following existing process.`,
    );
    while (isPidRunning(managedPid)) {
      await sleep(1000);
    }
    return true;
  }

  console.log(`[frontend-dev] Server PID ${managedPid} is not responding - restarting.`);
  try {
    process.kill(managedPid);
  } catch {}
  for (let attempt = 0; attempt < 20; attempt += 1) {
    if (!isPidRunning(managedPid)) break;
    await sleep(250);
  }
  removeManagedPid(options.pidFile);
  return false;
}

async function runWindowsLauncher(options) {
  assertLocalNodeModules(frontendDir);

  if (await adoptOrRestartManagedProcess(options)) {
    return;
  }

  if (await isServerHealthy(options.port)) {
    fail(
      `[frontend-dev] Port ${options.port} is already serving responses without a managed pid file. Stop the existing server before retrying.`,
    );
  }

  const nextBinary = resolveNextBinary(frontendDir, "win32");
  if (!existsSync(nextBinary)) {
    fail(`[frontend-dev] Missing local Next.js binary at ${nextBinary}`);
  }

  rmSync(path.join(frontendDir, options.nextDistDir), { recursive: true, force: true });
  writeDevTsconfig(
    path.join(frontendDir, "tsconfig.json"),
    path.join(frontendDir, options.nextTsconfigPath),
    options.nextDistDir,
  );

  const args = ["dev", "--port", options.port];
  if (options.nextDevEngine === "turbopack") {
    args.push("--turbopack");
  }

  const launch = resolveWindowsLaunchSpec(nextBinary, args);
  const child = spawn(launch.command, launch.args, {
    cwd: frontendDir,
    env: {
      ...process.env,
      NODE_OPTIONS: `--max-old-space-size=${options.devHeapMb}`,
      NEXT_DIST_DIR: options.nextDistDir,
      NEXT_TSCONFIG_PATH: options.nextTsconfigPath,
    },
    shell: launch.shell,
    stdio: "inherit",
    windowsHide: true,
  });

  if (!child.pid) {
    fail("[frontend-dev] Failed to start Next.js dev server.");
  }

  writeManagedPid(options.pidFile, child.pid);

  const forwardSignal = (signal) => {
    if (!child.killed) child.kill(signal);
  };
  process.on("SIGINT", () => forwardSignal("SIGINT"));
  process.on("SIGTERM", () => forwardSignal("SIGTERM"));

  const result = await new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", (error) => resolve({ code: 1, signal: null, error }));
  });

  removeManagedPid(options.pidFile);

  if (result.error) {
    fail(`[frontend-dev] Failed to start Next.js dev server: ${result.error.message}`);
  }

  if (result.signal) {
    console.error(`[frontend-dev] Next.js dev server exited from signal ${result.signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.code ?? 0;
}

async function runUnixLauncher() {
  const child = spawn("bash", [unixLauncherPath], {
    cwd: frontendDir,
    env: process.env,
    stdio: "inherit",
  });

  const result = await new Promise((resolve) => {
    child.on("exit", (code, signal) => resolve({ code, signal }));
    child.on("error", (error) => resolve({ code: 1, signal: null, error }));
  });

  if (result.error) {
    fail(`[frontend-dev] Failed to start bash launcher: ${result.error.message}`);
  }

  if (result.signal) {
    console.error(`[frontend-dev] Bash launcher exited from signal ${result.signal}.`);
    process.exitCode = 1;
    return;
  }

  process.exitCode = result.code ?? 0;
}

export async function startFrontendClean(options = buildLauncherOptions()) {
  if (options.platform === "win32") {
    await runWindowsLauncher(options);
    return;
  }
  await runUnixLauncher();
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  try {
    await startFrontendClean();
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  }
}
