import fs from "node:fs";
import path from "node:path";

const accountingPagePath = path.resolve(
  process.cwd(),
  "src/app/(admin)/accounting/page.tsx",
);

describe("Accounting project balance charts", () => {
  const source = fs.readFileSync(accountingPagePath, "utf8");

  it("uses the existing project-grouped AR and AP response fields", () => {
    expect(source).toContain("function ProjectBalanceBarChart");
    expect(source).toContain("FinancialPositionLayout");
    expect(source).toContain('title="Accounts Receivable by Project"');
    expect(source).toContain("projects={arByProject}");
    expect(source).toContain('title="Accounts Payable by Project"');
    expect(source).toContain("projects={apByProject}");
  });

  it("does not render aging-day buckets as the chart dimension", () => {
    expect(source).not.toContain("function AgingBarChart");
    expect(source).not.toContain('title="Accounts Receivable aging"');
    expect(source).not.toContain('title="Accounts Payable aging"');
    expect(source).not.toContain('bucket: "31–60"');
  });

  it("keeps totals, attention logic, links, and human-safe recovery", () => {
    expect(source).toContain("totalOutstanding={arAging.totalOutstanding}");
    expect(source).toContain("totalOutstanding={apAging.totalOutstanding}");
    expect(source).toContain("const arLate = overdueTotal(arAging)");
    expect(source).toContain('href="/accounting/invoices"');
    expect(source).toContain('href="/accounting/bills"');
    expect(source).toContain("getAccountingProjectName(project)");
    expect(source).toContain("compactProjectDisplayName(");
    expect(source).toContain("No project balances available.");
  });

  it("never maps project codes into visible chart labels", () => {
    expect(source).toContain('from "@/lib/projects/project-display-name"');
    expect(source).toContain("{item.projectLabel}");
    expect(source).toContain("{item.projectName}");
    expect(source).not.toContain("label: formatProjectCode(project.projectCode)");
    expect(source).not.toContain("label: project.projectCode");
    expect(source).not.toContain('dataKey="projectCode"');
    expect(source).not.toContain(
      "projectName: project.description ?? project.projectCode",
    );
    expect(source).not.toContain("{item.projectCode}, {item.projectName}");
  });

  it("keeps the dashboard visual by removing duplicate explanatory copy", () => {
    expect(source).not.toContain(
      "Live cash position, margin, receivables, payables",
    );
    expect(source).not.toContain("Synced from Acumatica.");
    expect(source).not.toContain("figures may shift as they're cleared");
    expect(source).not.toContain("Largest project margins by absolute impact");
    expect(source).toContain('title="Gross Margin to Date by Project"');
    expect(source).toContain("gross margin to date");
    expect(source).toContain("Billed to date");
    expect(source).toContain("Costs to date");
  });
});
