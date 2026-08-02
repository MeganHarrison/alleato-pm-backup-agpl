import { readFileSync } from "node:fs";
import { resolve } from "node:path";

const primaryActionSurfaces = [
  "../plane-commitments/plane-commitments-page.tsx",
  "../plane-cycles/plane-cycles-page.tsx",
  "../plane-drafts/plane-drafts-page.tsx",
  "../plane-prime-contracts/plane-prime-contracts-page.tsx",
  "../plane-submittals/plane-submittals-page.tsx",
  "./plane-work-items-page.tsx",
] as const;

describe("Plane primary action colors", () => {
  it.each(primaryActionSurfaces)(
    "%s uses the Alleato primary token instead of Plane's legacy teal",
    (relativePath) => {
      const source = readFileSync(resolve(__dirname, relativePath), "utf8");

      expect(source).toContain("bg-primary");
      expect(source).toContain("text-primary-foreground");
      expect(source).toContain("hover:bg-primary/90");
      expect(source).not.toMatch(
        /bg-\[#075985\]|hover:bg-\[#(?:0c4a6e|064e6e)\]/,
      );
    },
  );
});
