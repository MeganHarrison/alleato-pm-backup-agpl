import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";

const repoRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const frontendScript = path.join(repoRoot, "frontend/scripts/build/disable-nonprod-routes.mjs");
const result = spawnSync(process.execPath, [frontendScript], {
  cwd: repoRoot,
  env: process.env,
  stdio: "inherit",
});

process.exit(result.status ?? 1);
