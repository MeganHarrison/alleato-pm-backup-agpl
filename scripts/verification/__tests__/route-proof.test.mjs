import assert from "node:assert/strict";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import test from "node:test";

import {
  acquireBrowserLock,
  authStatePathForOrigin,
  classifyProtectedLanding,
  hasUsableAuthState,
  parseArgs,
} from "../route-proof.mjs";

function jwt(exp) {
  return [
    Buffer.from(JSON.stringify({ alg: "none" })).toString("base64url"),
    Buffer.from(JSON.stringify({ exp })).toString("base64url"),
    "signature",
  ].join(".");
}

test("route proof defaults to the isolated QA port and two viewport capture", () => {
  const options = parseArgs(["--route", "/tasks", "--name", "task-proof"]);
  assert.equal(options.targetUrl, "http://localhost:3100/tasks");
  assert.equal(options.desktopOnly, false);
  assert.equal(options.headed, false);
});

test("origin-scoped auth paths keep local and production sessions separate", () => {
  assert.notEqual(
    authStatePathForOrigin("http://localhost:3100"),
    authStatePathForOrigin("https://projects.alleatogroup.com"),
  );
});

test("usable auth state requires the right origin, security mode, and TTL", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "route-proof-auth-"));
  const authPath = path.join(tempDir, "user.json");
  const now = Date.now();
  const session = { access_token: jwt(Math.floor(now / 1000) + 3600) };
  fs.writeFileSync(
    authPath,
    JSON.stringify({
      cookies: [
        {
          name: "sb-project-auth-token",
          value: `base64-${Buffer.from(JSON.stringify(session)).toString("base64")}`,
          domain: "projects.alleatogroup.com",
          secure: true,
        },
      ],
    }),
  );

  assert.equal(
    hasUsableAuthState(authPath, "https://projects.alleatogroup.com", now),
    true,
  );
  assert.equal(
    hasUsableAuthState(authPath, "http://localhost:3100", now),
    false,
  );
  fs.rmSync(tempDir, { recursive: true, force: true });
});

test("protected-route failures are classified before screenshots", () => {
  assert.deepEqual(
    classifyProtectedLanding(
      "https://projects.alleatogroup.com/auth/login?callbackUrl=%2Ftasks",
    ),
    { kind: "login" },
  );
  assert.deepEqual(
    classifyProtectedLanding(
      "https://projects.alleatogroup.com/access-denied?reason=no-profile",
    ),
    { kind: "access-denied", reason: "no-profile" },
  );
});

test("browser ownership lock rejects an overlapping proof and releases cleanly", () => {
  const tempDir = fs.mkdtempSync(path.join(os.tmpdir(), "route-proof-lock-"));
  const lockPath = path.join(tempDir, "browser.lock.json");
  const release = acquireBrowserLock("first-proof", lockPath);
  assert.throws(
    () => acquireBrowserLock("second-proof", lockPath),
    /already owned by PID/,
  );
  release();
  assert.equal(fs.existsSync(lockPath), false);
  fs.rmSync(tempDir, { recursive: true, force: true });
});
