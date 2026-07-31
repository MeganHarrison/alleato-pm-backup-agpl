import {
  companyColumns,
  companyDefaultVisibleColumns,
} from "../directory-companies-table-definition";

describe("companies directory columns", () => {
  it("does not expose the retired data quality column", () => {
    expect(companyColumns.map((column) => column.id)).not.toContain("data_quality");
    expect(companyColumns.map((column) => column.label)).not.toContain("Data Quality");
    expect(companyDefaultVisibleColumns).not.toContain("data_quality");
  });

  it("keeps Acumatica vendor metadata available but hidden by default", () => {
    const requestedColumnIds = [
      "erp_vendor_id",
      "tax_id",
      "legal_name",
      "vendor_class",
      "terms",
      "payment_method",
      "ap_account",
      "cash_account",
      "is_1099_vendor",
      "is_foreign_entity",
      "is_labor_union",
      "is_tax_agency",
      "acumatica_sync_at",
      "license_number",
    ];

    expect(companyColumns.map((column) => column.id)).toEqual(
      expect.arrayContaining(requestedColumnIds),
    );
    for (const columnId of requestedColumnIds) {
      expect(companyDefaultVisibleColumns).not.toContain(columnId);
    }
  });
});
