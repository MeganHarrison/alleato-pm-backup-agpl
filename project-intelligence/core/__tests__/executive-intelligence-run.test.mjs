import assert from "node:assert/strict";
import test from "node:test";

import {
  assertPublishableRun,
  isPublishableRun,
  publishabilityFailures,
} from "../executive-intelligence-run.mjs";

const completed = {
  id: "packet-1",
  compiler_version: "manual_daily_executive_brief_v1",
  packet_type: "current",
  freshness_status: "fresh",
  business_date: "2026-07-20",
  run_contract: { status: "completed" },
};

test("accepts one completed, fresh current Executive Intelligence Run", () => {
  assert.equal(isPublishableRun(completed, { businessDate: "2026-07-20" }), true);
  assert.deepEqual(publishabilityFailures(completed, { businessDate: "2026-07-20" }), []);
  assert.equal(assertPublishableRun(completed), completed);
});

test("rejects a current packet that is not a completed run", () => {
  const staged = { ...completed, freshness_status: "working_sample", run_contract: { status: "staged" } };
  assert.equal(isPublishableRun(staged), false);
  assert.throws(() => assertPublishableRun(staged), /not a completed Executive Intelligence Run/);
  assert.deepEqual(publishabilityFailures(staged), [
    "freshness_status='working_sample'",
    "run_contract.status='staged'",
  ]);
});
