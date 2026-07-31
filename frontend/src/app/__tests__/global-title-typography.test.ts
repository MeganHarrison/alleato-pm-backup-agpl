import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const appSource = (file: string) =>
  readFileSync(resolve(process.cwd(), "src/app", file), "utf8");

describe("global title typography", () => {
  it("loads Oswald Regular for the application title token", () => {
    const layout = appSource("layout.tsx");

    expect(layout).toContain('import { Inter, Oswald } from "next/font/google"');
    expect(layout).toContain('variable: "--font-oswald"');
    expect(layout).toContain('weight: ["400"]');
    expect(layout).toContain("${inter.variable} ${oswald.variable} font-sans");
  });

  it("enforces the title type contract for every heading level", () => {
    const styles = appSource("globals.css");

    expect(styles).toContain('--font-heading:');
    expect(styles).toContain('var(--font-oswald), "Oswald"');
    expect(styles).toContain('--font-heading-weight: 400;');
    expect(styles).toMatch(
      /h1,\s*h2,\s*h3,\s*h4,\s*h5,\s*h6\s*\{\s*font-family: var\(--font-heading\) !important;\s*font-weight: var\(--font-heading-weight\) !important;\s*letter-spacing: 0px !important;\s*text-transform: uppercase !important;/,
    );
  });
});
