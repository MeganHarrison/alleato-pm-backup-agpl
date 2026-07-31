import assert from "node:assert/strict";
import test from "node:test";

import { agentBrowserCookieSetArgs } from "../prepare-authenticated-browser.mjs";

test("hydrates a named agent-browser session without relying on daemon-ignored state", () => {
  const args = agentBrowserCookieSetArgs(
    {
      name: "sb-project-auth-token",
      value: "redacted",
      secure: true,
      httpOnly: true,
      sameSite: "Lax",
      expires: 1_800_000_000,
    },
    "https://projects.alleatogroup.com",
    "schedule-proof",
  );

  assert.deepEqual(args, [
    "--session",
    "schedule-proof",
    "cookies",
    "set",
    "sb-project-auth-token",
    "redacted",
    "--url",
    "https://projects.alleatogroup.com",
    "--secure",
    "--httpOnly",
    "--sameSite",
    "Lax",
    "--expires",
    "1800000000",
  ]);
  assert.equal(args.includes("--state"), false);
});
