import {
  normalizeSubmittalWorkflowRole,
  SUBMITTAL_WORKFLOW_ROLES,
} from "../workflow-roles";

describe("submittal workflow roles", () => {
  it("only exposes Procore parity roles", () => {
    expect(SUBMITTAL_WORKFLOW_ROLES).toEqual(["Submitter", "Approver"]);
  });

  it("keeps submitter and maps legacy reviewer values to approver", () => {
    expect(normalizeSubmittalWorkflowRole("Submitter")).toBe("Submitter");
    expect(normalizeSubmittalWorkflowRole("Approver")).toBe("Approver");
    expect(normalizeSubmittalWorkflowRole("Reviewer")).toBe("Approver");
    expect(normalizeSubmittalWorkflowRole(null)).toBe("Approver");
  });
});
