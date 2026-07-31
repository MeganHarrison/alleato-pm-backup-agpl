import { existsSync, readFileSync } from "fs";
import { join } from "path";

/**
 * Guardrail for the "No routes found" production bug.
 *
 * The site-map (Page Access) route inventory used to be read from a gitignored
 * CSV at request time, so it was silently empty on Vercel. It now ships as a
 * committed JSON (`route-inventory.generated.json`) that the page imports
 * statically. These tests fail loudly if that file is missing, empty, or
 * malformed — i.e. exactly the condition that made the page show no rows.
 */

const generatedJsonPath = join(
  process.cwd(),
  "src/app/(admin)/site-map/route-inventory.generated.json",
);

type Row = {
  route: string;
  kind: string;
  dynamic: string;
  refCount: string;
  file: string;
  refSample: string;
};

describe("route-inventory.generated.json", () => {
  it("is committed and present in the source tree", () => {
    expect(existsSync(generatedJsonPath)).toBe(true);
  });

  it("contains a non-empty array of route rows (the empty case = the bug)", () => {
    const rows = JSON.parse(readFileSync(generatedJsonPath, "utf8")) as Row[];
    expect(Array.isArray(rows)).toBe(true);
    // The real app has hundreds of routes; anything near zero means the
    // generator did not run or wrote an empty file.
    expect(rows.length).toBeGreaterThan(100);
    expect(rows.filter((r) => r.kind === "page").length).toBeGreaterThan(50);
  });

  it("has the row shape readRouteInventory expects", () => {
    const rows = JSON.parse(readFileSync(generatedJsonPath, "utf8")) as Row[];
    for (const key of ["route", "kind", "dynamic", "refCount", "file", "refSample"]) {
      expect(rows[0]).toHaveProperty(key);
    }
    // Sanity: the home route is always present.
    expect(rows.some((r) => r.route === "/")).toBe(true);
  });
});
