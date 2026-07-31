#!/usr/bin/env node
/**
 * Orphan-route gate (ratchet)
 * ===========================
 *
 * Prevents new top-level pages from being added without being reachable from
 * anywhere in the app — the root cause of route/page bulk accumulating over
 * time (a page gets built, superseded, or forgotten, and nothing prunes it).
 *
 * How "orphan" is defined here
 * ----------------------------
 * We reuse the exact route-enumeration + reference heuristic that already backs
 * the Page Access inventory (`route-inventory.mjs` -> `generateRouteInventory`).
 * A route's `refCount` is the number of source files that mention its route
 * string. An orphan is a page whose `refCount === 0` — no file references it.
 *
 * SCOPE — fully-static top-level routes only.
 * We intentionally gate ONLY routes with no dynamic segment (no `[...]`).
 * Dynamic detail pages (`/x/[id]`) and every project-scoped route
 * (`/[projectId]/...`) are reached via runtime template literals
 * (e.g. `` `/${projectId}/tasks` ``) that a static string scan cannot resolve,
 * so they legitimately show `refCount === 0` and are OUT OF SCOPE here. Gating
 * them would produce ~100 false positives. Static top-level routes, by
 * contrast, are normally linked with a literal href (`href="/megans-dashboard"`),
 * so `refCount === 0` is a trustworthy "nothing links here" signal.
 *
 * Membership in the baseline means "not statically linked", NOT "dead code".
 * Some baselined routes are reached by other means (admin deep links, redirect
 * targets, experiments). The baseline is the review list of those exceptions.
 *
 * Behaviour
 * ---------
 *   node scripts/build/check-orphan-routes.mjs
 *       Fails (exit 1) if a NEW static top-level orphan appears that is not in
 *       the baseline. Passes if the current orphan set is a subset of it.
 *
 *   node scripts/build/check-orphan-routes.mjs --write-baseline
 *       Rewrites the baseline to the current set. Use this when you have
 *       intentionally added an unlinked top-level route (and say why in the PR),
 *       or after you have deleted/linked one and want to prune the baseline.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { generateRouteInventory } from "./route-inventory.mjs";

const frontendRoot = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../..",
);
const baselinePath = path.join(
  frontendRoot,
  "scripts/build/orphan-routes.baseline.json",
);

function currentOrphanRoutes() {
  const { enriched } = generateRouteInventory({ frontendRoot });
  return enriched
    .filter(
      (route) =>
        route.kind === "page" &&
        route.refCount === 0 &&
        !route.route.includes("["),
    )
    .map((route) => route.route)
    .sort((left, right) => left.localeCompare(right));
}

function readBaselineRoutes() {
  if (!fs.existsSync(baselinePath)) {
    console.error(`[orphan-routes] Baseline missing: ${baselinePath}`);
    console.error(
      "[orphan-routes] Seed it with: node scripts/build/check-orphan-routes.mjs --write-baseline",
    );
    process.exit(1);
  }
  const parsed = JSON.parse(fs.readFileSync(baselinePath, "utf8"));
  return Array.isArray(parsed.routes) ? parsed.routes : [];
}

function writeBaseline(routes) {
  const payload = {
    note:
      "Top-level static page routes with no literal in-code reference. See docs/architecture/orphan-route-gate.md. Membership means 'not statically linked', NOT 'dead code'. Only fully-static routes are gated; dynamic ([param]) and project-scoped (/[projectId]/...) routes are out of scope because they are linked via runtime template literals a static scan cannot resolve.",
    updatedAt: "2026-07-30",
    count: routes.length,
    routes,
  };
  fs.writeFileSync(baselinePath, `${JSON.stringify(payload, null, 2)}\n`);
}

function main() {
  const shouldWrite = process.argv.includes("--write-baseline");
  const current = currentOrphanRoutes();

  if (shouldWrite) {
    writeBaseline(current);
    console.log(
      `[orphan-routes] Wrote baseline with ${current.length} route(s): ${baselinePath}`,
    );
    return;
  }

  const baseline = new Set(readBaselineRoutes());
  const added = current.filter((route) => !baseline.has(route));
  const resolved = [...baseline].filter((route) => !current.includes(route));

  console.log(
    `[orphan-routes] static top-level orphans: current=${current.length} baseline=${baseline.size}`,
  );

  if (resolved.length) {
    console.log(
      `[orphan-routes] ${resolved.length} baseline route(s) no longer orphaned — prune with --write-baseline: ${resolved.join(", ")}`,
    );
  }

  if (added.length) {
    console.error(
      "\n[orphan-routes] New unreferenced top-level page route(s) detected:",
    );
    for (const route of added) console.error(`  - ${route}`);
    console.error(
      "\nEvery user-facing page should be reachable. Resolve one of two ways:",
    );
    console.error(
      "  1. Wire the page into navigation (add a literal href/path so it is linked), or",
    );
    console.error(
      "  2. If it is intentionally unlinked (redirect target, deep-link only, experiment),",
    );
    console.error(
      "     run: node scripts/build/check-orphan-routes.mjs --write-baseline",
    );
    console.error("     and note why in your PR description.");
    process.exit(1);
  }

  console.log("[orphan-routes] OK — no new unreferenced top-level pages.");
}

main();
