import assert from "node:assert/strict";
import test from "node:test";

import {
  nextRetryAt,
  recoveryDecision,
  retryDelayMinutes,
} from "../executive-intelligence-recovery.mjs";

test("retry delays are bounded exponential backoff", () => {
  assert.equal(retryDelayMinutes(1), 15);
  assert.equal(retryDelayMinutes(2), 30);
  assert.equal(retryDelayMinutes(5), 180);
  assert.equal(nextRetryAt("2026-07-21T10:00:00.000Z", 2), "2026-07-21T10:30:00.000Z");
});

test("missing and due failed runs are startable, but not-yet-due failures wait", () => {
  const now = "2026-07-21T10:00:00.000Z";
  assert.deepEqual(recoveryDecision(now, null), { action: "start", reason: "no_durable_scheduler_run" });
  assert.equal(recoveryDecision(now, { status: "failed_retryable", attempt_count: 1, next_attempt_at: "2026-07-21T10:14:00.000Z" }).action, "skip");
  assert.equal(recoveryDecision(now, { status: "failed_retryable", attempt_count: 1, next_attempt_at: "2026-07-21T10:00:00.000Z" }).action, "resume");
});

test("retry budget exhaustion is loud and terminal", () => {
  assert.deepEqual(
    recoveryDecision("2026-07-21T10:00:00.000Z", { status: "failed_retryable", attempt_count: 4, next_attempt_at: null }),
    { action: "fail", reason: "retry_budget_exhausted" },
  );
});

test("a crashed stale running attempt can be resumed within the retry budget", () => {
  assert.deepEqual(
    recoveryDecision("2026-07-21T11:00:00.000Z", {
      status: "running",
      attempt_count: 1,
      started_at: "2026-07-21T10:00:00.000Z",
    }),
    { action: "resume", reason: "stale_scheduler_run" },
  );
});
