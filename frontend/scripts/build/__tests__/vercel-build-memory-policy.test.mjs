import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildScript = path.resolve(testDirectory, "../run-production-build.mjs");

test("Vercel production builds reserve the proven 11 GB V8 heap", () => {
  const source = readFileSync(buildScript, "utf8");

  assert.match(
    source,
    /isVercel \? "--max-old-space-size=11264" : "--max-old-space-size=16384"/u,
  );
});
