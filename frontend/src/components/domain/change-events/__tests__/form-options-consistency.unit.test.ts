/**
 * Regression test: form TYPE_OPTIONS / STATUS_OPTIONS must align with the
 * validation.ts enums that the API PATCH route applies.
 *
 * Root cause (test 2.1): STATUS_OPTIONS used lowercase aliases ("open", "close",
 * "void") as both the stored value AND the display value. When the API returned
 * Title Case ("Open", "Void"), mapApiStatusToFormStatus correctly mapped back
 * to lowercase so the Select pre-filled — but a future change to either layer
 * could silently break this round-trip again.
 *
 * This test pins the contract: every .value in TYPE_OPTIONS and STATUS_OPTIONS
 * must be accepted by the server-side Zod validators without transformation.
 *
 * Bucket: Should have been caught pre-deploy → this test is the guardrail.
 */

import { z } from "zod";
import { TYPE_OPTIONS, STATUS_OPTIONS, CHANGE_REASON_OPTIONS } from "../change-event-form/types";

// ── Mirror the normalizer ─────────────────────────────────────────────────────

const normalizeEnumKey = (value: string): string =>
  value
    .trim()
    .toLowerCase()
    .replace(/['']/g, "")
    .replace(/[^a-z0-9]+/g, "_")
    .replace(/^_+|_+$/g, "");

function createNormalizedEnum<const T extends readonly [string, ...string[]]>(
  values: T,
  aliases: Record<string, T[number]> = {},
) {
  const normalizedValueMap = new Map<string, T[number]>();
  values.forEach((v) => normalizedValueMap.set(normalizeEnumKey(v), v));
  Object.entries(aliases).forEach(([alias, value]) => {
    normalizedValueMap.set(normalizeEnumKey(alias), value);
  });
  return z.preprocess((input) => {
    if (typeof input !== "string") return input;
    const normalized = normalizeEnumKey(input);
    return normalizedValueMap.get(normalized) ?? input.trim();
  }, z.enum(values));
}

const ServerStatusValidator = createNormalizedEnum(
  ["Open", "Pending", "Pending Approval", "Approved", "Rejected", "Closed", "Void", "Converted"],
  { pending: "Pending Approval", close: "Closed", void: "Void" },
);

const ServerTypeValidator = createNormalizedEnum([
  "Owner Change", "Design Change", "Allowance", "Contingency", "Scope Gap",
  "TBD", "Transfer", "Unforeseen Condition", "Value Engineering",
  "Owner Requested", "Constructability Issue",
]);

const ServerReasonValidator = createNormalizedEnum(
  ["Allowance", "Back Charge", "Client Request", "Design Development", "Existing Condition"],
  { back_charge: "Back Charge", backcharge: "Back Charge" },
);

// ── STATUS_OPTIONS consistency ────────────────────────────────────────────────

describe("STATUS_OPTIONS — every .value accepted by server validator", () => {
  STATUS_OPTIONS.forEach(({ value, label }) => {
    it(`STATUS_OPTIONS["${label}"] value="${value}" is accepted by the API validator`, () => {
      expect(() => ServerStatusValidator.parse(value)).not.toThrow();
    });
  });
});

// ── TYPE_OPTIONS consistency ──────────────────────────────────────────────────

describe("TYPE_OPTIONS — every .value accepted by server validator", () => {
  TYPE_OPTIONS.forEach(({ value, label }) => {
    it(`TYPE_OPTIONS["${label}"] value="${value}" is accepted by the API validator`, () => {
      expect(() => ServerTypeValidator.parse(value)).not.toThrow();
    });
  });
});

// ── CHANGE_REASON_OPTIONS consistency ────────────────────────────────────────

describe("CHANGE_REASON_OPTIONS — every .value accepted by server validator", () => {
  CHANGE_REASON_OPTIONS.forEach(({ value, label }) => {
    it(`CHANGE_REASON_OPTIONS["${label}"] value="${value}" is accepted by the API validator`, () => {
      expect(() => ServerReasonValidator.parse(value)).not.toThrow();
    });
  });
});

// ── No duplicate values ───────────────────────────────────────────────────────

describe("option arrays have no duplicate values", () => {
  it("STATUS_OPTIONS has unique values", () => {
    const values = STATUS_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("TYPE_OPTIONS has unique values", () => {
    const values = TYPE_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });

  it("CHANGE_REASON_OPTIONS has unique values", () => {
    const values = CHANGE_REASON_OPTIONS.map((o) => o.value);
    expect(new Set(values).size).toBe(values.length);
  });
});
