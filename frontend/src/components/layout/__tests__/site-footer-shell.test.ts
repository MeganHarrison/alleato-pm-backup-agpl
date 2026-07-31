import { readFileSync } from "node:fs";
import { join } from "node:path";

const frontendRoot = join(process.cwd(), "src");

// Document shells: content scrolls at the shell level, so the footer lands at
// the end of the content when you scroll to the bottom.
const footerShells = [
  "app/(main)/layout.tsx",
  "app/(admin)/admin-layout-client.tsx",
  "app/(dashboard)/layout.tsx",
  "app/(developer)/layout.tsx",
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
  it.each(footerShells)(
    "mounts the shared SiteFooter in %s",
    (relativePath) => {
      const source = readSource(relativePath);

      expect(source).toContain("<SiteFooter");
      expect(source).toContain('from "@/components/layout/site-footer"');
    },
  );

  it.each(footerShells)(
    "keeps the footer OUTSIDE the scrolling <main> in %s",
    (relativePath) => {
      // The footer must never live inside the scrolling <main>. When it did,
      // short pages let the flex column collapse and the footer floated into
      // the middle of the viewport — the bug that got it removed entirely.
      // It sits as the last child of the scroll container, AFTER </main>, so
      // it scrolls with the page (non-sticky) and lands at the end of content.
      const source = readSource(relativePath);

      expect(mainElementSource(source)).not.toContain("<SiteFooter");
    },
  );

  it.each(footerShells)(
    "lets <main> grow to its content in %s so the footer sits below it, not over it",
    (relativePath) => {
      // A footer after <main> only clears the content if <main> grows to its
      // content height. `min-h-0` caps <main> to the free space, so its content
      // overflows the box and renders on top of the footer. Document shells must
      // NOT cap <main> with min-h-0.
      const source = readSource(relativePath);
      const main = mainElementSource(source);

      expect(main).not.toContain("min-h-0");
    },
  );

  it("keeps table workspaces full-height and footerless", () => {
    // Tables are a fixed-height split workspace that fills the shell and scrolls
    // internally (the "fill shell height" behavior). A non-sticky document
    // footer cannot coexist with that, so this shell stays footerless.
    const source = readSource("app/(tables)/layout.tsx");

    expect(source).not.toContain("<SiteFooter");
    expect(source).not.toContain("components/layout/site-footer");
    expect(source).toContain("h-svh overflow-hidden");
    expect(source).toContain("flex min-h-0 flex-1 flex-col overflow-auto");
  });

  it("keeps the main shell scroll container full-height", () => {
    const source = readSource("app/(main)/layout.tsx");

    expect(source).toContain(
      "flex min-h-0 min-w-0 flex-1 flex-col overflow-auto",
    );
    expect(source).toContain("<SiteFooter");
  });

  it("keeps the shared footer independent from page-content centering hacks", () => {
    const source = readSource("components/layout/site-footer.tsx");

    expect(source).toContain("data-shell-footer");
    expect(source).not.toContain("mt-auto");
    expect(source).not.toContain('className="contents"');
  });

  it("keeps the layout barrel pointed at the canonical SiteFooter", () => {
    const source = readSource("components/layout/index.ts");

    expect(source).toContain(
      'export { SiteFooter, SiteFooter as Footer } from "./site-footer";',
    );
    expect(source).not.toContain('from "./Footer"');
  });
});
