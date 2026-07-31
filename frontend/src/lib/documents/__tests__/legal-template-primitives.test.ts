import {
  renderLegalBulletList,
  renderLegalClause,
  renderLegalInlineValueOrBlank,
  renderLegalParagraph,
  renderLegalSignatureBlock,
  renderLegalTable,
} from "@/lib/documents/legal-template-primitives";

describe("legal template primitives", () => {
  it("renders semantic tables and lists for PDF templates", () => {
    const tableHtml = renderLegalTable({
      headers: ["Line", "Description", "Qty"],
      rows: [["1", "Electrical", "1"]],
      widths: ["12%", "68%", "20%"],
      headerAlign: ["left", "left", "center"],
      rowAlign: ["left", "left", "center"],
      className: "contract-scope-table",
    });
    const listHtml = renderLegalBulletList(["Item A", "Item B"]);

    expect(tableHtml).toContain('class="legal-table contract-scope-table"');
    expect(tableHtml).toContain("Electrical");
    expect(tableHtml).toContain("table-layout:fixed");
    expect(listHtml).toContain("legal-bullet-list");
    expect(listHtml).toContain("Item A");
  });

  it("renders signature and inline placeholder blocks with consistent layout", () => {
    const signatureHtml = renderLegalSignatureBlock({
      leftTitle: '"Subcontractor"',
      leftCompany: "R.J. Skelding Co, Inc",
      leftSignerName: "",
      leftSignerTitle: "",
      leftSignedDate: "",
      rightTitle: '"Contractor"',
      rightCompany: "Alleato Group",
      rightSignerName: "Brandon Clymer",
      rightSignerTitle: "CEO",
      rightSignedDate: "",
    });

    expect(signatureHtml).toContain("legal-signature-block");
    expect(signatureHtml).toContain("legal-signature-fields");
    expect(signatureHtml).toContain("legal-signature-field-row");
    expect(signatureHtml).toContain("R.J. Skelding Co, Inc");
    expect(signatureHtml).toContain("Alleato Group");
    expect(signatureHtml).toContain("Printed Name:");
    expect(renderLegalInlineValueOrBlank("2026-07-07")).toContain("2026-07-07");
    expect(renderLegalParagraph("Scope line items", { bold: true })).toContain("Scope line items");
  });

  it("renders clause headings as reusable legal blocks", () => {
    const clauseHtml = renderLegalClause({
      letter: "c",
      title: "Attorneys Fees.",
      bodyHtml: [renderLegalParagraph("Sample clause body.")],
    });

    expect(clauseHtml).toContain("legal-clause");
    expect(clauseHtml).toContain("c.");
    expect(clauseHtml).toContain("Attorneys Fees.");
    expect(clauseHtml).toContain("Sample clause body.");
  });
});
