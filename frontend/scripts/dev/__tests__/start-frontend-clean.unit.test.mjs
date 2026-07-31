import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";

import {
  buildLauncherOptions,
  findEscapedNodeModulesLink,
  resolveNextBinary,
  resolveWindowsLaunchSpec,
} from "../start-frontend-clean.mjs";

test("launcher uses port-scoped Windows defaults", () => {
  const options = buildLauncherOptions({ PORT: "3056" }, "win32");
  assert.equal(options.port, "3056");
  assert.equal(options.nextDistDir, ".next-dev-3056");
  assert.equal(options.nextTsconfigPath, ".tsconfig-dev-3056.json");
  assert.match(options.pidFile, /project-management-next-dev-3056\.pid$/);
});

test("launcher respects explicit override values", () => {
  const options = buildLauncherOptions(
    {
      PORT: "4111",
      DEV_HEAP_MB: "4096",
      NEXT_DEV_ENGINE: "turbopack",
      NEXT_DIST_DIR: ".next-dev-4111",
      NEXT_TSCONFIG_PATH: ".tsconfig-dev-4111.json",
    },
    "win32",
  );
  assert.equal(options.devHeapMb, "4096");
  assert.equal(options.nextDevEngine, "turbopack");
  assert.equal(options.nextDistDir, ".next-dev-4111");
  assert.equal(options.nextTsconfigPath, ".tsconfig-dev-4111.json");
});

test("launcher resolves the Windows next binary without bash", () => {
  assert.match(resolveNextBinary("C:\\repo\\frontend", "win32"), /node_modules\\\.bin\\next\.cmd$/);
  assert.match(resolveNextBinary("/repo/frontend", "linux"), /node_modules[\\/]\.bin[\\/]next$/);
});

test("launcher uses shell mode to run the Windows next.cmd entrypoint", () => {
  const launch = resolveWindowsLaunchSpec("C:\\repo\\frontend\\node_modules\\.bin\\next.cmd", [
    "dev",
    "--port",
    "3066",
  ]);
  assert.equal(launch.command, "C:\\repo\\frontend\\node_modules\\.bin\\next.cmd");
  assert.deepEqual(launch.args, ["dev", "--port", "3066"]);
  assert.equal(launch.shell, true);
});

test("escaped top-level node_modules links fail loudly", { skip: process.platform === "win32" }, () => {
  const root = mkdtempSync(path.join(tmpdir(), "frontend-dev-launcher-"));
  const frontendRoot = path.join(root, "frontend");
  const externalRoot = path.join(root, "external");
  const nodeModulesLink = path.join(frontendRoot, "node_modules");
  mkdirSync(frontendRoot, { recursive: true });
  mkdirSync(externalRoot, { recursive: true });
  writeFileSync(path.join(externalRoot, "marker.txt"), "outside");
  symlinkSync(externalRoot, nodeModulesLink, "dir");

  try {
    const escaped = findEscapedNodeModulesLink(frontendRoot);
    assert.match(escaped ?? "", /node_modules/);
    assert.match(escaped ?? "", /external/);
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
