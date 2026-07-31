import { existsSync, readFileSync, renameSync, rmSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const stateDir = path.join(frontendRoot, ".next-nonprod-routes");
const statePath = path.join(stateDir, "disabled-routes.json");

if (!existsSync(statePath)) {
  console.log("[build] no disabled non-production routes to restore");
  process.exit(0);
}

const state = JSON.parse(readFileSync(statePath, "utf8"));
const restored = [];

for (const entry of [...state.files].reverse()) {
  const source = path.join(frontendRoot, entry.to);
  const target = path.join(frontendRoot, entry.from);

  if (!existsSync(source) && existsSync(target)) {
    restored.push(entry.from);
    continue;
  }

  if (!existsSync(source)) {
    throw new Error(`[build] Cannot restore missing disabled route file: ${entry.to}`);
  }

  if (existsSync(target)) {
    throw new Error(`[build] Refusing to overwrite restored route file: ${entry.from}`);
  }

  renameSync(source, target);
  restored.push(entry.from);
}

rmSync(stateDir, { recursive: true, force: true });
console.log(`[build] Restored ${restored.length} non-production route files`);
