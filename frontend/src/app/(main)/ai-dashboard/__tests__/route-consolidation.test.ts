import { readFileSync } from "node:fs";
import { join } from "node:path";

const source = (relativePath: string) =>
  readFileSync(join(__dirname, "..", relativePath), "utf8");

describe("AI dashboard route consolidation", () => {
  it("uses Company Brain as the canonical dashboard surface", () => {
    const rootPage = source("page.tsx");

    expect(rootPage).toContain('from "@/features/company-brain/company-brain-page";');
    expect(rootPage).toContain("<CompanyBrainPageContent searchParams={searchParams} />");
    expect(rootPage).not.toContain("<AiOsDashboard />");
  });

  it.each(["ai-os/page.tsx", "projects/page.tsx"])(
    "redirects the retired %s route to the canonical dashboard",
    (relativePath) => {
      const page = source(relativePath);

      expect(page).toContain('import { redirect } from "next/navigation";');
      expect(page).toContain('redirect("/ai-dashboard");');
    },
  );

  it("keeps the explicitly routed dashboard workspaces discoverable", () => {
    const workspaceShell = source("workspace-shell.tsx");
    const aiOsData = source("ai-os/ai-os-data.ts");

    expect(workspaceShell).toContain('href: "/ai-dashboard/projects"');
    expect(workspaceShell).toContain('href: "/ai-dashboard/ai-os"');
    expect(workspaceShell).toContain('href: "/ai/company-brain"');
    expect(aiOsData).not.toContain('href: "/ai-dashboard/projects"');
  });
});
