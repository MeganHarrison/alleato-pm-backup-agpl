#!/usr/bin/env node

// Compatibility entrypoint. The canonical browser lifecycle now lives in the
// Playwright-backed route-proof harness so Windows never depends on a blocked
// user-level agent-browser executable.
export * from "../verification/route-proof.mjs";

import path from "node:path";
import process from "node:process";
import { fileURLToPath } from "node:url";

import { runMain } from "../verification/route-proof.mjs";

if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  runMain().catch(() => {
    process.exitCode = 1;
  });
}
