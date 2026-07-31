import { existsSync, readFileSync } from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { spawnSync } from "node:child_process";
import { writeRouteInventory } from "./route-inventory.mjs";

const frontendRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../..");
const repoRoot = path.resolve(frontendRoot, "..");
const routeAuditScript = path.join(repoRoot, "scripts", "verify", "route-audit.mjs");

function assertUsableInventory(inventoryPath) {
  if (!existsSync(inventoryPath)) {
    throw new Error(
      `[route-inventory] Generation did not write ${inventoryPath}. ` +
        "Verify the route generator writes its static import before retrying the deployment.",
    );
  }

  try {
    const rows = JSON.parse(readFileSync(inventoryPath, "utf8"));
    if (Array.isArray(rows) && rows.length > 0) return rows.length;
  } catch {
    // The actionable error below covers malformed JSON as well as an empty array.
  }

  throw new Error(
    `[route-inventory] Generated inventory is empty or malformed at ${inventoryPath}. ` +
      "Verify frontend/src/app contains route files and the generator writes valid JSON before retrying the deployment.",
  );
}
/**
 * Builds a fresh route inventory when the repository root is available.
 *
 * Vercel builds this project from `frontend/`, where repository-level scripts
 * are intentionally unavailable. Generate from that route tree before Next.js
 * bundles the static JSON import.
 */
export function prepareRouteInventory({
  frontendRootPath = frontendRoot,
  repoRootPath = repoRoot,
  routeAuditScriptPath = routeAuditScript,
  isVercel = Boolean(process.env.VERCEL),
} = {}) {
  const inventoryPath = path.join(
    frontendRootPath,
    "src",
    "app",
    "(admin)",
    "site-map",
    "route-inventory.generated.json",
  );

  if (existsSync(routeAuditScriptPath)) {
    const result = spawnSync(process.execPath, [routeAuditScriptPath], {
      cwd: repoRootPath,
      env: process.env,
      stdio: "inherit",
    });

    if (result.status !== 0) {
      throw new Error(
        `[route-inventory] Generation failed (${result.status ?? "unknown"}): ${routeAuditScriptPath}`,
      );
    }
    assertUsableInventory(inventoryPath);
    return;
  }

  if (!isVercel) {
    throw new Error(
      `[route-inventory] Repository audit script is missing: ${routeAuditScriptPath}. ` +
        "Run this command from a complete repository checkout.",
    );
  }

  writeRouteInventory({ frontendRoot: frontendRootPath });
  const rowCount = assertUsableInventory(inventoryPath);

  console.log(`[route-inventory] Regenerated ${rowCount} rows in Vercel frontend-root build: ${inventoryPath}`);
}

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  prepareRouteInventory();
}
