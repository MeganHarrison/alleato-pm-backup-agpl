import {
  dedupeSubcontractorCompanies,
  isInternalTeamSlot,
} from "./project-command-center";

describe("project home team sidebar helpers", () => {
  it("keeps Alleato contacts in the project team section", () => {
    expect(
      isInternalTeamSlot({
        email: "mharrison@alleatogroup.com",
        companyName: "Alleato Group",
      }),
    ).toBe(true);

    expect(
      isInternalTeamSlot({
        email: "support@megankharrison.com",
        companyName: null,
      }),
    ).toBe(false);
  });

  it("dedupes subcontractor companies by name", () => {
    expect(
      dedupeSubcontractorCompanies([
        { name: "ABC Electrical" },
        { name: " abc electrical " },
        { name: "Delta Mechanical" },
      ]),
    ).toEqual([
      { name: "ABC Electrical" },
      { name: "Delta Mechanical" },
    ]);
  });
});
