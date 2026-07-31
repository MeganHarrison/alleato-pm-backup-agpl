#!/usr/bin/env node

/**
 * Create an authenticated agent-browser state for the configured app origin.
 *
 * This intentionally reuses the Playwright auth setup. The default `user` role
 * reads TEST_USER_1 and TEST_PASSWORD_1; `--role admin` requires a separate
 * pre-existing allowlisted identity from ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD.
 * The admin path never creates or resets the account. Both roles verify a
 * protected route before writing state, preventing an anonymous login-page
 * screenshot from being mistaken for proof of a product surface.
 */
import { execFileSync } from "node:child_process";
import { existsSync } from "node:fs";
import { resolve } from "node:path";

const baseUrl = process.env.AUTH_BASE_URL ?? process.env.BASE_URL ?? "http://localhost:3000";
const root = resolve(import.meta.dirname, "../..");
const frontend = resolve(root, "frontend");
const roleIndex = process.argv.indexOf("--role");
const role = roleIndex === -1 ? "user" : process.argv[roleIndex + 1];

if (!["user", "admin"].includes(role)) {
  throw new Error(`Unsupported auth role '${role ?? ""}'. Use --role user or --role admin.`);
}

const isAdmin = role === "admin";
const adminEmail = process.env.ADMIN_E2E_EMAIL;
const adminPassword = process.env.ADMIN_E2E_PASSWORD;

if (isAdmin && (!adminEmail || !adminPassword)) {
  throw new Error(
    [
      "Admin browser authentication requires ADMIN_E2E_EMAIL and ADMIN_E2E_PASSWORD.",
      "Cause: the normal test identity is not allowlisted for admin routes.",
      "Detection gap: the prior bootstrap always produced normal-user state, then failed at admin authorization.",
      "Prevention: configure a separate pre-existing allowlisted admin test identity; this command will not create or reset it.",
    ].join(" "),
  );
}

const authFile = resolve(frontend, isAdmin ? "tests/.auth/admin.json" : "tests/.auth/user.json");

execFileSync(
  "npx",
  [
    "playwright",
    "test",
    "tests/auth.setup.ts",
    "--config=tests/playwright.config.ts",
    "--project=setup",
  ],
  {
    cwd: frontend,
    env: {
      ...process.env,
      AUTH_BASE_URL: baseUrl,
      BASE_URL: baseUrl,
      PLAYWRIGHT_TEST_DIR: ".",
      AUTH_STORAGE_STATE_PATH: authFile,
      ...(isAdmin
        ? {
            TEST_USER_1: adminEmail,
            TEST_PASSWORD_1: adminPassword,
            AUTH_SETUP_PRESERVE_EXISTING_USER: "true",
            AUTH_SETUP_REQUIRE_EXISTING_USER: "true",
          }
        : {}),
    },
    stdio: "inherit",
  },
);

if (!existsSync(authFile)) {
  throw new Error(`Auth setup completed without creating ${authFile}`);
}

console.log(`Authenticated ${role} browser state ready: ${authFile}`);
console.log("Load it into agent-browser with:");
console.log(`agent-browser state load ${authFile}`);
