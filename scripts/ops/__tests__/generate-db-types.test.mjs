import assert from "node:assert/strict";
import fs from "node:fs";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import { isCliFallbackEligible } from "../../generate-db-types.mjs";

test("falls back when the current CLI rejects a valid versioned management token", () => {
  assert.equal(
    isCliFallbackEligible(
      '{"error":{"code":"LegacyInvalidAccessTokenError","message":"Invalid access token format."}}',
    ),
    true,
  );
});

test("does not hide unrelated type-generation failures", () => {
  assert.equal(isCliFallbackEligible("unexpected schema parser failure"), false);
  assert.equal(isCliFallbackEligible("permission denied for schema public"), false);
});

test("loads the shared machine environment before checkout-local env files", () => {
  const source = fs.readFileSync(
    path.resolve(path.dirname(fileURLToPath(import.meta.url)), "../../generate-db-types.mjs"),
    "utf8",
  );
  const machineIndex = source.indexOf('path.join(os.homedir(), ".codex", "capabilities"');
  const checkoutIndex = source.indexOf('loadEnvFile(".env")');
  assert.ok(machineIndex >= 0 && machineIndex < checkoutIndex);
});
