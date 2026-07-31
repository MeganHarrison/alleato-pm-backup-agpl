import {
  CRM_PURSUIT_PLAYBOOK,
  planMissingPursuitSteps,
} from "@/lib/crm/playbooks";

describe("CRM pursuit playbook", () => {
  it("uses the reporting date for due-today and preserves day offsets", () => {
    expect(planMissingPursuitSteps("2026-07-29", [])).toEqual([
      {
        title: "Confirm stakeholders and decision process",
        dueDate: "2026-07-29",
      },
      {
        title: "Complete pursuit qualification review",
        dueDate: "2026-08-01",
      },
      {
        title: "Prepare proposal or bid checkpoint",
        dueDate: "2026-08-05",
      },
    ]);
  });

  it("returns only missing steps so an interrupted request is retry-safe", () => {
    expect(
      planMissingPursuitSteps("2026-07-29", [
        CRM_PURSUIT_PLAYBOOK[0].title,
      ]),
    ).toHaveLength(2);
  });
});
