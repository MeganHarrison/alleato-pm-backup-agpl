import { parseManpowerCsv } from "./parser";
import { SAMPLE_MANPOWER_CSV } from "./sample-data";

describe("parseManpowerCsv", () => {
  it("parses the sample manpower export into projects and assignments", () => {
    const result = parseManpowerCsv(SAMPLE_MANPOWER_CSV, {
      sourceLabel: "sample.csv",
      importedAt: "2026-06-17T00:00:00.000Z",
    });

    expect(result.projects.length).toBeGreaterThan(30);
    expect(result.assignments.length).toBeGreaterThan(100);
    expect(
      result.assignments.some(
        (assignment) =>
          assignment.projectName.includes("Westfield Collective") &&
          assignment.role === "Senior PM" &&
          assignment.assigneeName === "Jesse Dawson",
      ),
    ).toBe(true);
    expect(
      result.assignments.some(
        (assignment) =>
          assignment.status === "open" && assignment.assigneeName === "New Hire",
      ),
    ).toBe(true);
  });

  it("fails loudly when required columns are missing", () => {
    expect(() => parseManpowerCsv("Task Name,Start\nExample,Mon 3/16/26")).toThrow(
      /missing required columns/i,
    );
  });
});
