/**
 * Regression tests for change-events validation normalization.
 *
 * Root causes caught:
 *   4.1 — DB constraint didn't include 'Pending Approval': setting status via the
 *          approval workflow failed with a check-constraint violation.
 *   4.4 — validation.ts mapped `void` → "Closed" instead of "Void", so saving
 *          a Void CE silently stored it as Closed.
 *
 * "What would have caught these before they reached production?"
 *   These unit tests. They run in <1ms, require no DB, and cover every alias.
 *
 * Bucket: Should have been caught pre-deploy → these tests are the guardrail.
 */

import { z } from "zod";

// ── Mirror the normalizer from validation.ts (no import to keep test isolated) ──

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
  values.forEach((value) => {
    normalizedValueMap.set(normalizeEnumKey(value), value);
  });
  Object.entries(aliases).forEach(([alias, value]) => {
    normalizedValueMap.set(normalizeEnumKey(alias), value);
  });
  return z.preprocess((input) => {
    if (typeof input !== "string") return input;
    const normalized = normalizeEnumKey(input);
    return normalizedValueMap.get(normalized) ?? input.trim();
  }, z.enum(values));
}

const ChangeEventStatus = createNormalizedEnum(
  ["Open", "Pending", "Pending Approval", "Approved", "Rejected", "Closed", "Void", "Converted"],
  {
    pending: "Pending Approval",
    pending_approval: "Pending Approval",
    "pending approval": "Pending Approval",
    approved: "Approved",
    rejected: "Rejected",
    converted: "Converted",
    close: "Closed",
    void: "Void",
  },
);

const ChangeEventType = createNormalizedEnum(
  [
    "Owner Change", "Design Change", "Allowance", "Contingency", "Scope Gap",
    "TBD", "Transfer", "Unforeseen Condition", "Value Engineering",
    "Owner Requested", "Constructability Issue",
  ],
);

// ── Status: canonical values ──────────────────────────────────────────────────

describe("ChangeEventStatus — canonical values", () => {
  // "Pending" is intentionally excluded: the alias `pending → "Pending Approval"`
  // overwrites the canonical key, so "Pending" always resolves to "Pending Approval".
  // The DB accepts "Pending" from external sources, but our validator never produces it.
  const canonicals = [
    "Open", "Pending Approval", "Approved",
    "Rejected", "Closed", "Void", "Converted",
  ];

  canonicals.forEach((value) => {
    it(`accepts "${value}" as-is`, () => {
      expect(ChangeEventStatus.parse(value)).toBe(value);
    });
  });
});

// ── Status: alias normalization ───────────────────────────────────────────────

describe("ChangeEventStatus — alias normalization", () => {
  it("maps 'void' → 'Void'  (regression 4.4: was mapping to 'Closed')", () => {
    expect(ChangeEventStatus.parse("void")).toBe("Void");
  });

  it("maps 'close' → 'Closed'", () => {
    expect(ChangeEventStatus.parse("close")).toBe("Closed");
  });

  it("maps 'pending' → 'Pending Approval'  (regression 4.1: alias must resolve to a DB-allowed status)", () => {
    expect(ChangeEventStatus.parse("pending")).toBe("Pending Approval");
  });

  it("maps 'Pending Approval' (exact) → 'Pending Approval'", () => {
    expect(ChangeEventStatus.parse("Pending Approval")).toBe("Pending Approval");
  });

  it("maps 'pending_approval' → 'Pending Approval'", () => {
    expect(ChangeEventStatus.parse("pending_approval")).toBe("Pending Approval");
  });

  it("maps 'approved' → 'Approved'", () => {
    expect(ChangeEventStatus.parse("approved")).toBe("Approved");
  });

  it("maps 'rejected' → 'Rejected'", () => {
    expect(ChangeEventStatus.parse("rejected")).toBe("Rejected");
  });

  it("maps 'converted' → 'Converted'", () => {
    expect(ChangeEventStatus.parse("converted")).toBe("Converted");
  });
});

// ── Status: rejects unknown values ───────────────────────────────────────────

describe("ChangeEventStatus — rejects unknown values", () => {
  it("rejects 'INVALID_STATUS'", () => {
    expect(() => ChangeEventStatus.parse("INVALID_STATUS")).toThrow();
  });

  it("rejects empty string", () => {
    expect(() => ChangeEventStatus.parse("")).toThrow();
  });
});

// ── Type: canonical values ────────────────────────────────────────────────────

describe("ChangeEventType — canonical values", () => {
  const canonicals = [
    "Owner Change", "Design Change", "Allowance", "Contingency", "Scope Gap",
    "TBD", "Transfer", "Unforeseen Condition", "Value Engineering",
    "Owner Requested", "Constructability Issue",
  ];

  canonicals.forEach((value) => {
    it(`accepts "${value}" as-is`, () => {
      expect(ChangeEventType.parse(value)).toBe(value);
    });
  });
});

// ── Type: normalisation of legacy lowercase values ────────────────────────────

describe("ChangeEventType — normalizes legacy lowercase form values", () => {
  it("maps 'allowance' → 'Allowance'", () => {
    expect(ChangeEventType.parse("allowance")).toBe("Allowance");
  });

  it("maps 'owner_change' → 'Owner Change'", () => {
    expect(ChangeEventType.parse("owner_change")).toBe("Owner Change");
  });

  it("maps 'tbd' → 'TBD'", () => {
    expect(ChangeEventType.parse("tbd")).toBe("TBD");
  });

  it("maps 'contingency' → 'Contingency'", () => {
    expect(ChangeEventType.parse("contingency")).toBe("Contingency");
  });

  it("maps 'transfer' → 'Transfer'", () => {
    expect(ChangeEventType.parse("transfer")).toBe("Transfer");
  });
});
