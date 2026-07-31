import { readFileSync } from "node:fs";
import { join } from "node:path";

const componentPath = join(
  process.cwd(),
  "src/components/domain/change-events/ChangeEventLineItemsTable.tsx",
);

describe("ChangeEventLineItemsTable layout", () => {
  it("keeps Revenue ROM visible outside the expectingRevenue-only detail columns", () => {
    const source = readFileSync(componentPath, "utf8");
    const tableStart = source.indexOf("<InlineTableHeader");
    const summaryStart = source.indexOf('<InlineTableHeaderCell colSpan={3}', tableStart);
    const revenueRomHeader = source.indexOf(">Revenue ROM</InlineTableHeaderCell>", summaryStart);
    const nonCommittedHeader = source.indexOf(">Non-committed</InlineTableHeaderCell>", summaryStart);

    expect(tableStart).toBeGreaterThan(-1);
    expect(summaryStart).toBeGreaterThan(tableStart);
    expect(revenueRomHeader).toBeGreaterThan(summaryStart);
    expect(nonCommittedHeader).toBeGreaterThan(revenueRomHeader);

    const conditionalStart = source.lastIndexOf("{expectingRevenue &&", revenueRomHeader);
    const conditionalEnd = source.indexOf(")}", conditionalStart);
    expect(revenueRomHeader).toBeGreaterThan(conditionalEnd);
  });

  it("right-aligns the Qty and Unit Cost headers to match their numeric body cells", () => {
    const source = readFileSync(componentPath, "utf8");

    // Every "Qty" / "Unit Cost" header cell (Cost and Revenue groups) must
    // carry text-right — the body cells below them are numeric and
    // right-aligned, so a left/center header reads as misaligned columns.
    const headerCellPattern =
      /<InlineTableHeaderCell className="([^"]*)">(Qty|Unit Cost)<\/InlineTableHeaderCell>/g;

    const matches = [...source.matchAll(headerCellPattern)];
    expect(matches.length).toBeGreaterThan(0);
    // Each entry is [label, className] so a failure names which header (Qty /
    // Unit Cost) is missing text-right rather than reporting a bare boolean.
    const offenders = matches
      .map((match) => ({ label: match[2], className: match[1] }))
      .filter((cell) => !cell.className.includes("text-right"))
      .map((cell) => cell.label);
    expect(offenders).toEqual([]);
  });
});
