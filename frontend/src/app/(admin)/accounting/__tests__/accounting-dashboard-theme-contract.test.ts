import { readFileSync } from "node:fs";
import { join } from "node:path";

const adminLayoutSource = readFileSync(
  join(__dirname, "..", "..", "admin-layout-client.tsx"),
  "utf8",
);
const accountingPageSource = readFileSync(
  join(__dirname, "..", "page.tsx"),
  "utf8",
);
const sharedThemeSource = readFileSync(
  join(__dirname, "..", "..", "..", "(main)", "ai-dashboard-theme.module.css"),
  "utf8",
);

describe("canonical Accounting dashboard style", () => {
  it("reuses the shared AI Dashboard theme only for the Accounting dashboard", () => {
    expect(adminLayoutSource).toContain(
      'import aiDashboardThemeStyles from "../(main)/ai-dashboard-theme.module.css"',
    );
    expect(adminLayoutSource).toContain('pathname === "/accounting"');
    expect(adminLayoutSource).not.toContain(
      'pathname.startsWith("/accounting/")',
    );
    expect(adminLayoutSource).toContain(
      "`dark ${aiDashboardThemeStyles.theme} bg-background text-foreground`",
    );
    expect(adminLayoutSource).toMatch(
      /isAccountingDashboard[\s\S]*:[\s\S]*undefined/,
    );
    expect(sharedThemeSource).toContain("--background: 0 0% 12%;");
    expect(sharedThemeSource).toContain("--ai-dashboard-accent: 31 94% 64%;");
  });

  it("leads with financial charts and removes duplicate KPI summaries", () => {
    expect(accountingPageSource).toContain(
      'eyebrow="Financial command center"',
    );
    expect(accountingPageSource).toContain(
      '<Section title="Financial Position">',
    );
    expect(accountingPageSource).not.toContain("function MetricPanel");
    expect(accountingPageSource).not.toContain("<KpiRow");
    expect(accountingPageSource).not.toContain(
      '<Section title="Ledger Totals">',
    );
  });

  it("retains the specific retry path for source failures", () => {
    expect(accountingPageSource).toContain(
      "<ErrorState message={error} onRetry={fetchDashboard} />",
    );
    expect(accountingPageSource).toContain("Retry");
  });
});
