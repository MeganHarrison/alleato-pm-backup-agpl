import { classifyExecutiveQuery } from "../executive-intelligence-routing";

describe("executive intelligence routing", () => {
  it("routes financial prompts to CFO mode", () => {
    expect(classifyExecutiveQuery("Where are margins slipping in this WIP report?")).toBe("cfo");
  });

  it("routes project health prompts to project intelligence mode", () => {
    expect(classifyExecutiveQuery("Which project blockers are affecting the schedule?")).toBe(
      "project_intelligence",
    );
  });

  it("routes follow-through prompts to risk and accountability mode", () => {
    expect(classifyExecutiveQuery("What overdue commitments need accountability?")).toBe(
      "risk_accountability",
    );
  });

  it("routes process prompts to operations improvement mode", () => {
    expect(classifyExecutiveQuery("What bottleneck should become an SOP?")).toBe(
      "operations_improvement",
    );
  });

  it("routes meeting prompts to meeting intelligence mode", () => {
    expect(classifyExecutiveQuery("What was decided in the Fireflies transcript?")).toBe(
      "meeting_intelligence",
    );
  });

  it("defaults broad leadership prompts to strategic advisor mode", () => {
    expect(classifyExecutiveQuery("What needs leadership attention this week?")).toBe(
      "strategic_advisor",
    );
  });
});
