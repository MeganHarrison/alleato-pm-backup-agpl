import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

const testDirectory = path.dirname(fileURLToPath(import.meta.url));
const buildScript = path.resolve(testDirectory, "../run-production-build.mjs");
const nextConfig = path.resolve(testDirectory, "../../../next.config.ts");

test("Vercel production builds preserve container headroom", () => {
  const source = readFileSync(buildScript, "utf8");

  assert.match(
    source,
    /isVercel \? "--max-old-space-size=7168" : "--max-old-space-size=16384"/u,
  );
});

test("Vercel production builds do not serialize a discarded webpack cache", () => {
  const source = readFileSync(nextConfig, "utf8");

  assert.match(source, /if \(process\.env\.VERCEL\) \{\s*config\.cache = false;/u);
});
