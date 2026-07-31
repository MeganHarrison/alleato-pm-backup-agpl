// Regression test for: 500 responses on auth failure because routes used a
// `code: "..."` value not registered in ERROR_CATALOG. The wrapper falls back
// to INTERNAL_ERROR (500) on unknown codes, so a typo or unregistered code
// silently turns a 401 into a 500. This test fails the build if any route
// passes a string literal to `code:` that isn't a key in ERROR_CATALOG.
//
// Detection gap before this test existed: api-smoke-contracts.mjs caught the
// production symptom but only flagged it; no compile- or test-time guardrail
// prevented landing the bad code in the first place. Now:
//   * GuardrailErrorOptions.code is `keyof typeof ERROR_CATALOG` (compile-time)
//   * This test scans every code: "..." literal in api/ (test-time)
//   * api-smoke-contracts.mjs asserts no production 500 on auth (deploy-time)
//
// Layered defenses — losing any one of them shouldn't recreate the original 500.

import { readdirSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { ERROR_CATALOG } from "../error-catalog";

const API_ROOT = join(__dirname, "..", "..", "..", "app", "api");
// Match `code: "X"` only when it's the first property of a `new GuardrailError({...})`
// or `asGuardrailError(..., { ... })` literal — i.e. the catalog code, not arbitrary
// `details: { code: "X" }` payload identifiers used for client-side dispatch.
const GUARDRAIL_CODE_RE =
  /(?:new\s+GuardrailError|asGuardrailError\s*\([^,]+,)\s*\(?\s*\{\s*code:\s*"([A-Z][A-Z0-9_]*)"/g;

function walkTsFiles(dir: string): string[] {
  const out: string[] = [];
  const entries = readdirSync(dir);
  for (const entry of entries) {
    const full = join(dir, entry);
    const stat = statSync(full);
    if (stat.isDirectory()) {
      // Skip jest/__tests__ dirs to avoid false hits on test fixtures.
      if (entry === "__tests__" || entry === "node_modules") continue;
      out.push(...walkTsFiles(full));
    } else if (entry.endsWith(".ts") || entry.endsWith(".tsx")) {
      out.push(full);
    }
  }
  return out;
}

describe("error catalog coverage", () => {
  it("every `code: \"X\"` literal used in api/ exists in ERROR_CATALOG", () => {
    const knownCodes = new Set(Object.keys(ERROR_CATALOG));
    const violations: Array<{ file: string; code: string }> = [];

    const files = walkTsFiles(API_ROOT);
    for (const file of files) {
      const text = readFileSync(file, "utf8");
      for (const match of text.matchAll(GUARDRAIL_CODE_RE)) {
        const code = match[1];
        if (!knownCodes.has(code)) {
          const rel = file.replace(/^.*?\/src\//, "src/");
          violations.push({ file: rel, code });
        }
      }
    }

    if (violations.length > 0) {
      const lines = violations
        .map(({ file, code }) => `  - ${file}: code: "${code}"`)
        .join("\n");
      throw new Error(
        `Found ${violations.length} code literal(s) in api/ that are NOT in ERROR_CATALOG. ` +
          `Routes using these codes return 500 on the error path because ` +
          `getErrorCatalogEntry falls back to INTERNAL_ERROR. Add the missing ` +
          `code to frontend/src/lib/guardrails/error-catalog.ts:\n${lines}`,
      );
    }
  });

  it("every catalog entry has a sane HTTP status", () => {
    for (const [code, entry] of Object.entries(ERROR_CATALOG)) {
      expect(entry.code).toBe(code); // self-referential check
      expect(entry.httpStatus).toBeGreaterThanOrEqual(400);
      expect(entry.httpStatus).toBeLessThan(600);
    }
  });

  it("UNAUTHORIZED and AUTH_EXPIRED both map to 401 — never let auth fall through to 500", () => {
    expect(ERROR_CATALOG.UNAUTHORIZED.httpStatus).toBe(401);
    expect(ERROR_CATALOG.AUTH_EXPIRED.httpStatus).toBe(401);
  });
});
