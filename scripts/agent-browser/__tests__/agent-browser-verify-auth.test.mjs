import assert from "node:assert/strict";
import test from "node:test";

import {
  appendNodePath,
  classifyProtectedLanding,
  extractBrowserErrors,
  mergeMissingAuthEnvironment,
  resolveTarget,
} from "../agent-browser-verify.mjs";

test("classifies login redirects as a recoverable authentication failure", () => {
  assert.deepEqual(
    classifyProtectedLanding("https://projects.alleatogroup.com/auth/login?callbackUrl=%2F43%2Fschedule"),
    { kind: "login" },
  );
});

test("classifies access-denied landings with the server reason", () => {
  assert.deepEqual(
    classifyProtectedLanding("https://projects.alleatogroup.com/access-denied?reason=no-profile"),
    { kind: "access-denied", reason: "no-profile" },
  );
});

test("allows a canonical protected route once it remains on that route", () => {
  assert.equal(
    classifyProtectedLanding("https://projects.alleatogroup.com/43/schedule"),
    null,
  );
});

test("resolves the ergonomic route form against its selected app origin", () => {
  assert.deepEqual(
    resolveTarget({ baseUrl: "http://localhost:3000", route: "/43/schedule?tab=lookahead", url: "" }),
    {
      baseUrl: "http://localhost:3000",
      targetUrl: "http://localhost:3000/43/schedule?tab=lookahead",
      route: "/43/schedule?tab=lookahead",
    },
  );
});

test("keeps the legacy full URL form available for existing callers", () => {
  assert.deepEqual(
    resolveTarget({ baseUrl: "http://localhost:3000", route: "/tasks", url: "https://projects.alleatogroup.com/43/schedule" }),
    {
      baseUrl: "https://projects.alleatogroup.com",
      targetUrl: "https://projects.alleatogroup.com/43/schedule",
      route: "/43/schedule",
    },
  );
});

test("adds the shared dependency root without discarding an existing Node module path", () => {
  const result = appendNodePath("/existing/dependencies", "/shared/frontend/node_modules");
  assert.ok(result.startsWith("/shared/frontend/node_modules"));
  assert.ok(result.endsWith("/existing/dependencies"));
});

test("uses only missing secure auth values from the shared workspace", () => {
  const environment = { TEST_USER_1: "already-configured@example.com" };
  mergeMissingAuthEnvironment(
    environment,
    [
      "TEST_USER_1=must-not-replace@example.com",
      "TEST_PASSWORD_1=secure-password",
      "SUPABASE_SERVICE_ROLE_KEY=secure-service-role",
      "UNRELATED_VALUE=ignored",
    ].join("\n"),
  );

  assert.deepEqual(environment, {
    TEST_USER_1: "already-configured@example.com",
    TEST_PASSWORD_1: "secure-password",
    SUPABASE_SERVICE_ROLE_KEY: "secure-service-role",
  });
});

test("fails evidence runs on browser-reported errors instead of hiding a broken page behind a screenshot", () => {
  assert.deepEqual(
    extractBrowserErrors(
      "[info] route loaded\n[error] Failed to load resource: server returned 500\n[warning] ignored",
      "",
    ),
    ["[error] Failed to load resource: server returned 500"],
  );
});
