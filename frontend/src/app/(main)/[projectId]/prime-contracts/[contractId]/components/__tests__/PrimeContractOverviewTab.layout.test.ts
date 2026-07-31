import { readFileSync } from "node:fs";
import { join } from "node:path";

const componentPath = join(
  process.cwd(),
  "src/app/(main)/[projectId]/prime-contracts/[contractId]/components/PrimeContractOverviewTab.tsx",
);

describe("PrimeContractOverviewTab layout", () => {
  it("keeps General Information label/value rows horizontally aligned", () => {
    const source = readFileSync(componentPath, "utf8");
    const start = source.indexOf('<SectionRuleHeading label="General Information"');
    const end = source.indexOf('<SectionRuleHeading label="Inclusions + Exclusions"', start);

    expect(start).toBeGreaterThan(-1);
    expect(end).toBeGreaterThan(start);

    const generalInformationSection = source.slice(start, end);
    const horizontalRows = [
      "Contract #",
      "Title",
      "Status",
      "Executed",
      "Owner/Client",
      "Contractor",
      "Architect",
      "Start Date",
      "Est. Completion",
      "Substantial Date",
      "Actual Completion",
      "Signed Date",
      "Termination Date",
      "Default Retainage",
      "Description",
      "Attachments",
    ];

    for (const label of horizontalRows) {
      expect(generalInformationSection).toContain(`label="${label}"`);
      expect(generalInformationSection).not.toMatch(
        new RegExp(`<LabelValueRow[^>]*label="${label}"[^>]*\\bstacked\\b`),
      );
    }
  });
});
