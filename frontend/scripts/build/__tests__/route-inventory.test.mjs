import assert from "node:assert/strict";
import { mkdtempSync, mkdirSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import { generateRouteInventory, writeRouteInventory } from "../route-inventory.mjs";
import { prepareRouteInventory } from "../prepare-route-inventory.mjs";

function fixture() {
  const root = mkdtempSync(path.join(os.tmpdir(), "alleato-route-inventory-"));
  const app = path.join(root, "src", "app");
  mkdirSync(path.join(app, "(main)", "projects", "[projectId]"), { recursive: true });
  mkdirSync(path.join(app, "api", "health"), { recursive: true });
  mkdirSync(path.join(app, "(admin)", "site-map"), { recursive: true });
  writeFileSync(path.join(app, "(main)", "projects", "[projectId]", "page.tsx"), "export default function Page() { return null; }");
  writeFileSync(path.join(app, "api", "health", "route.ts"), "export const GET = () => new Response('ok');");
  writeFileSync(path.join(app, "(admin)", "site-map", "route-inventory.generated.json"), "[]\n");
  writeFileSync(path.join(root, "src", "links.ts"), "export const path = '/projects';");
  return root;
}

test("generates Page Access inventory directly from a frontend-root checkout", () => {
  const root = fixture();
  try {
    const result = generateRouteInventory({ frontendRoot: root });
    assert.deepEqual(result.inventoryRows.map((row) => [row.route, row.kind]), [["/api/health", "api"], ["/projects/[projectId]", "page"]]);
    assert.equal(result.inventoryRows[1].file, "frontend/src/app/(main)/projects/[projectId]/page.tsx");
    assert.equal(result.inventoryRows[1].refCount, "0");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("writes a non-empty generated inventory before Next.js compiles static imports", () => {
  const root = fixture();
  try {
    const result = writeRouteInventory({ frontendRoot: root });
    const written = JSON.parse(readFileSync(result.generatedInventoryPath, "utf8"));
    assert.equal(written.length, 2);
    assert.equal(written[0].route, "/api/health");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("fails loudly when Vercel cannot provide a frontend route tree", () => {
  assert.throws(
    () => generateRouteInventory({ frontendRoot: path.join(os.tmpdir(), "missing-route-tree") }),
    /\[route-inventory\] Missing frontend source directories/,
  );
});

test("Vercel frontend-root preparation replaces the committed snapshot from deployed routes", () => {
  const root = fixture();
  try {
    prepareRouteInventory({
      frontendRootPath: root,
      repoRootPath: root,
      routeAuditScriptPath: path.join(root, "missing-route-audit.mjs"),
      isVercel: true,
    });
    const written = JSON.parse(readFileSync(path.join(root, "src", "app", "(admin)", "site-map", "route-inventory.generated.json"), "utf8"));
    assert.equal(written.length, 2);
    assert.equal(written[1].route, "/projects/[projectId]");
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});

test("local audit preparation rejects a successful audit that leaves an empty snapshot", () => {
  const root = fixture();
  const emptyAudit = path.join(root, "empty-route-audit.mjs");
  writeFileSync(emptyAudit, "process.exit(0);\n");
  try {
    assert.throws(
      () => prepareRouteInventory({
        frontendRootPath: root,
        repoRootPath: root,
        routeAuditScriptPath: emptyAudit,
        isVercel: false,
      }),
      /\[route-inventory\] Generated inventory is empty or malformed/,
    );
  } finally {
    rmSync(root, { recursive: true, force: true });
  }
});
