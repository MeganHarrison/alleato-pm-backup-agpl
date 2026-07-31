import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import test from "node:test";
import { fileURLToPath } from "node:url";

const hookPath = fileURLToPath(
  new URL("../../../.codex/hooks/verify-feature-gate.py", import.meta.url),
);

function runHook(command) {
  try {
    execFileSync("python3", [hookPath], {
      cwd: "/tmp",
      input: JSON.stringify({ command }),
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
    });
    return { status: 0, output: "" };
  } catch (error) {
    return {
      status: error.status,
      output: `${error.stdout ?? ""}${error.stderr ?? ""}`,
    };
  }
}

test("blocks raw anonymous agent-browser navigation to protected Alleato routes", () => {
  const result = runHook(
    "agent-browser --session anonymous open http://localhost:3000/daily-brief",
  );

  assert.equal(result.status, 2);
  assert.match(result.output, /authenticated-browser readiness gate/);
  assert.match(result.output, /verify:browser-auth/);
});

test("allows protected navigation when the canonical auth state is explicit", () => {
  const result = runHook(
    "agent-browser --state frontend/tests/.auth/user.json --session-name proof open http://localhost:3000/daily-brief",
  );

  assert.equal(result.status, 0);
});

test("allows the login route without a preflight to preserve recovery", () => {
  const result = runHook(
    "agent-browser --session recovery open http://localhost:3000/auth/login",
  );

  assert.equal(result.status, 0);
});
