import { parse } from "node-html-parser";

import {
  buildCommitmentProjectSummary,
  COMMITMENT_PROJECT_SELECT,
  getDocumentPdfOptions,
  replaceRequiredHtmlRangeByMarkers,
  resolveCommitmentContractorCompany,
  resolveCommitmentOwnerCompanyId,
  renderDocumentHtml,
  type DocumentBundle,
} from "@/lib/documents/record-documents";

function makeCommitmentBundle(): DocumentBundle {
  return {
    recordType: "commitment",
    commitmentType: "purchase_order",
    recordId: "commitment-1",
    label: "Commitment - Purchase Order",
    title: "000109",
    number: "000109",
    status: "Approved",
    effectiveDate: "2026-07-28",
    filename: "000109.pdf",
    defaultSubject: "000109",
    parties: {
      contractor: "Alleato Group",
      counterparty: "R.J. Skelding Co, Inc",
    },
    project: {
      name: "Exol Morrisville",
      address: "2300 South Pennsylvania Ave",
      addressLine1: "2300 South Pennsylvania Ave",
      addressLine2: "Morrisville, PA 19067",
      jobNumber: "26-116",
    },
    commitmentContractTemplate: {
      ownerName: "Greenbox Systems LLC",
      contractorNotice: {
        companyName: "Alleato Group",
        name: null,
        title: null,
        email: null,
        phone: null,
        addressLine1: "8383 Craig St, 150",
        addressLine2: "Indianapolis, IN",
      },
      counterpartyNotice: {
        companyName: "R.J. Skelding Co, Inc",
        name: "Daniel Humphreys",
        title: null,
        email: "dhumphreys@rjskelding.com",
        phone: null,
        addressLine1: "840 N. Dauphin Street",
        addressLine2: "Allentown, PA",
      },
      contractorSignerName: "",
      contractorSignerTitle: "",
    },
    sections: [
      {
        title: "Commercial Terms",
        fields: [{ label: "Retainage", value: "7.5%" }],
      },
    ],
    totals: [{ label: "Original Amount", value: "$27,600.00" }],
    lineItems: [],
    listSections: [],
    recipients: [],
  };
}

