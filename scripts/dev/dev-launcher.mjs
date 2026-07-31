#!/usr/bin/env node
// Cross-platform `npm run dev` entrypoint.
//
// macOS/Linux delegates to the canonical bash launcher. Windows applies the
// same port-scoped dist and TypeScript isolation before starting Turbopack.

import { spawn, spawnSync } from "node:child_process";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import path from "node:path";
import process from "node:process";

const repoRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "..",
  "..",
);
const frontendDir = path.join(repoRoot, "frontend");

function forwardSignals(child) {
  for (const signal of ["SIGINT", "SIGTERM"]) {
    process.on(signal, () => {
      try {
        child.kill(signal);
      } catch {
        // Child already exited.
      }
    });
  }
  child.on("exit", (code) => process.exit(code ?? 0));
  child.on("error", (error) => {
    console.error(`[dev-launcher] failed to start: ${error.message}`);
    process.exit(1);
  });
}

export function windowsDevRuntime(env = process.env) {
  const port = env.PORT || "3000";
  if (!/^\d+$/.test(port) || Number(port) < 1 || Number(port) > 65535) {
    throw new Error(`[dev-launcher] Invalid PORT: ${port}`);
  }

  const nextDistDir = env.NEXT_DIST_DIR || `.next-dev-${port}`;
  const nextTsconfigPath =
    env.NEXT_TSCONFIG_PATH || `.tsconfig-dev-${port}.json`;
  if (!/^\.next-dev-\d+$/.test(nextDistDir)) {
    throw new Error(
      `[dev-launcher] Refusing unsafe NEXT_DIST_DIR=${nextDistDir}; expected .next-dev-<port>.`,
    );
  }
  if (!/^\.tsconfig-dev-\d+\.json$/.test(nextTsconfigPath)) {
    throw new Error(
      `[dev-launcher] Refusing unsafe NEXT_TSCONFIG_PATH=${nextTsconfigPath}; expected .tsconfig-dev-<port>.json.`,
    );
  }

  return { port, nextDistDir, nextTsconfigPath };
}

export function prepareWindowsDevRuntime(runtime) {
  const distPath = path.join(frontendDir, runtime.nextDistDir);
  const tsconfigPath = path.join(frontendDir, runtime.nextTsconfigPath);
  const helperPath = path.join(
    frontendDir,
    "scripts",
    "dev",
    "write-dev-tsconfig.mjs",
  );

  fs.rmSync(distPath, { recursive: true, force: true });
  const result = spawnSync(
    process.execPath,
    [
      helperPath,
      path.join(frontendDir, "tsconfig.json"),
      tsconfigPath,
      runtime.nextDistDir,
    ],
    { cwd: frontendDir, stdio: "inherit" },
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    throw new Error(
      `[dev-launcher] Failed to prepare isolated TypeScript config for port ${runtime.port}.`,
    );
  }
}

function startWindows() {
  const runtime = windowsDevRuntime();
  const nextBin = path.join(
    frontendDir,
    "node_modules",
    "next",
    "dist",
    "bin",
    "next",
  );
  if (!fs.existsSync(nextBin)) {
    throw new Error(
      `[dev-launcher] Missing local Next.js binary at ${nextBin}. Run pnpm --dir frontend install --frozen-lockfile.`,
    );
  }

  const heap = "--max-old-space-size=8192";
  const nodeOptions = process.env.NODE_OPTIONS
    ? `${process.env.NODE_OPTIONS} ${heap}`
    : heap;

  prepareWindowsDevRuntime(runtime);
  const args = [
    nextBin,
    "dev",
    frontendDir,
    "--turbopack",
    "--port",
    runtime.port,
  ];

  console.log(
    `[dev-launcher] Windows: starting isolated Next on http://localhost:${runtime.port} with ${runtime.nextDistDir}.`,
  );

  const child = spawn(process.execPath, args, {
    cwd: frontendDir,
    stdio: "inherit",
    env: {
      ...process.env,
      NODE_OPTIONS: nodeOptions,
      ALLEATO_TURBOPACK_WORKFLOW_COMPAT: "1",
      NEXT_DIST_DIR: runtime.nextDistDir,
      NEXT_TSCONFIG_PATH: runtime.nextTsconfigPath,
      PORT: runtime.port,
    },
  });
  forwardSignals(child);
}

function startUnix() {
  const child = spawn(
    "bash",
    [path.join(repoRoot, "scripts", "dev", "start-frontend-clean.sh")],
    {
      cwd: frontendDir,
      stdio: "inherit",
      env: process.env,
    },
  );
  forwardSignals(child);
}

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  if (process.platform === "win32") {
    startWindows();
  } else {
    startUnix();
  }
}
