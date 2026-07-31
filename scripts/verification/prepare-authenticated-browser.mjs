#!/usr/bin/env node

// Compatibility entrypoint for the former auth-only helper. Authentication is
// now one boundary inside route-proof.mjs, which validates the route and emits
// desktop/mobile proof instead of leaving an unmanaged browser behind.
export * from "./route-proof.mjs";

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runMain } from "./route-proof.mjs";

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runMain([...process.argv.slice(2), "--auth-only"]).catch(() => {
    process.exitCode = 1;
  });
}
