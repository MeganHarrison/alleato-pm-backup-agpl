import assert from "node:assert/strict";
import test from "node:test";

import {
  needsProviderAuthEnvironment,
  providerAuthEnvironment,
  isAuthenticatedRouteUrl,
} from "../prepare-authenticated-browser.mjs";

test("links only when the worktree is not already attached to the canonical Vercel project", () => {
  assert.equal(needsProviderAuthEnvironment("project-management-agent"), false);
  assert.equal(needsProviderAuthEnvironment(null), true);
});

test("repairs a stale worktree link to a different Vercel project", () => {
  assert.equal(needsProviderAuthEnvironment("frontend"), true);
});

test("hydrates from the Vercel project that owns the canonical production route", () => {
  assert.deepEqual(providerAuthEnvironment(), {
    team: "the-alleato-group",
    project: "project-management-agent",
  });
});

test("accepts only an already-authenticated browser session on the requested origin", () => {
  assert.equal(isAuthenticatedRouteUrl("https://projects.alleatogroup.com/43/schedule", "https://projects.alleatogroup.com"), true);
  assert.equal(isAuthenticatedRouteUrl("https://projects.alleatogroup.com/auth/login?callbackUrl=%2F43%2Fschedule", "https://projects.alleatogroup.com"), false);
  assert.equal(isAuthenticatedRouteUrl("https://example.com/43/schedule", "https://projects.alleatogroup.com"), false);
});
