import {
  formatTaskGenerationTrainingBlock,
  TASK_FEEDBACK_REASON_LABELS,
  shouldLoadTaskTrainingContext,
} from "../task-training-service";

describe("task training service", () => {
  it("detects task-generation requests that need training context", () => {
    expect(shouldLoadTaskTrainingContext("Add a task for Mike to call the owner")).toBe(true);
    expect(shouldLoadTaskTrainingContext("Create an action item from this meeting")).toBe(true);
    expect(shouldLoadTaskTrainingContext("Remind me to follow up Friday")).toBe(true);
    expect(shouldLoadTaskTrainingContext("What changed on the project today?")).toBe(false);
  });

  it("formats promoted examples as pre-generation constraints", () => {
    const block = formatTaskGenerationTrainingBlock([
      {
        name: "Confirm long-lead switchgear delivery date with vendor",
        assignee: "Sam",
        dueDate: "2026-05-12",
        priority: "high",
        notes: "Needed before schedule update",
      },
    ]);

    expect(block).toContain("Task Generation Feedback");
    expect(block).toContain("Before calling createGeneratedTask");
    expect(block).toContain("Confirm long-lead switchgear delivery date with vendor");
    expect(block).toContain("assignee: Sam");
    expect(block).toContain("priority: high");
    expect(block).toContain("Do not copy an example");
  });

  it("omits the context block when no examples are available", () => {
    expect(formatTaskGenerationTrainingBlock([])).toBe("");
  });

  it("keeps structured negative-feedback labels stable", () => {
    expect(TASK_FEEDBACK_REASON_LABELS.too_vague).toBe("Too vague");
    expect(TASK_FEEDBACK_REASON_LABELS.wrong_assignee).toBe("Wrong assignee");
    expect(TASK_FEEDBACK_REASON_LABELS.missing_context).toBe("Missing context");
  });
});
