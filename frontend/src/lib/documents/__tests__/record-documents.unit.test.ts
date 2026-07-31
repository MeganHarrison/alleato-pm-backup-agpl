import {
  getDocumentPdfOptions,
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
    effectiveDate: "2026-05-27",
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
    sections: [],
    totals: [],
    lineItems: [],
    listSections: [],
    recipients: [],
  };
}

describe("commitment contract rendering", () => {
  it("renders the branded template with merged commitment fields", () => {
    const html = renderDocumentHtml(makeCommitmentBundle());

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
    expect(html).toContain("legal-signature-block");
    expect(html).toContain("legal-table contract-scope-table");
    expect(html).not.toContain("Deem, LLC");
    expect(html).not.toContain("Goodwill Bart");
    expect(html).not.toContain("Goodwill - Bart");
    expect(html).not.toContain("Fishers, Indiana 46037");
    expect(html).not.toContain("ProcoreSubcontractorSignHere");
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
