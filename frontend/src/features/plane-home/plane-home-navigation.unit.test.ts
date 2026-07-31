import fs from "node:fs";
import path from "node:path";

describe("Plane Home navigation cutover", () => {
  const source = fs.readFileSync(
    path.join(process.cwd(), "src", "features", "plane-home", "plane-home-page.tsx"),
    "utf8",
  );

  it("routes every Home work-item destination through canonical Plane Work Items", () => {
    expect(source).not.toContain("/${projectId}/tasks");
    expect(source).toContain("buildPlaneWorkItemsHref(projectId, { peekId: task.id })");
    expect(source.match(/buildPlaneWorkItemsHref\(projectId/g)?.length).toBeGreaterThanOrEqual(5);
  });

  it("uses the existing project setup destination instead of a missing settings route", () => {
    expect(source).toContain('href={`/${projectId}/setup`}');
    expect(source).not.toContain('href={`/${projectId}/settings`}');
  });
});
