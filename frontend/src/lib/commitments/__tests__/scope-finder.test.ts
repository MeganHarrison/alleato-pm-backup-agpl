import {
  buildCommitmentScopeRecords,
  searchCommitmentScopeRecords,
  type CommitmentScopeLine,
  type CommitmentScopeSource,
  type CostCodeInsight,
} from "@/lib/commitments/scope-finder";

describe("scope-finder", () => {
  const costCodeMap = new Map<string, CostCodeInsight>([
    [
      "033000",
      {
        divisionTitle: "Concrete",
        title: "Cast-in-place concrete",
      },
    ],
    [
      "092900",
      {
        divisionTitle: "Gypsum Board",
        title: "Gypsum board assemblies",
      },
    ],
  ]);

  it("builds a concise summary from description plus inclusions and exclusions", () => {
    const sources: CommitmentScopeSource[] = [
      {
        id: "sub-1",
        projectId: 101,
        commitmentType: "subcontract",
        contractCompanyId: "company-1",
        companyName: "Acme Interiors",
        contractNumber: "SC-001",
        title: "Interior framing",
        description: "Interior framing and drywall at tenant buildout",
        inclusions: "Metal stud framing\nGypsum board finishing",
        exclusions: "Paint and final cleaning",
      },
    ];
    const lines: CommitmentScopeLine[] = [
      {
        commitmentId: "sub-1",
        budgetCode: "09-2900",
        description: "Gypsum board partitions",
        amount: 15000,
        lineNumber: 1,
      },
    ];

    const record = buildCommitmentScopeRecords(sources, lines, costCodeMap).get("sub-1");

    expect(record?.tradeNames).toEqual(["Gypsum Board"]);
    expect(record?.scopeSummary).toContain("Interior framing and drywall");
    expect(record?.scopeSummary).toContain("Includes Metal stud framing");
    expect(record?.scopeSummary).toContain("Excludes Paint and final cleaning");
  });

  it("ranks matches using scope and inclusion language", () => {
    const sources: CommitmentScopeSource[] = [
      {
        id: "sub-1",
        projectId: 101,
        commitmentType: "subcontract",
        contractCompanyId: "company-1",
        companyName: "Acme Interiors",
        contractNumber: "SC-001",
        title: "Interior framing",
        description: "Interior framing and drywall at tenant buildout",
        inclusions: "Metal stud framing\nGypsum board finishing",
        exclusions: "Paint and final cleaning",
      },
      {
        id: "po-1",
        projectId: 101,
        commitmentType: "purchase_order",
        contractCompanyId: "company-2",
        companyName: "Stone Supply",
        contractNumber: "PO-003",
        title: "Concrete materials",
        description: "Ready mix concrete supply",
        inclusions: null,
        exclusions: null,
      },
    ];
    const lines: CommitmentScopeLine[] = [
      {
        commitmentId: "sub-1",
        budgetCode: "09-2900",
        description: "Gypsum board partitions",
        amount: 15000,
        lineNumber: 1,
      },
      {
        commitmentId: "po-1",
        budgetCode: "03-3000",
        description: "Foundation concrete",
        amount: 12000,
        lineNumber: 1,
      },
    ];

    const records = Array.from(buildCommitmentScopeRecords(sources, lines, costCodeMap).values());
    const matches = searchCommitmentScopeRecords(records, "paint cleaning", 5);

    expect(matches[0]?.id).toBe("sub-1");
    expect(matches[0]?.matchReason).toBe("Excludes");
  });
});
