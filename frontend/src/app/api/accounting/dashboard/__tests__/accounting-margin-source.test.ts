import fs from "node:fs";
import path from "node:path";

const dashboardRoutePath = path.resolve(
  process.cwd(),
  "src/app/api/accounting/dashboard/route.ts",
);

describe("Accounting dashboard project margin source", () => {
  const source = fs.readFileSync(dashboardRoutePath, "utf8");

  it("uses the canonical WIP portfolio owner", () => {
    expect(source).toContain(
      'import { buildWipPortfolio } from "@/lib/accounting/wip-portfolio"',
    );
    expect(source).toContain(
      'buildWipPortfolio(supabase, "/api/accounting/dashboard#GET")',
    );
    expect(source).toContain(
      "const netMarginByProject: NetMarginByProject[] = wipPortfolio.rows",
    );
  });

  it("uses one signed billed-to-date and costs-to-date basis", () => {
    expect(source).toContain("const revenue = project.billedToDate");
    expect(source).toContain("const cost = project.costsToDate");
    expect(source).toContain(
      "const netMargin = Math.round((revenue - cost) * 100) / 100",
    );
  });

  it("does not restore the parallel AR minus open-AP calculation", () => {
    expect(source).not.toContain("projectCostsResult");
    expect(source).not.toContain("costByProject");
    expect(source).not.toContain("projectCodesWithFinancials");
  });

  it("limits Revenue by Project to canonical project membership", () => {
    expect(source).toContain("rankProjectsByVisibleRevenue(");
    expect(source).toContain(
      "projectDescMap.has(project.projectCode)",
    );
    expect(source).not.toContain(
      ".sort((a, b) => b.totalInvoiced - a.totalInvoiced)",
    );
  });
});
