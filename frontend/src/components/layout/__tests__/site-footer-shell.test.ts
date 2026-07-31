import { readFileSync } from "node:fs";
import { join } from "node:path";

const frontendRoot = join(process.cwd(), "src");

const shellFiles = [
  "app/(main)/layout.tsx",
  "app/(admin)/admin-layout-client.tsx",
  "app/(dashboard)/layout.tsx",
  "app/(developer)/layout.tsx",
  "app/(tables)/layout.tsx",
];

function readSource(relativePath: string) {
  return readFileSync(join(frontendRoot, relativePath), "utf8");
}

function mainElementSource(source: string) {
  const mainStart = source.indexOf("<main");
  const mainEnd = source.indexOf("</main>");

  if (mainStart === -1 || mainEnd === -1) {
    throw new Error("Route shell must use a semantic main element.");
  }

  return source.slice(mainStart, mainEnd);
}

describe("SiteFooter shell contract", () => {
  it.each(shellFiles)("keeps %s footerless", (relativePath) => {
    const source = readSource(relativePath);

    expect(mainElementSource(source)).not.toContain("<SiteFooter");
    expect(source).not.toContain("<SiteFooter");
  });

  it("keeps table workspaces footerless so split views can fill the app height", () => {
    const source = readSource("app/(tables)/layout.tsx");

    expect(source).not.toContain("<SiteFooter");
    expect(source).not.toContain("components/layout/site-footer");
    expect(source).toContain("h-svh overflow-hidden");
    expect(source).toContain("flex min-h-0 min-w-0 flex-1 flex-col");
  });

  it("removes shared shell footer conditionals from other app shells", () => {
    const adminSource = readSource("app/(admin)/admin-layout-client.tsx");
    const mainSource = readSource("app/(main)/layout.tsx");

    expect(adminSource).not.toContain("SiteFooter");
    expect(adminSource).not.toContain("hideFooter");
    expect(mainSource).not.toContain("SiteFooter");
    expect(mainSource).not.toContain("isFullHeightWorkspace");
    expect(mainSource).toContain("flex min-h-0 min-w-0 flex-1 flex-col overflow-auto");
  });

  it("keeps the shared footer independent from page-content centering hacks", () => {
    const source = readSource("components/layout/site-footer.tsx");

    expect(source).toContain("data-shell-footer");
    expect(source).not.toContain("mt-auto");
    expect(source).not.toContain('className="contents"');
  });

  it("keeps the layout barrel pointed at the canonical SiteFooter", () => {
    const source = readSource("components/layout/index.ts");

    expect(source).toContain('export { SiteFooter, SiteFooter as Footer } from "./site-footer";');
    expect(source).not.toContain('from "./Footer"');
  });
});
