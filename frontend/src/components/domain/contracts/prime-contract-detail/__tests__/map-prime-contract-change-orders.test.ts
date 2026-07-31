import {
  mapPrimeContractChangeOrders,
  type RawPrimeContractCoRow,
} from "@/app/(main)/[projectId]/prime-contracts/[contractId]/types";

const CONTRACT_ID = "dee6b12d-ec88-423a-9ee3-15ffcf68ea49";

function makeRow(overrides: Partial<RawPrimeContractCoRow> = {}): RawPrimeContractCoRow {
  return {
    id: 5217,
    contract_id: null,
    prime_contract_id: CONTRACT_ID,
    pcco_number: "001",
    title: "PCO for CE 001",
    description: null,
    total_amount: 20000,
    status: "draft",
    revision: 0,
    executed: false,
    due_date: null,
    review_date: null,
    designated_reviewer: null,
    request_received_from: null,
    reviewed_by: null,
    approved_at: "2026-07-09T14:27:56.04+00:00",
    rejection_reason: null,
    created_at: "2026-07-09T14:27:56.04+00:00",
    ...overrides,
  };
}

describe("mapPrimeContractChangeOrders", () => {
  it("includes a promoted PCCO that only has prime_contract_id (regression: contract_id is null)", () => {
    // This is the exact production row (project 1141, PCCO id 5217) that used to
    // vanish from the prime contract detail Change Orders tab.
    const result = mapPrimeContractChangeOrders([makeRow()], CONTRACT_ID);

    expect(result).toHaveLength(1);
    expect(result[0].change_order_number).toBe("001");
    expect(result[0].amount).toBe(20000);
    expect(result[0].status).toBe("draft");
  });

  it("still matches legacy rows that only have contract_id", () => {
    const legacyRow = makeRow({ prime_contract_id: null, contract_id: CONTRACT_ID });
    const result = mapPrimeContractChangeOrders([legacyRow], CONTRACT_ID);
    expect(result).toHaveLength(1);
  });

  it("excludes change orders belonging to a different prime contract", () => {
    const otherRow = makeRow({ prime_contract_id: "other-contract", contract_id: null });
    expect(mapPrimeContractChangeOrders([otherRow], CONTRACT_ID)).toHaveLength(0);
  });

  it("maps API column names to the tab's field names", () => {
    const [co] = mapPrimeContractChangeOrders([makeRow()], CONTRACT_ID);
    expect(co.id).toBe("5217"); // numeric id coerced to string
    expect(co.title).toBe("PCO for CE 001");
    expect(co.approved_date).toBe("2026-07-09T14:27:56.04+00:00");
    expect(co.requested_date).toBe("2026-07-09T14:27:56.04+00:00");
  });

  it("defaults missing amount and status safely", () => {
    const [co] = mapPrimeContractChangeOrders(
      [makeRow({ total_amount: null, status: null })],
      CONTRACT_ID,
    );
    expect(co.amount).toBe(0);
    expect(co.status).toBe("pending");
  });
});
