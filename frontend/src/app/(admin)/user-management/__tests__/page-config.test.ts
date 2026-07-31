import fs from "node:fs";
import path from "node:path";

const pagePath = path.join(__dirname, "..", "page.tsx");

describe("user-management table configuration", () => {
  const source = fs.readFileSync(pagePath, "utf8");

  it("keeps app users bulk delete and row selection wired to the manage-user surface", () => {
    expect(source).toContain("enableBulkDelete: canManageUserRows");
    expect(source).toContain("enableRowSelection: canManageUserRows");
    expect(source).toContain("onBulkDelete:");
    expect(source).toContain("bulkDeleteUsersMutation.mutate(");
  });

  it("keeps both permission template tabs bulk-selectable and bulk-deletable", () => {
    expect(source).toContain("enableBulkDelete: true");
    expect(source).toContain("enableRowSelection: true");
    expect(source).toContain("selectedCount: selectedTemplateIds.length");
    expect(source).toContain("bulkDeleteTemplatesMutation.mutate(selectedTemplateIds)");
  });
});
