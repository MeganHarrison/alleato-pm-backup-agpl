import fs from "node:fs";
import path from "node:path";

describe("RFI create field composition", () => {
  const source = fs.readFileSync(
    path.join(__dirname, "rfi-form-fields.tsx"),
    "utf8",
  );
  const createPage = fs.readFileSync(
    path.resolve(__dirname, "../../app/(main)/[projectId]/rfis/new/page.tsx"),
    "utf8",
  );

  it("keeps all RFI metadata in the shared owner without a duplicate disclosure", () => {
    expect(source).not.toContain("additionalDetailsMode");
    expect(source).not.toContain("<Collapsible");
    expect(source).not.toContain('title="RFI Details"');
    expect(source).not.toContain('title="Additional Details"');
    expect(source).toContain('title="Assignment"');
    expect(source).toContain('title="Details"');
  });

  it("keeps the open-RFI essentials ahead of the assignment and details sections", () => {
    const essentials = source.indexOf('name="assignees"');
    const assignment = source.indexOf('title="Assignment"');
    const receivedFrom = source.indexOf('name="received_from"');

    expect(essentials).toBeGreaterThan(-1);
    expect(assignment).toBeGreaterThan(essentials);
    expect(receivedFrom).toBeGreaterThan(assignment);
  });

  it("uses the shared fields, persistent action, and error primitives on the create route", () => {
    expect(createPage).not.toContain("additionalDetailsMode");
    expect(createPage).toContain("<FormServerError");
    expect(createPage).toContain("<FormActions");
    expect(createPage).toContain("sticky");
  });

  it("keeps Distribution List in the two-column Assignment grid", () => {
    const assignmentStart = source.indexOf('title="Assignment"');
    const detailsStart = source.indexOf('title="Details"');
    const assignment = source.slice(assignmentStart, detailsStart);

    expect(assignment).toContain('<FormGrid columns={2}>');
    expect(assignment).toContain('name="responsible_contractor"');
    expect(assignment).toContain('name="distribution_list"');
  });
});