describe("commitment contract rendering", () => {
  it("renders the branded template with merged commitment fields", () => {
    const html = renderDocumentHtml(makeCommitmentBundle());
    const text = parse(html).text.replace(/\s+/g, " ").trim();

    expect(html).toContain('class="contract-template"');
    expect(html).toContain('"Times New Roman", Times, "Liberation Serif", "Nimbus Roman No9 L", serif;');
    expect(html).toContain("font-size: 12pt;");
    expect(html).toContain("max-width: 6.5in;");
    expect(html).toContain("R.J. Skelding Co, Inc");
    expect(html).toContain("Greenbox Systems LLC");
    expect(html).toContain("Exol Morrisville");
    expect(html).toContain("2300 South Pennsylvania Ave");
    expect(html).toContain("Morrisville, PA 19067");
    expect(html).toContain("26-116");
    expect(html).toContain("840 N. Dauphin Street");
    expect(html).toContain("Allentown, PA");
    expect(html).toContain("legal-signature-grid");
    expect(html).toContain("legal-table contract-scope-table");
    expect(text).toContain("28th day of July, 2026");
    expect(text).toContain("the total sum of $27,600.00");
    expect(text).toContain("less retainage of 7.5%");
    expect(text).not.toContain("$293,174.53");
    expect(text).not.toMatch(/\bDeem\b/);
    expect(text).not.toMatch(/\bGoodwill\b/);
    expect(text).not.toContain("24-104");
    expect(text).not.toContain("940 N Marr");
    expect(text).not.toContain("Fishers, Indiana 46037");
    expect(html).not.toContain("ProcoreSubcontractorSignHere");
  });

  // Guardrail: the imported Word template still contains Procore billing text in
  // sections that are replaced at render time. If a marker drifts or a section stops
  // being replaced, that legacy text silently reaches a subcontractor's contract.
  // Assert on the rendered output, not the template, so any leak fails here.
  it("never references Procore anywhere in the rendered contract", () => {
    const html = renderDocumentHtml(makeCommitmentBundle());
    const text = parse(html).text;

    expect(text).not.toMatch(/procore/i);
    expect(html).not.toMatch(/procore/i);
  });

  it("renders Exhibit C billing instructions for this app's subcontractor flow", () => {
    const text = parse(renderDocumentHtml(makeCommitmentBundle())).text.replace(/\s+/g, " ").trim();

    const exhibitC = text.slice(text.indexOf('EXHIBIT "C"'), text.indexOf('EXHIBIT "D"'));
    expect(exhibitC).toContain("Alleato Project Management Billing Instructions");
    expect(exhibitC).toContain("https://projects.alleatogroup.com");
    expect(exhibitC).toContain(
      "Any invoice submitted outside of Alleato Project Management will not be processed",
    );

    // Step 1: submit the subcontractor schedule of values, then wait for approval.
    expect(exhibitC).toContain("STEP 1 — SUBMITTING YOUR SCHEDULE OF VALUES");
    expect(exhibitC).toContain("Subcontractor SOV");
    expect(exhibitC).toContain("Add line item");
    expect(exhibitC).toContain("Remaining to Allocate");
    expect(exhibitC).toContain("Submit for Review");
    expect(exhibitC).toContain(
      "Billing cannot begin until the Subcontractor schedule of values is Approved",
    );

    // Step 2: invited to bill once approved.
    expect(exhibitC).toContain("STEP 2 — SUBMITTING A PROGRESS INVOICE");
    expect(exhibitC).toContain("Open Invoice");
    expect(exhibitC).toContain("Edit SOV");
    expect(exhibitC).toContain("This Period");
    expect(exhibitC).toContain("Materials Stored");

    // Step 3: retainage released on its own invoice.
    expect(exhibitC).toContain("STEP 3 — SUBMITTING A RETAINAGE RELEASE INVOICE");
    expect(exhibitC).toContain("Edit Release Amounts");
    expect(exhibitC).toContain("Released This Period");

    // Exhibit D must still follow Exhibit C — proves the range replacement did not
    // consume or orphan the surrounding template structure.
    expect(text).toContain("SCHEDULE OF WORK");
  });

  it("names the G703 stored-materials column as it appears in the app", () => {
    const text = parse(renderDocumentHtml(makeCommitmentBundle())).text.replace(/\s+/g, " ").trim();

    expect(text).toContain("‘Materials Stored’ column");
    expect(text).not.toContain("‘Stored Materials’ column");
  });

  it("uses the canonical job number and does not duplicate a complete project address", () => {
    expect(
      buildCommitmentProjectSummary({
        name: "Aviata at Bradenton",
        address: "105 15th St E, Bradenton, FL 34208",
        "job number": "26-127",
        project_number: "1149",
        state: "FL",
        summary_metadata: {
          city: "105 15th St E",
          postal_code: "34208",
        },
      }),
    ).toEqual({
      name: "Aviata at Bradenton",
      address: "105 15th St E, Bradenton, FL 34208",
      jobNumber: "26-127",
      addressLine1: "105 15th St E, Bradenton, FL 34208",
      addressLine2: null,
    });
  });

  it("keeps locality metadata when commas only separate suite or building details", () => {
    expect(
      buildCommitmentProjectSummary({
        name: "Suite Address",
        address: "100 Main St, Suite 2, Building A",
        "job number": "26-128",
        project_number: null,
        state: "IN",
        summary_metadata: {
          city: "Indianapolis",
          postal_code: "46204",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        addressLine1: "100 Main St, Suite 2, Building A",
        addressLine2: "Indianapolis, IN 46204",
      }),
    );

    expect(
      buildCommitmentProjectSummary({
        name: "Partial State Address",
        address: "100 Main St, Suite 2, IN",
        "job number": "26-129",
        project_number: null,
        state: "IN",
        summary_metadata: {
          city: "Indianapolis",
          postal_code: "46204",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        addressLine1: "100 Main St, Suite 2, IN",
        addressLine2: "Indianapolis, IN 46204",
      }),
    );
  });

  it("uses only the project Client as the commitment Owner source", () => {
    expect(resolveCommitmentOwnerCompanyId({ company_id: "client-company-id" })).toBe(
      "client-company-id",
    );
    expect(resolveCommitmentOwnerCompanyId({ company_id: null })).toBeNull();
  });

  it("resolves a complete Alleato Contractor without a prime contract", () => {
    expect(resolveCommitmentContractorCompany(null)).toEqual({
      name: "Alleato Group",
      address: "8383 Craig Street, Suite 150",
      city: "Indianapolis",
      state: "IN",
      zip_code: "46250",
    });

    expect(
      resolveCommitmentContractorCompany({
        id: "contractor-company-id",
        name: "Alleato Group Southeast",
        address: "701 94th Avenue North, Suite 118",
        city: "St. Petersburg",
        state: "FL",
        zip_code: "33702",
      }),
    ).toEqual({
      name: "Alleato Group Southeast",
      address: "701 94th Avenue North, Suite 118",
      city: "St. Petersburg",
      state: "FL",
      zip_code: "33702",
    });
  });

  it("selects the authoritative project job number and Client fields", () => {
    expect(COMMITMENT_PROJECT_SELECT).toContain('"job number"');
    expect(COMMITMENT_PROJECT_SELECT).toContain("company_id");
  });

  it("falls back to the legacy project number but never exposes an internal project id", () => {
    expect(
      buildCommitmentProjectSummary({
        name: "Legacy Project",
        address: "100 Main St",
        "job number": null,
        project_number: "25-100",
        state: "IN",
        summary_metadata: {
          city: "Indianapolis",
          postal_code: "46204",
        },
      }),
    ).toEqual(
      expect.objectContaining({
        jobNumber: "25-100",
        addressLine1: "100 Main St",
        addressLine2: "Indianapolis, IN 46204",
      }),
    );

    expect(
      buildCommitmentProjectSummary({
        name: null,
        address: null,
        "job number": null,
        project_number: null,
        state: null,
        summary_metadata: null,
      }).jobNumber,
    ).toBe("Not set");
  });

  it("renders the Avita contract values without legacy or duplicated data", () => {
    const bundle = makeCommitmentBundle();
    bundle.project = {
      name: "Aviata at Bradenton",
      address: "105 15th St E, Bradenton, FL 34208",
      addressLine1: "105 15th St E, Bradenton, FL 34208",
      addressLine2: null,
      jobNumber: "26-127",
    };
    bundle.commitmentContractTemplate = {
      ...bundle.commitmentContractTemplate!,
      ownerName: "Test Owner",
    };

    const text = parse(renderDocumentHtml(bundle)).text.replace(/\s+/g, " ").trim();

    expect(text).toContain("Aviata at Bradenton");
    expect(text).toContain("26-127");
    expect(text).toContain("$27,600.00");
    expect(text).toContain("105 15th St E, Bradenton, FL 34208");
    expect(text).not.toContain("105 15th St E, FL");
    expect(text).not.toContain("$293,174.53");
    expect(text).not.toMatch(/\bDeem\b/);
  });

  it("renders a blank Owner line when the project Client has not been set", () => {
    const missingOwner = makeCommitmentBundle();
    missingOwner.commitmentContractTemplate = {
      ...missingOwner.commitmentContractTemplate!,
      ownerName: null,
    };

    const html = renderDocumentHtml(missingOwner);
    const text = parse(html).text.replace(/\s+/g, " ").trim();

    expect(html).toContain("border-bottom:1px solid #111");
    expect(text).not.toContain('engaged by Not set ("Owner")');
    expect(text).toContain('("Owner")');
  });

  it("blocks generation when required party or financial contract inputs are missing", () => {
    const missingSubcontractor = makeCommitmentBundle();
    missingSubcontractor.parties = {
      ...missingSubcontractor.parties,
      counterparty: null,
    };
    expect(() => renderDocumentHtml(missingSubcontractor)).toThrow(
      /Subcontractor is missing.*Contract Company/,
    );

    const missingAmount = makeCommitmentBundle();
    missingAmount.totals = [];
    expect(() => renderDocumentHtml(missingAmount)).toThrow(
      /Original Amount is missing.*commitment SOV/,
    );

    const missingRetainage = makeCommitmentBundle();
    missingRetainage.sections = [];
    expect(() => renderDocumentHtml(missingRetainage)).toThrow(
      /Retainage is missing.*commitment retainage/,
    );
  });

  it("blocks generation if a required template section cannot be replaced", () => {
    expect(() =>
      replaceRequiredHtmlRangeByMarkers(
        "<p>stale sample contract text</p>",
        "payment start",
        "payment end",
        "<p>current payment text</p>",
        "payment clause",
      ),
    ).toThrow(/required payment clause template markers are missing/);
  });

  it("returns branded PDF options for commitment exports", () => {
    expect(getDocumentPdfOptions(makeCommitmentBundle())).toEqual(
      expect.objectContaining({
        footerTemplate: expect.any(String),
        marginBottom: "0.9in",
      }),
    );
  });
});
