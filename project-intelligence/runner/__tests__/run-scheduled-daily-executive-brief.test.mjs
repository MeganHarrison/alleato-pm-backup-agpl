import assert from "node:assert/strict";
import test from "node:test";

import {
  localScheduleDecision,
  parseWeekdays,
  previousBusinessDateInTimeZone,
} from "../daily-executive-brief-schedule.mjs";
import {
  assertCompletedDailyBriefPacket,
  markSchedulerFailure,
  resolveSchedulerExecutionDecision,
} from "../run-scheduled-daily-executive-brief.mjs";

test("runs at 6:00 AM New York during daylight time and skips the fallback UTC hour", () => {
  assert.equal(
    localScheduleDecision(new Date("2026-07-14T10:00:00.000Z")).shouldRun,
    true,
  );
  assert.equal(
    localScheduleDecision(new Date("2026-07-14T11:00:00.000Z")).shouldRun,
    false,
  );
});

test("runs at 6:00 AM New York during standard time and skips the daylight UTC hour", () => {
  assert.equal(
    localScheduleDecision(new Date("2026-01-13T10:00:00.000Z")).shouldRun,
    false,
  );
  assert.equal(
    localScheduleDecision(new Date("2026-01-13T11:00:00.000Z")).shouldRun,
    true,
  );
});

test("weekday schedule does not run on weekends", () => {
  assert.equal(
    localScheduleDecision(new Date("2026-07-12T10:00:00.000Z")).shouldRun,
    false,
  );
});

test("Monday generation selects Friday as the previous business date", () => {
  assert.equal(
    previousBusinessDateInTimeZone(new Date("2026-07-13T10:00:00.000Z")),
    "2026-07-10",
  );
});

test("Tuesday generation selects Monday as the previous business date", () => {
  assert.equal(
    previousBusinessDateInTimeZone(new Date("2026-07-14T10:00:00.000Z")),
    "2026-07-13",
  );
});

test("invalid weekday configuration fails loudly", () => {
  assert.throws(() => parseWeekdays("0,8"), /weekday numbers 1-7/);
});

test("scheduler accepts only a fresh current packet with a completed run receipt", () => {
  const packet = {
    id: "packet-1",
    business_date: "2026-07-20",
    compiler_version: "manual_daily_executive_brief_v1",
    packet_type: "current",
    freshness_status: "fresh",
    run_contract: { status: "completed" },
  };
  assert.equal(assertCompletedDailyBriefPacket(packet, { businessDate: "2026-07-20" }), packet);
  assert.throws(
    () =>
      assertCompletedDailyBriefPacket(
        { ...packet, packet_type: "snapshot", freshness_status: "working_sample", run_contract: { status: "staged" } },
        { businessDate: "2026-07-20" },
      ),
    /not a completed Executive Intelligence Run/,
  );
});

test("explicit regeneration overrides a succeeded scheduler recovery decision", () => {
  const succeededRecovery = {
    action: "skip",
    reason: "scheduler_run_already_succeeded",
  };

  assert.deepEqual(
    resolveSchedulerExecutionDecision({
      regenerate: true,
      recovery: succeededRecovery,
    }),
    { action: "resume", reason: "explicit_regeneration_requested" },
  );
  assert.equal(
    resolveSchedulerExecutionDecision({
      regenerate: false,
      recovery: succeededRecovery,
    }),
    succeededRecovery,
  );
});

test("scheduler failure persistence casts nullable timestamps explicitly", async () => {
  let query = null;
  const client = {
    async query(sql, parameters) {
      query = { sql, parameters };
    },
  };
  const current = new Date("2026-07-22T13:37:39.179Z");

  const result = await markSchedulerFailure(
    client,
    { id: "run-1", attempt_count: 14 },
    current,
    new Error("structured synthesis failed"),
    { maxAttempts: 5 },
  );

  assert.equal(result.terminal, true);
  assert.match(query.sql, /next_attempt_at = \$4::timestamptz/);
  assert.match(query.sql, /then \$5::timestamptz else null::timestamptz/);
  assert.equal(query.parameters[1], "failed_permanent");
  assert.equal(query.parameters[4], current.toISOString());
});
