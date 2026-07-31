import {
  detectDuplicateBills,
  detectOnHoldBills,
  apDuplicateKey,
  type AcuApBill,
} from "../reconciliation";

function bill(overrides: Partial<AcuApBill> = {}): AcuApBill {
  return {
    externalKey: overrides.externalKey ?? `k${Math.random()}`,
    vendorId: "BEAM",
    vendorRef: "PI-0001",
    amount: 374416,
    balance: null,
    projectCode: "24115",
    status: "Open",
    hold: false,
    postPeriod: "122025",
    date: "2026-12-15",
    referenceNbr: "INV-1",
    documentType: "Bill",
    ...overrides,
  };
}

describe("detectDuplicateBills", () => {
  it("flags the same vendor+amount+project billed multiple times in one period as HIGH", () => {
    // Beam Electric $374,416 entered three times for the same job, same period —
    // one already paid (Closed), two still live (Hold).
    const bills = [
      bill({ externalKey: "a", referenceNbr: "374-a", status: "Closed" }),
      bill({ externalKey: "b", referenceNbr: "374-b", status: "Hold" }),
      bill({ externalKey: "c", referenceNbr: "374-c", status: "Hold" }),
    ];
    const findings = detectDuplicateBills(bills);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("duplicate-ap-bill");
    expect(findings[0].tier).toBe("HIGH");
    expect(findings[0].amountCents).toBe(374416 * 100 * 2); // (3 copies - 1) * amount
    expect(findings[0].recordType).toBe("ap_bill");
  });

  it("does NOT cluster identical amounts in different periods (legitimate recurring charge)", () => {
    const bills = [
      bill({ externalKey: "a", postPeriod: "012026" }),
      bill({ externalKey: "b", postPeriod: "022026" }),
    ];
    expect(detectDuplicateBills(bills)).toHaveLength(0);
  });

  it("ignores clusters that are entirely paid history (no live copy)", () => {
    const bills = [
      bill({ externalKey: "a", status: "Closed" }),
      bill({ externalKey: "b", status: "Closed" }),
    ];
    expect(detectDuplicateBills(bills)).toHaveLength(0);
  });

  it("ignores voided, zero, and single (non-duplicate) bills", () => {
    const bills = [
      bill({ externalKey: "solo", amount: 1000 }),
      bill({ externalKey: "v1", amount: 5000, status: "Voided" }),
      bill({ externalKey: "v2", amount: 5000, status: "Voided" }),
      bill({ externalKey: "z1", amount: 0 }),
      bill({ externalKey: "z2", amount: 0 }),
    ];
    expect(detectDuplicateBills(bills)).toHaveLength(0);
  });

  it("does not cluster bills from different vendors or projects", () => {
    const bills = [
      bill({ externalKey: "a", vendorId: "BEAM" }),
      bill({ externalKey: "b", vendorId: "DORSEY" }),
      bill({ externalKey: "c", projectCode: "25109" }),
    ];
    expect(detectDuplicateBills(bills)).toHaveLength(0);
  });

  it("confirms a duplicate when copies share a vendor invoice number", () => {
    const bills = [
      bill({ externalKey: "a", vendorRef: "PI-7654-0007", status: "Closed" }),
      bill({ externalKey: "b", vendorRef: "PI-7654-0007", status: "Open" }),
    ];
    expect(detectDuplicateBills(bills)[0].detail).toMatch(/confirmed duplicate/i);
  });

  it("asks for confirmation when copies have different vendor invoice numbers", () => {
    const bills = [
      bill({ externalKey: "a", vendorRef: "PI-1", status: "Open" }),
      bill({ externalKey: "b", vendorRef: "PI-2", status: "Open" }),
    ];
    expect(detectDuplicateBills(bills)[0].detail).toMatch(/confirm before voiding/i);
  });

  it("resolves a project name when a name map is provided", () => {
    const bills = [bill({ externalKey: "a" }), bill({ externalKey: "b" })];
    const findings = detectDuplicateBills(bills, (code) =>
      code === "24115" ? "Westfield Collective" : code,
    );
    expect(findings[0].jpProjectName).toContain("Westfield Collective");
  });
});

describe("detectOnHoldBills", () => {
  const asOf = "2026-06-17T00:00:00.000Z";

  it("emits one INFO finding per on-hold (status) bill with an age bucket", () => {
    const bills = [
      bill({ externalKey: "h1", status: "Hold", date: "2026-06-10" }),
      bill({ externalKey: "open1", status: "Open" }),
      bill({ externalKey: "closed1", status: "Closed" }),
    ];
    const findings = detectOnHoldBills(bills, asOf);
    expect(findings).toHaveLength(1);
    expect(findings[0].kind).toBe("stale-on-hold-bill");
    expect(findings[0].tier).toBe("INFO");
    expect(findings[0].detail).toMatch(/0–30 days/);
  });

  it("promotes an on-hold bill that is also a duplicate to HIGH", () => {
    const onHold = bill({ externalKey: "h1", status: "Hold" });
    const dupKeys = new Set([`dup-ap:${apDuplicateKey(onHold)}`]);
    const findings = detectOnHoldBills([onHold], asOf, dupKeys);
    expect(findings[0].tier).toBe("HIGH");
    expect(findings[0].detail).toMatch(/duplicate cluster/);
  });

  it("uses a stable fingerprint keyed on the bill external key", () => {
    const onHold = bill({ externalKey: "uniq-key", status: "Hold" });
    const [finding] = detectOnHoldBills([onHold], asOf);
    expect(finding.fingerprint).toBe("onhold:uniq-key");
  });
});
