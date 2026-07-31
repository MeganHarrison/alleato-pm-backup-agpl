import fs from "node:fs";
import path from "node:path";

const pageSource = fs.readFileSync(path.join(__dirname, "..", "page.tsx"), "utf8");
const companySheetSource = fs.readFileSync(
  path.join(
    __dirname,
    "..",
    "..",
    "..",
    "..",
    "..",
    "components",
    "domain",
    "directory",
    "CompanyDetailSheet.tsx",
  ),
  "utf8",
);

describe("project directory company person copy", () => {
  it("keeps the project directory company add flow framed around people and the company directory", () => {
    expect(pageSource).toContain("Add from company directory");
    expect(pageSource).toContain("Add person");
    expect(pageSource).toContain("Create new person");
    expect(pageSource).toContain("Search company directory…");
    expect(pageSource).toContain(
      "No people found in the company directory.",
    );
    expect(pageSource).not.toContain("Create new contact");
    expect(pageSource).not.toContain("Search contacts…");
    expect(pageSource).not.toMatch(/>\s*Add contact\s*</);
  });

  it("keeps the company sheet add flow aligned with the company directory wording and loud failures", () => {
    expect(companySheetSource).toContain("Add from company directory");
    expect(companySheetSource).toContain("Create new person");
    expect(companySheetSource).toContain("Search company directory...");
    expect(companySheetSource).toContain("People in company directory");
    expect(companySheetSource).toContain(
      'toast.error("Could not add person"',
    );
    expect(companySheetSource).not.toContain("Create new contact");
    expect(companySheetSource).not.toContain("No existing contacts found.");
    expect(companySheetSource).not.toMatch(/>\s*Add contact\s*</);
  });
});
