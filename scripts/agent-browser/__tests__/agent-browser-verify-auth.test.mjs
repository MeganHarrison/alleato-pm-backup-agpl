import assert from "node:assert/strict";
import test from "node:test";

import { classifyProtectedLanding } from "../agent-browser-verify.mjs";

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
