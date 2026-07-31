import {
  buildSubmittalWorkflowResponseRows,
  buildSubmittalWorkflowStepRows,
} from "../create-workflow";

describe("submittal create workflow helpers", () => {
  const steps = [
    {
      user_id: "11111111-1111-1111-1111-111111111111",
      step_type: "Approver",
    },
    {
      user_id: "22222222-2222-2222-2222-222222222222",
      step_type: "Reviewer",
    },
  ];

  it("builds ordered workflow step rows", () => {
    expect(buildSubmittalWorkflowStepRows("submittal-1", steps)).toEqual([
      {
        submittal_id: "submittal-1",
        step_order: 1,
        step_type: "Approver",
      },
      {
        submittal_id: "submittal-1",
        step_order: 2,
        step_type: "Reviewer",
      },
    ]);
  });

  it("builds pending response rows from inserted workflow steps", () => {
    expect(
      buildSubmittalWorkflowResponseRows("submittal-1", steps, [
        { id: "step-1", step_order: 1 },
        { id: "step-2", step_order: 2 },
      ]),
    ).toEqual([
      {
        submittal_id: "submittal-1",
        workflow_step_id: "step-1",
        responder_id: "11111111-1111-1111-1111-111111111111",
        response_status: "Pending",
      },
      {
        submittal_id: "submittal-1",
        workflow_step_id: "step-2",
        responder_id: "22222222-2222-2222-2222-222222222222",
        response_status: "Pending",
      },
    ]);
  });

  it("fails loudly when inserted steps do not match the requested workflow", () => {
    expect(() =>
      buildSubmittalWorkflowResponseRows("submittal-1", steps, [
        { id: "step-1", step_order: 1 },
      ]),
    ).toThrow("Inserted workflow step count does not match requested workflow.");
  });
});
