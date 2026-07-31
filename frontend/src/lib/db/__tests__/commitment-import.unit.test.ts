/**
 * Regression tests for the commitments Excel importer.
 *
 * Two real bugs this guards against:
 *  1. Procore / Job Planner exports carry a "Contracted Company" NAME, not a
 *     Company ID. The original importer only read a Company ID column, so every
 *     row from such an export was silently dropped. resolveCompanyId must match
 *     by name (exact-normalized, then containment).
 *  2. Reusing the subcontract insert mapping for a purchase order writes
 *     `signed_contract_received_date`, a column purchase_orders does not have
 *     (PGRST204 at runtime). buildPurchaseOrderInsert must emit
 *     `signed_po_received_date` instead and never the subcontract column.
 */

import {
  COLUMN_ALIASES,
  buildPurchaseOrderInsert,
  buildSubcontractInsert,
  isPurchaseOrder,
  parseRow,
  resolveCompanyId,
  type CompanyRef,
  type ImportRow,
} from "../commitment-import";

const COMPANIES: CompanyRef[] = [
  { id: "uuid-apex", name: "Apex Glass LLC" },
  { id: "uuid-deem", name: "Deem, LLC" },
  { id: "uuid-kimley", name: "Kimley-Horn and Associates, Inc" },
];

function baseRow(overrides: Partial<ImportRow> = {}): ImportRow {
  return {
    number: "SC-8189-0001",
    type: "Subcontract",
    title: "",
    status: "Approved",
    companyId: "",
    companyName: "",
    originalAmount: 1000,
    costCode: null,
    costCodeDescription: null,
    description: null,
    retentionPercentage: null,
    startDate: null,
    estCompletionDate: null,
    contractDate: null,
    signedDate: null,
    actualCompletionDate: null,
    issuedOnDate: null,
    inclusions: null,
    exclusions: null,
    ...overrides,
  };
}

describe("commitment-import — parseRow", () => {
  it("reads the company NAME from a 'Contracted Company' column (Job Planner export)", () => {
    const row = parseRow({
      number: "SC-8189-0001",
      "contracted company": "Deem, LLC",
      amount: 383000,
      type: "Subcontract",
      status: "Approved",
    });
    expect(row).not.toBeNull();
    expect(row!.companyName).toBe("Deem, LLC");
    expect(row!.companyId).toBe("");
    expect(row!.originalAmount).toBe(383000);
  });

  it("aliases 'contracted company' to companyName", () => {
    expect(COLUMN_ALIASES.companyName).toContain("contracted company");
  });

  it("skips rows without a number or amount", () => {
    expect(parseRow({ amount: 100 })).toBeNull();
    expect(parseRow({ number: "SC-1" })).toBeNull();
  });
});

describe("commitment-import — resolveCompanyId", () => {
  it("matches a company by exact normalized name", () => {
    const row = baseRow({ companyName: "Apex Glass LLC" });
    expect(resolveCompanyId(row, COMPANIES)).toBe("uuid-apex");
  });

  it("matches despite punctuation / spacing differences", () => {
    const row = baseRow({ companyName: "deem llc" });
    expect(resolveCompanyId(row, COMPANIES)).toBe("uuid-deem");
  });

  it("prefers an explicit, non-placeholder Company ID over the name", () => {
    const row = baseRow({ companyId: "explicit-uuid", companyName: "Apex Glass LLC" });
    expect(resolveCompanyId(row, COMPANIES)).toBe("explicit-uuid");
  });

  it("ignores crawler placeholder ids and falls back to the name", () => {
    const row = baseRow({ companyId: "LOOKUP_REQUIRED", companyName: "Apex Glass LLC" });
    expect(resolveCompanyId(row, COMPANIES)).toBe("uuid-apex");
  });

  it("returns null when the company cannot be resolved", () => {
    const row = baseRow({ companyName: "Totally Unknown Vendor" });
    expect(resolveCompanyId(row, COMPANIES)).toBeNull();
  });
});

describe("commitment-import — isPurchaseOrder", () => {
  it.each(["Purchase Order", "purchase_order", "PO", "po"])("treats %s as a PO", (t) => {
    expect(isPurchaseOrder(t)).toBe(true);
  });
  it.each(["Subcontract", "subcontract", ""])("treats %s as a subcontract", (t) => {
    expect(isPurchaseOrder(t)).toBe(false);
  });
});

describe("commitment-import — insert mapping", () => {
  it("subcontract insert keeps signed_contract_received_date", () => {
    const row = baseRow({ number: "8189-0001", signedDate: "2026-01-15" });
    const insert = buildSubcontractInsert(row, "uuid-deem", "Approved", 754, "user-1");
    expect(insert.signed_contract_received_date).toBe("2026-01-15");
    expect(insert).not.toHaveProperty("signed_po_received_date");
    expect(insert.project_id).toBe(754);
    expect(insert.contract_company_id).toBe("uuid-deem");
    expect(insert.contract_number).toBe("SC-8189-0001");
    expect(insert.executed).toBe(true);
  });

  it("PO insert renames the signed date to signed_po_received_date and drops the subcontract column", () => {
    const row = baseRow({ number: "PO-8189-0001", type: "Purchase Order", signedDate: "2026-02-20" });
    const insert = buildPurchaseOrderInsert(row, "uuid-kimley", "Approved", 754, "user-1");
    expect(insert.signed_po_received_date).toBe("2026-02-20");
    // Critical: must NOT carry the subcontract-only column (PGRST204 otherwise).
    expect(insert).not.toHaveProperty("signed_contract_received_date");
    expect(insert.contract_number).toBe("PO-8189-0001");
    expect(insert.contract_company_id).toBe("uuid-kimley");
  });

  it("PO insert with no signed date emits a null signed_po_received_date, not the subcontract column", () => {
    const row = baseRow({ type: "PO" });
    const insert = buildPurchaseOrderInsert(row, "uuid-kimley", "Approved", 754, "user-1");
    expect(insert.signed_po_received_date).toBeNull();
    expect(insert).not.toHaveProperty("signed_contract_received_date");
  });
});
