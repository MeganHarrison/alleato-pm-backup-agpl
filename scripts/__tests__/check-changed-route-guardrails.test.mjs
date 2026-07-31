import test from "node:test";
import assert from "node:assert/strict";

import {
  lineHasRawErrorResponse,
  resolveRawErrorEnforcement,
} from "../check-changed-route-guardrails.mjs";

test("changed-route guardrails enforce raw-error debt by default", () => {
  assert.equal(
    resolveRawErrorEnforcement({
      guardrailScope: "changed",
      envValue: undefined,
    }),
    true,
  );
});

test("full-route debt scans remain non-blocking for raw-error debt by default", () => {
  assert.equal(
    resolveRawErrorEnforcement({
      guardrailScope: "all",
      envValue: undefined,
    }),
    false,
  );
});

test("explicit environment override still wins", () => {
  assert.equal(
    resolveRawErrorEnforcement({
      guardrailScope: "all",
      envValue: "true",
    }),
    true,
  );
  assert.equal(
    resolveRawErrorEnforcement({
      guardrailScope: "changed",
      envValue: "false",
    }),
    false,
  );
});

test("raw error detector matches only raw response lines", () => {
  assert.equal(
    lineHasRawErrorResponse('return NextResponse.json({ error: "Invalid ID" }, { status: 400 });'),
    true,
  );
  assert.equal(
    lineHasRawErrorResponse('throw new GuardrailError({ code: "INVALID_PAYLOAD", message: "Invalid ID" });'),
    false,
  );
});
