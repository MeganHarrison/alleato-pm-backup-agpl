import {
  normalizeWorkflowTemplateRecord,
  normalizeWorkflowTemplateStep,
} from "../workflow-template-utils";

describe("workflow template utils", () => {
  it("normalizes legacy reviewer steps to approver steps", () => {
    expect(
      normalizeWorkflowTemplateStep({
        step_type: "Reviewer",
        required: false,
        user_id: "user-1",
      }),
    ).toEqual({
      step_type: "Approver",
      required: false,
      user_id: "user-1",
    });
  });

  it("falls back safely when stored step data is malformed", () => {
    expect(normalizeWorkflowTemplateStep("bad-shape")).toEqual({
      step_type: "Approver",
      required: true,
      user_id: null,
    });
  });

  it("normalizes workflow template records and step arrays", () => {
    expect(
      normalizeWorkflowTemplateRecord({
        id: "template-1",
        project_id: 876,
        name: "Architect Review",
        description: null,
        steps: [{ step_type: "Submitter" }, { step_type: "Reviewer" }],
        created_at: "2026-07-06T00:00:00.000Z",
        updated_at: "2026-07-06T00:00:00.000Z",
        created_by: null,
      }),
    ).toEqual({
      id: "template-1",
      project_id: 876,
      name: "Architect Review",
      description: null,
      steps: [
        { step_type: "Submitter", required: true, user_id: null },
        { step_type: "Approver", required: true, user_id: null },
      ],
      created_at: "2026-07-06T00:00:00.000Z",
      updated_at: "2026-07-06T00:00:00.000Z",
      created_by: null,
    });
  });
});
