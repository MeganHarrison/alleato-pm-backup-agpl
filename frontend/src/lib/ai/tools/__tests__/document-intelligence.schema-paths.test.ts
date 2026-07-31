import { readFileSync } from "node:fs";
import { join } from "node:path";

describe("document intelligence schema paths", () => {
  it("uses the canonical specification section ownership model", () => {
    const source = readFileSync(
      join(process.cwd(), "src/lib/ai/tools/document-intelligence.ts"),
      "utf8",
    );

    expect(source).not.toContain('.from("specifications")');
    expect(source).not.toContain('"specification_id, link_method');
    expect(source).not.toContain('.eq("specification_id"');
    expect(source).not.toContain("specifications!inner");
    expect(source).toContain('.from("specification_sections")');
    expect(source).toContain('.eq("specification_section_id"');
    expect(source).toContain("specification_sections!inner");
  });
});
