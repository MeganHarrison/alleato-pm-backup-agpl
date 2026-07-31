import { readFileSync } from "node:fs";
import { join } from "node:path";

const themeSource = readFileSync(
  join(__dirname, "..", "..", "ai-dashboard-theme.module.css"),
  "utf8",
);
const mainLayoutSource = readFileSync(
  join(__dirname, "..", "..", "layout.tsx"),
  "utf8",
);

describe("AI dashboard theme", () => {
  it("uses one warm orange accent across route and sidebar states", () => {
    expect(themeSource).toContain("--ai-dashboard-accent: 31 94% 64%;");
    expect(themeSource).toContain("--primary: var(--ai-dashboard-accent);");
    expect(themeSource).toContain(
      "--primary-foreground: var(--ai-dashboard-accent-foreground);",
    );
    expect(themeSource).toContain("--ring: var(--ai-dashboard-accent);");
    expect(themeSource).toContain(
      "--sidebar-primary: hsl(var(--ai-dashboard-accent));",
    );
    expect(themeSource).toContain(
      "--sidebar-accent: hsl(var(--ai-dashboard-accent-muted));",
    );
    expect(themeSource).toContain(
      "--sidebar-accent-foreground: hsl(var(--ai-dashboard-accent-muted-foreground));",
    );
    expect(themeSource).toContain(
      "--sidebar-ring: hsl(var(--ai-dashboard-accent));",
    );
    for (const legacyViolet of [
      "254 100% 82%",
      "247 46% 15%",
      "254 30% 16%",
      "254 100% 88%",
    ]) {
      expect(themeSource).not.toContain(legacyViolet);
    }
  });

  it("keeps the entire AI dashboard workspace dark without changing other routes", () => {
    expect(themeSource).toContain(":global(.dark) .theme");
    expect(themeSource).toContain(".theme:global(.dark)");
    // #1f1f1f page canvas, #262626 card/chart surfaces.
    expect(themeSource).toContain("--background: 0 0% 12%;");
    expect(themeSource).toContain("--card: 0 0% 15%;");
    expect(mainLayoutSource).toContain(
      'pathname === "/ai-dashboard" || pathname.startsWith("/ai-dashboard/")',
    );
    expect(mainLayoutSource).toContain(
      "`dark ${aiDashboardThemeStyles.theme} bg-background text-foreground`",
    );
    expect(mainLayoutSource).toMatch(/isAiDashboard[\s\S]*:[\s\S]*undefined/);
  });
});
