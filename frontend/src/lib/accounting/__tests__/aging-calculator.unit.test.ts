import { classifyAgingBucket, detectGuardrailAlerts } from "../aging-calculator";

/**
 * Regression test for the classifyAgingBucket label mismatch.
 *
 * Root cause: the function returned "1-30" for days 31–60 and "31-60" for
 * days 61–90. The label "61-90" was declared in the return type but was
 * unreachable — the function jumped from "31-60" straight to "90+".
 *
 * Fix: corrected bucket boundaries to match their labels:
 *   ≤30  → "current"
 *   ≤60  → "31-60"
 *   ≤90  → "61-90"
 *   >90  → "90+"
 *
 * Impact: dashboard/route.ts branches on label strings ("1-30" / "31-60") to
 * populate AR/AP aging buckets. Wrong labels caused the 31–60-day bucket to
 * receive amounts that were actually 61–90 days overdue, and the 61–90-day
 * bucket was never populated.
 */

describe("classifyAgingBucket — AR/AP aging label assignment", () => {
  describe("current bucket (0–30 days)", () => {
    it("returns 'current' for 0 days outstanding", () => {
      expect(classifyAgingBucket(0)).toBe("current");
    });

    it("returns 'current' for 15 days outstanding", () => {
      expect(classifyAgingBucket(15)).toBe("current");
    });

    it("returns 'current' for exactly 30 days (boundary)", () => {
      expect(classifyAgingBucket(30)).toBe("current");
    });
  });

  describe("31–60 day bucket", () => {
    it("returns '31-60' for 31 days outstanding (boundary)", () => {
      // Regression: before fix this returned "1-30"
      expect(classifyAgingBucket(31)).toBe("31-60");
    });

    it("returns '31-60' for 45 days outstanding", () => {
      expect(classifyAgingBucket(45)).toBe("31-60");
    });

    it("returns '31-60' for exactly 60 days (boundary)", () => {
      expect(classifyAgingBucket(60)).toBe("31-60");
    });
  });

  describe("61–90 day bucket", () => {
    it("returns '61-90' for 61 days outstanding (boundary)", () => {
      // Regression: before fix this returned "31-60"; "61-90" was unreachable
      expect(classifyAgingBucket(61)).toBe("61-90");
    });

    it("returns '61-90' for 75 days outstanding", () => {
      expect(classifyAgingBucket(75)).toBe("61-90");
    });

    it("returns '61-90' for exactly 90 days (boundary)", () => {
      expect(classifyAgingBucket(90)).toBe("61-90");
    });
  });

  describe("90+ day bucket", () => {
    it("returns '90+' for 91 days outstanding (boundary)", () => {
      expect(classifyAgingBucket(91)).toBe("90+");
    });

    it("returns '90+' for 180 days outstanding", () => {
      expect(classifyAgingBucket(180)).toBe("90+");
    });
  });
});

describe("detectGuardrailAlerts — duplicate payment detection", () => {
  it("flags near-duplicate outgoing checks for the same vendor and amount", () => {
    const alerts = detectGuardrailAlerts({
      checks: [
        {
          reference_nbr: "002190",
          vendor_id: "JOBPLANNER",
          vendor_name: "JOBPLANNER",
          payment_ref: "ACH-100",
          payment_amount: 1250,
          application_date: "2026-05-01",
          status: "Closed",
          cash_account: "OPERATING",
        },
        {
          reference_nbr: "002191",
          vendor_id: "JOBPLANNER",
          vendor_name: "JOBPLANNER",
          payment_ref: "ACH-101",
          payment_amount: 1250,
          application_date: "2026-05-01",
          status: "Closed",
          cash_account: "OPERATING",
        },
      ],
      payments: [],
    });

    expect(alerts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          category: "near_duplicate_outgoing_check",
          title: "Potential near-duplicate outgoing payment",
          references: ["002190", "002191"],
        }),
      ]),
    );
  });

  it("does not flag voided outgoing checks", () => {
    const alerts = detectGuardrailAlerts({
      checks: [
        {
          reference_nbr: "002190",
          vendor_id: "JOBPLANNER",
          vendor_name: "JOBPLANNER",
          payment_ref: "ACH-100",
          payment_amount: 1250,
          application_date: "2026-05-01",
          status: "Voided",
          cash_account: "OPERATING",
        },
        {
          reference_nbr: "002191",
          vendor_id: "JOBPLANNER",
          vendor_name: "JOBPLANNER",
          payment_ref: "ACH-101",
          payment_amount: 1250,
          application_date: "2026-05-01",
          status: "Voided",
          cash_account: "OPERATING",
        },
      ],
      payments: [],
    });

    expect(alerts).toHaveLength(0);
  });
});
