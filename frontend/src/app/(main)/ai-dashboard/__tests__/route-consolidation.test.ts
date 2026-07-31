import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) =>
  readFileSync(join(__dirname, "..", relativePath), "utf8");

describe("AI dashboard route consolidation", () => {
  it("uses AI OS as the canonical dashboard surface", () => {
    const rootPage = source("page.tsx");

    expect(rootPage).toContain('import { AiOsDashboard } from "./ai-os/ai-os-preview";');
    expect(rootPage).toContain("<AiOsDashboard />");
    expect(rootPage).not.toContain("<ExecutiveAiDashboard />");
  });

  it.each(["ai-os/page.tsx", "projects/page.tsx"])(
    "redirects the retired %s route to the canonical dashboard",
    (relativePath) => {
      const page = source(relativePath);

      expect(page).toContain('import { redirect } from "next/navigation";');
      expect(page).toContain('redirect("/ai-dashboard");');
    },
  );

  it("does not expose retired routes through dashboard navigation or AI OS links", () => {
    const workspaceShell = source("workspace-shell.tsx");
    const aiOsData = source("ai-os/ai-os-data.ts");

    expect(workspaceShell).not.toContain('href: "/ai-dashboard/projects"');
    expect(workspaceShell).not.toContain('href: "/ai-dashboard/ai-os"');
    expect(aiOsData).not.toContain('href: "/ai-dashboard/projects"');
  });
});
