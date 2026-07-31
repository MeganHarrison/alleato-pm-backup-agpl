import fs from "node:fs";
import path from "node:path";

describe("project home tab data route", () => {
  it("keeps document preview metadata in the lazy home documents payload", () => {
    const routePath = path.join(__dirname, "../route.ts");
    const source = fs.readFileSync(routePath, "utf8");

    expect(source).toContain("source_item_id,description");
    expect(source).toContain("preview_text");
    expect(source).toContain("project_home_document_metadata_preview_lookup_failed");
  });
});
