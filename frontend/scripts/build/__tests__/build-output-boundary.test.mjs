import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { spawnSync } from "node:child_process";
import test from "node:test";

import {
  createBuildOutputMonitor,
  directorySizeBytes,
  findNestedNextOutputDirs,
  inspectBuildOutput,
  resolveProductionOutputBoundary,
} from "../build-output-boundary.mjs";
import { buildDevTsconfig } from "../../dev/write-dev-tsconfig.mjs";

const frontendRoot = path.resolve(path.dirname(new URL(import.meta.url).pathname), "../../..");

test("production builds reject a port-scoped dist directory", () => {
  assert.throws(
    () => resolveProductionOutputBoundary("/repo/frontend", { NEXT_DIST_DIR: ".next-dev-3001" }),
    /Port-scoped dev output must not leak into the production build/,
  );
  assert.throws(
    () => resolveProductionOutputBoundary("/repo/frontend", { NEXT_TSCONFIG_PATH: ".tsconfig-dev-3001.json" }),
    /Dev route types must stay isolated from production/,
  );
});

test("production builds use a bounded canonical output directory", () => {
  const boundary = resolveProductionOutputBoundary("/repo/frontend", {
    NEXT_BUILD_MAX_OUTPUT_BYTES: "4096",
  });
  assert.equal(boundary.outputDir, "/repo/frontend/.next");
  assert.equal(boundary.maxBytes, 4096);
});

test("port-scoped dev config does not retain another server's generated types", () => {
  const config = buildDevTsconfig(
    {
      include: ["src/**/*.ts", ".next-dev-3001/types/**/*.ts", ".next/types/**/*.ts"],
      exclude: ["node_modules"],
    },
    ".next-dev-58789",
  );
  assert.deepEqual(config.include, [
    "src/**/*.ts",
    ".next/types/**/*.ts",
    ".next-dev-58789/types/**/*.ts",
  ]);
  assert.throws(() => buildDevTsconfig({}, "../unsafe"), /Refusing unsafe dev dist directory/);
});

test("Next config makes port-scoped output development-only", () => {
  const configSource = readFileSync(path.join(frontendRoot, "next.config.ts"), "utf8");
  assert.match(configSource, /const isDevelopment = process\.env\.NODE_ENV === "development"/);
  assert.match(configSource, /NEXT_DIST_DIR[\s\S]*requires[\s\S]*NEXT_TSCONFIG_PATH/);
  assert.match(configSource, /const nextDistDir = isDevelopment[\s\S]*process\.env\.NEXT_DIST_DIR[\s\S]*: "\.next"/);
  assert.match(configSource, /const nextTsconfigPath = isDevelopment[\s\S]*process\.env\.NEXT_TSCONFIG_PATH[\s\S]*: "tsconfig\.json"/);
});

test("custom dev output fails before it can mutate the production tsconfig", () => {
  const env = {
    ...process.env,
    NODE_ENV: "development",
    NEXT_DIST_DIR: ".next-s138",
  };
  delete env.NEXT_TSCONFIG_PATH;
  const probe = spawnSync(
    process.execPath,
    [
      "-e",
      "const load=require('./node_modules/next/dist/server/config.js').default;" +
        "const {PHASE_DEVELOPMENT_SERVER}=require('./node_modules/next/constants.js');" +
        "load(PHASE_DEVELOPMENT_SERVER,process.cwd())",
    ],
    { cwd: frontendRoot, env, encoding: "utf8" },
  );
  assert.notEqual(probe.status, 0);
  assert.match(probe.stderr, /NEXT_DIST_DIR=.*requires NEXT_TSCONFIG_PATH/);
});

test("output inspection rejects nested Next.js dist trees", () => {
  const root = mkdtempSync(path.join(tmpdir(), "build-output-boundary-"));
  const outputDir = path.join(root, ".next");
  const nested = path.join(outputDir, "server", ".next-dev-3001");
  mkdirSync(nested, { recursive: true });
  writeFileSync(path.join(nested, "artifact.js"), "generated");
  try {
    assert.deepEqual(findNestedNextOutputDirs(outputDir), [nested]);
    assert.throws(
      () => inspectBuildOutput({ outputDir, maxBytes: 1024 * 1024 }),
      /nested Next\.js dist directories/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("output inspection rejects unbounded growth and accepts bounded output", () => {
  const root = mkdtempSync(path.join(tmpdir(), "build-output-boundary-"));
  const outputDir = path.join(root, ".next");
  mkdirSync(outputDir);
  writeFileSync(path.join(outputDir, "artifact.js"), "1234567890");
  try {
    assert.throws(
      () => inspectBuildOutput({ outputDir, maxBytes: 5 }),
      /Generated output may be tracing itself/,
    );
    const result = inspectBuildOutput({ outputDir, maxBytes: 1024 });
    assert.equal(result.sizeBytes, 10);
    assert.deepEqual(result.nestedOutputDirs, []);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("transient webpack cache is excluded only from the live output monitor size", () => {
  const root = mkdtempSync(path.join(tmpdir(), "build-output-boundary-"));
  const outputDir = path.join(root, ".next");
  const cacheDir = path.join(outputDir, "cache");
  mkdirSync(cacheDir, { recursive: true });
  writeFileSync(path.join(outputDir, "artifact.js"), "12345");
  writeFileSync(path.join(cacheDir, "webpack.pack"), "0123456789");
  try {
    assert.equal(directorySizeBytes(outputDir), 15);
    assert.equal(directorySizeBytes(outputDir, { excludedPaths: [cacheDir] }), 5);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("live monitor fails loudly before oversized output can keep growing", async () => {
  const root = mkdtempSync(path.join(tmpdir(), "build-output-boundary-"));
  const outputDir = path.join(root, ".next");
  mkdirSync(outputDir);
  writeFileSync(path.join(outputDir, "artifact.js"), "1234567890");
  try {
    const error = await new Promise((resolve, reject) => {
      const timeout = setTimeout(() => reject(new Error("monitor did not detect growth")), 500);
      createBuildOutputMonitor({
        outputDir,
        maxBytes: 5,
        intervalMs: 5,
        onLimitExceeded(result) {
          clearTimeout(timeout);
          resolve(result);
        },
      });
    });
    assert.match(error.message, /Terminating before recursive tracing exhausts memory/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
