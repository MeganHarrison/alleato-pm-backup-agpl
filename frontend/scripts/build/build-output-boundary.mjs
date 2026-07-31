import { existsSync, lstatSync, readdirSync } from "node:fs";
import path from "node:path";

export const CANONICAL_PRODUCTION_DIST_DIR = ".next";
export const DEFAULT_MAX_BUILD_OUTPUT_BYTES = 2 * 1024 * 1024 * 1024;

function formatBytes(bytes) {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KiB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MiB`;
}

export function resolveProductionOutputBoundary(frontendRoot, env = process.env) {
  const configuredDistDir = env.NEXT_DIST_DIR?.trim();
  if (configuredDistDir && configuredDistDir !== CANONICAL_PRODUCTION_DIST_DIR) {
    throw new Error(
      `[build-output] Production builds require NEXT_DIST_DIR=${CANONICAL_PRODUCTION_DIST_DIR}; ` +
        `received ${configuredDistDir}. Port-scoped dev output must not leak into the production build.`,
    );
  }
  const configuredTsconfig = env.NEXT_TSCONFIG_PATH?.trim();
  if (configuredTsconfig && configuredTsconfig !== "tsconfig.json") {
    throw new Error(
      `[build-output] Production builds require NEXT_TSCONFIG_PATH=tsconfig.json; ` +
        `received ${configuredTsconfig}. Dev route types must stay isolated from production.`,
    );
  }

  const outputDir = path.resolve(frontendRoot, CANONICAL_PRODUCTION_DIST_DIR);
  if (path.dirname(outputDir) !== path.resolve(frontendRoot)) {
    throw new Error(`[build-output] Canonical output escaped the frontend root: ${outputDir}`);
  }

  const configuredLimit = Number.parseInt(env.NEXT_BUILD_MAX_OUTPUT_BYTES ?? "", 10);
  const maxBytes = Number.isFinite(configuredLimit) && configuredLimit > 0
    ? configuredLimit
    : DEFAULT_MAX_BUILD_OUTPUT_BYTES;
  return { outputDir, maxBytes };
}

export function directorySizeBytes(rootDir, { excludedPaths = [] } = {}) {
  if (!existsSync(rootDir)) return 0;
  const excluded = new Set(excludedPaths.map((entry) => path.resolve(entry)));
  let total = 0;
  const pending = [rootDir];
  while (pending.length > 0) {
    const current = pending.pop();
    if (excluded.has(path.resolve(current))) continue;
    let stat;
    try {
      stat = lstatSync(current);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    if (stat.isSymbolicLink()) continue;
    if (!stat.isDirectory()) {
      total += stat.size;
      continue;
    }
    let entries;
    try {
      entries = readdirSync(current);
    } catch (error) {
      if (error?.code === "ENOENT") continue;
      throw error;
    }
    for (const entry of entries) pending.push(path.join(current, entry));
  }
  return total;
}

export function findNestedNextOutputDirs(outputDir) {
  if (!existsSync(outputDir)) return [];
  const nested = [];
  const pending = [outputDir];
  while (pending.length > 0) {
    const current = pending.pop();
    for (const entry of readdirSync(current, { withFileTypes: true })) {
      if (!entry.isDirectory() || entry.isSymbolicLink()) continue;
      const entryPath = path.join(current, entry.name);
      if (entry.name === ".next" || entry.name.startsWith(".next-")) {
        nested.push(entryPath);
        continue;
      }
      pending.push(entryPath);
    }
  }
  return nested;
}

export function inspectBuildOutput({ outputDir, maxBytes }) {
  if (!existsSync(outputDir)) {
    throw new Error(`[build-output] Expected build output is missing: ${outputDir}`);
  }
  const sizeBytes = directorySizeBytes(outputDir);
  if (sizeBytes > maxBytes) {
    throw new Error(
      `[build-output] ${outputDir} grew to ${formatBytes(sizeBytes)}, above the ` +
        `${formatBytes(maxBytes)} safety limit. Generated output may be tracing itself.`,
    );
  }
  const nestedOutputDirs = findNestedNextOutputDirs(outputDir);
  if (nestedOutputDirs.length > 0) {
    throw new Error(
      `[build-output] Generated output contains nested Next.js dist directories: ` +
        nestedOutputDirs.join(", "),
    );
  }
  return { sizeBytes, nestedOutputDirs };
}

export function createBuildOutputMonitor({
  outputDir,
  maxBytes,
  intervalMs = 10_000,
  excludedPaths = [],
  onLimitExceeded,
}) {
  let checking = false;
  let stopped = false;
  const timer = setInterval(() => {
    if (checking || stopped || !existsSync(outputDir)) return;
    checking = true;
    try {
      const sizeBytes = directorySizeBytes(outputDir, { excludedPaths });
      if (sizeBytes > maxBytes) {
        stopped = true;
        clearInterval(timer);
        onLimitExceeded(
          new Error(
            `[build-output] Build output reached ${formatBytes(sizeBytes)}, above the ` +
              `${formatBytes(maxBytes)} safety limit. Terminating before recursive tracing exhausts memory.`,
          ),
        );
      }
    } finally {
      checking = false;
    }
  }, intervalMs);
  timer.unref();
  return { stop() { stopped = true; clearInterval(timer); } };
}
