import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";

const appRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const eveCli = path.join(appRoot, "node_modules", "eve", "bin", "eve.js");
const result = spawnSync(
  process.execPath,
  [eveCli, "eval", "--max-concurrency", "1", ...process.argv.slice(2)],
  {
    cwd: appRoot,
    env: process.env,
    stdio: "inherit",
  },
);

if (result.error) throw result.error;
process.exit(result.status ?? 1);
