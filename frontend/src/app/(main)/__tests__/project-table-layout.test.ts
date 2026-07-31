import fs from "node:fs";
import path from "node:path";

const projectTablePagePath = path.join(
  process.cwd(),
  "src/app/(main)/page.tsx",
);

describe("Company project table layout", () => {
  it("keeps scope tabs and table controls in the shared unified row", () => {
    const source = fs.readFileSync(projectTablePagePath, "utf8");

    expect(source).toContain("toolbarInlineWithHeader: false");
    expect(source).toContain("toolbarWithTabs: true");
  });

  it("does not constrain the labeled create-project action to icon width", () => {
    const source = fs.readFileSync(projectTablePagePath, "utf8");

    expect(source).toContain("<span>New Project</span>");
    expect(source).not.toContain('className="h-11 w-11 p-0"');
  });
});
