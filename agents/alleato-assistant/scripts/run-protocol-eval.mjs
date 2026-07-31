import { spawnSync } from "node:child_process";
import {
  cpSync,
  copyFileSync,
  mkdirSync,
  mkdtempSync,
  rmSync,
} from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const runtimeRoot = mkdtempSync(path.join(appRoot, ".protocol-runtime-"));
const eveCli = path.join(appRoot, "node_modules", "eve", "bin", "eve.js");

try {
  cpSync(path.join(appRoot, "agent"), path.join(runtimeRoot, "agent"), {
    recursive: true,
  });
  cpSync(path.join(appRoot, "evals"), path.join(runtimeRoot, "evals"), {
    recursive: true,
  });
  copyFileSync(
    path.join(appRoot, "package.json"),
    path.join(runtimeRoot, "package.json"),
  );
  copyFileSync(
    path.join(appRoot, "tsconfig.json"),
    path.join(runtimeRoot, "tsconfig.json"),
  );
  mkdirSync(path.join(runtimeRoot, "protocol"), { recursive: true });
  copyFileSync(
    path.join(appRoot, "protocol", "mock-agent.ts"),
    path.join(runtimeRoot, "agent", "agent.ts"),
  );
  copyFileSync(
    path.join(appRoot, "protocol", "mock-sandbox.ts"),
    path.join(runtimeRoot, "agent", "sandbox", "sandbox.ts"),
  );

  const result = spawnSync(
    process.execPath,
    [eveCli, "eval", "--max-concurrency", "1", ...process.argv.slice(2)],
    {
      cwd: runtimeRoot,
      env: process.env,
      stdio: "inherit",
    },
  );
  if (result.error) throw result.error;
  process.exitCode = result.status ?? 1;
} finally {
  rmSync(runtimeRoot, { force: true, recursive: true });
}
