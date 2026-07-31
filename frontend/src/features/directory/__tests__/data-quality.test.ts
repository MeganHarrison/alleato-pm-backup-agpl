import {
  formatDataQualitySummary,
  getCompanyDataQualityIssues,
  getVendorDataQualityIssues,
} from "../data-quality";

describe("directory data quality", () => {
  it("returns ready for complete company rows", () => {
    const issues = getCompanyDataQualityIssues({
      contact_count: 2,
      project_count: 1,
      business_phone: "317-555-0100",
      email_address: "ops@example.com",
      website: "https://example.com",
      company_type: "vendor",
      status: "active",
      primary_contact_id: "contact-1",
    });

    expect(issues).toEqual([]);
    expect(formatDataQualitySummary(issues)).toBe("Ready");
  });

  it("flags company rows that need directory cleanup", () => {
    const issues = getCompanyDataQualityIssues({
      contact_count: 0,
      project_count: 0,
      business_phone: null,
      email_address: " {} ",
      website: null,
      company_type: null,
      status: null,
      primary_contact_id: null,
    });

    expect(issues.map((issue) => issue.id)).toEqual([
      "missing-status",
      "missing-type",
      "no-contacts",
      "no-contact-method",
      "no-projects",
      "no-website",
    ]);
  });

  it("flags vendor rows missing operational accounting data", () => {
    const issues = getVendorDataQualityIssues({
      contact_name: null,
      contact_email: null,
      contact_phone: null,
      address: null,
      city: "Indianapolis",
      state: null,
      zip_code: null,
      payment_method: null,
      terms: null,
      acumatica_vendor_id: null,
      status: null,
    });

    expect(issues.map((issue) => issue.label)).toEqual([
      "Missing status",
      "No vendor contact",
      "Incomplete address",
      "No payment terms",
      "No ERP ID",
    ]);
  });

  it("summarizes visible issue labels for export", () => {
    const issues = getVendorDataQualityIssues({
      contact_name: "Jordan Lee",
      contact_email: null,
      contact_phone: null,
      address: "100 Main St",
      city: "Indianapolis",
      state: "IN",
      zip_code: "46204",
      payment_method: "ACH",
      terms: "Net 30",
      acumatica_vendor_id: "V100",
      status: "active",
    });

    expect(formatDataQualitySummary(issues)).toBe("No email, No phone");
  });
});
