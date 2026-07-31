import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const source = (relativePath: string) =>
  readFileSync(resolve(__dirname, relativePath), "utf8");

describe("Company Brain route ownership", () => {
  it("uses one permission-scoped loader for both Company Brain entry routes", () => {
    const sharedPage = source("../company-brain-page.tsx");
    const dashboardPage = source("../../../app/(main)/ai-dashboard/page.tsx");
    const directPage = source("../../../app/(main)/ai/company-brain/page.tsx");

    expect(sharedPage).toContain("await requireBrainUser()");
    expect(sharedPage).toContain("await loadCompanyBrainOverview(range)");
    expect(dashboardPage).toContain(
      "<CompanyBrainPageContent searchParams={searchParams} />",
    );
    expect(directPage).toContain(
      "<CompanyBrainPageContent searchParams={searchParams} />",
    );
    expect(dashboardPage).not.toContain("<AiOsDashboard />");
  });

  it("keeps the Company Brain focused on the system map, metrics, and activity", () => {
    const sharedPage = source("../company-brain-page.tsx");
    const experience = source("../company-brain-experience.tsx");

    // The Business-Area record browser moved out of this page (2026-07-30) —
    // it is owned by /brain, and duplicating it here buried the system map.
    expect(sharedPage).not.toContain("loadCompanyBrainBranch");
    expect(sharedPage).not.toContain("branchBrowser");
    expect(experience).not.toContain("branchBrowser");
    expect(experience).not.toContain("Top knowledge connections");
    // Fabricated trendlines are never rendered for unmeasured metrics.
    expect(experience).not.toContain("SPARKLINES");
  });
});
