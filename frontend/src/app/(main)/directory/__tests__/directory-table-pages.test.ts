import fs from "node:fs";
import path from "node:path";

const directoryRoot = path.join(__dirname, "..");

const listPages = [
  "companies/page.tsx",
  "clients/page.tsx",
  "contacts/page.tsx",
  "employees/page.tsx",
  "groups/page.tsx",
  "vendors/page.tsx",
];

const legacyTablePatterns = [
  /companies-data-table/,
  /contacts-data-table/,
  /employees-data-table/,
  /GenericDataTable/,
  /DirectoryTable/,
  /Responsive(?:Companies|Users|DistributionGroups)Table/,
];

describe("directory list table pages", () => {
  it.each(listPages)("keeps %s on the unified table shell", (relativePath) => {
    const source = fs.readFileSync(
      path.join(directoryRoot, relativePath),
      "utf8",
    );
    const delegatesToUnifiedCompaniesPage =
      relativePath === "clients/page.tsx" &&
      source.includes('export { default } from "../companies/page"');

    expect(source).toEqual(
      expect.stringMatching(
        delegatesToUnifiedCompaniesPage
          ? /companies\/page/
          : /UnifiedTablePage/,
      ),
    );

    for (const legacyPattern of legacyTablePatterns) {
      expect(source).not.toMatch(legacyPattern);
    }
  });

  it.each(["employees/page.tsx", "groups/page.tsx"])(
    "does not expose dead row selection on %s",
    (relativePath) => {
      const source = fs.readFileSync(
        path.join(directoryRoot, relativePath),
        "utf8",
      );

      expect(source).not.toContain("selection={{");
      expect(source).not.toContain("enableRowSelection: true");
      expect(source).not.toContain(
        "selectedCount: tableState.selectedIds.length",
      );
    },
  );

  it("keeps contacts row data editable inline instead of opening the preview drawer", () => {
    const source = fs.readFileSync(
      path.join(directoryRoot, "contacts/page.tsx"),
      "utf8",
    );

    expect(source).toContain("href={`/directory/contacts/${item.id}`}");
    expect(source).toContain("onInlineEdit(");
    expect(source).toContain('"company_id"');
    expect(source).toContain("InlineSelectEditor");
    expect(source).not.toContain("ContactPreviewPane");
    expect(source).not.toContain("onRowClick:");
    expect(source).not.toContain("sidePanel={{");
  });

  it("keeps contacts company inline edits accepted by the PATCH route", () => {
    const source = fs.readFileSync(
      path.join(
        directoryRoot,
        "..",
        "..",
        "api/directory/contacts/[contactId]/route.ts",
      ),
      "utf8",
    );

    expect(source).toContain("company_id");
    expect(source).toContain("parsed.company_id");
    expect(source).toContain("company_id: parsed.company_id");
  });

  it("keeps the shared companies and clients header free of redundant description copy", () => {
    const source = fs.readFileSync(
      path.join(directoryRoot, "companies/page.tsx"),
      "utf8",
    );

    expect(source).not.toContain(
      "Manage companies, clients, contacts, users, and employees across your organization",
    );
  });
});
