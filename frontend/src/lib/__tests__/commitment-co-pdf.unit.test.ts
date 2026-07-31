import { buildCommitmentCoPdfHtml } from "@/lib/commitment-co-pdf";

describe("buildCommitmentCoPdfHtml", () => {
  it("renders Procore-parity sections with Alleato branding and merged values", () => {
    const html = buildCommitmentCoPdfHtml({
      changeOrderNumber: "001",
      title: "Smart Displays & TVs",
      description: "Cost to add blocking and power/data for smart displays and TVs.",
      status: "approved",
      amount: 7500,
      requestedDate: "2025-04-29",
      approvedDate: "2025-05-09",
      createdAt: "2025-04-29T12:00:00Z",
      createdByName: "Nick Jepson",
      approvedByName: "Brandon Clymer",
      designatedReviewer: "Brandon Clymer",
      requestReceivedFrom: "Owner request",
      revision: 0,
      dueDate: null,
      invoicedDate: null,
      paidDate: null,
      location: null,
      reference: null,
      changeReason: "Design Development",
      paidInFull: false,
      executed: false,
      accountingMethod: "Amount Based",
      scheduleImpact: 0,
      fieldChange: false,
      signedChangeOrderReceivedDate: "2025-05-09",
      commitmentNumber: "SC-001",
      commitmentTitle: "Electrical Contract",
      projectName: "Goodwill Bart",
      projectNumber: "24-104",
      projectAddressLines: ["940 N Marr Road", "Columbus, Indiana 47201"],
      contractorName: "Alleato Group",
      contractorAddressLines: [
        "8383 Craig St, Suite 150",
        "Indianapolis, Indiana 46250",
        "Phone: +13177600088",
      ],
      vendorName: "Deem, LLC",
      vendorAddressLines: ["11201 USA Pkwy", "Fishers, Indiana 46037"],
      attachments: [
        { fileName: "06192025_008.pdf", attachedAt: "2025-05-09" },
        { fileName: "Monitor mount locations and specs.pdf", attachedAt: null },
      ],
      lineItems: [
        {
          budgetCodeLabel: "26-1000.S Electrical",
          description: "Cost for power/data for smart displays and tvs.",
          amount: 7500,
        },
      ],
      originalContractSum: 293174.53,
      priorAuthorizedChangeOrders: 0,
    });

    expect(html).toContain("Subcontract Change Order #001: Smart Displays &amp; TVs");
    expect(html).toContain("Alleato Group");
    expect(html).toContain("Contract Company");
    expect(html).toContain("Deem, LLC");
    expect(html).toContain("Change Order Line Items");
    expect(html).toContain("26-1000.S Electrical");
    expect(html).toContain("06192025_008.pdf");
    expect(html).toContain("The original (Contract Sum)");
    expect(html).toContain("$293,174.53");
    expect(html).toContain("The new contract sum including this Change Order will be");
    expect(html).toContain("$300,674.53");
    expect(html).toContain("The contract time will not be changed by this Change Order.");
    expect(html).toContain("Signature");
  });

  it("renders explicit placeholders when optional values are missing", () => {
    const html = buildCommitmentCoPdfHtml({
      changeOrderNumber: null,
      title: null,
      description: null,
      status: null,
      amount: 0,
      requestedDate: null,
      approvedDate: null,
      createdAt: null,
      createdByName: null,
      approvedByName: null,
      designatedReviewer: null,
      requestReceivedFrom: null,
      revision: null,
      dueDate: null,
      invoicedDate: null,
      paidDate: null,
      location: null,
      reference: null,
      changeReason: null,
      paidInFull: null,
      executed: null,
      accountingMethod: null,
      scheduleImpact: null,
      fieldChange: null,
      signedChangeOrderReceivedDate: null,
      commitmentNumber: null,
      commitmentTitle: null,
      projectName: null,
      projectNumber: null,
      projectAddressLines: [],
      contractorName: "Alleato Group",
      contractorAddressLines: [],
      vendorName: null,
      vendorAddressLines: [],
      attachments: [],
      lineItems: [],
      originalContractSum: 0,
      priorAuthorizedChangeOrders: 0,
    });

    expect(html).toContain("Subcontract Change Order #CCO: Commitment Change Order");
    expect(html).toContain("No line items");
    expect(html).toContain("<li>—</li>");
    expect(html).toContain("Request Received From");
    expect(html).toContain(">—<");
  });
});
