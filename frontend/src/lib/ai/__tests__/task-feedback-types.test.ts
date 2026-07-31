import {
  getTaskFeedbackReasonLabel,
  summarizeTaskFeedbackReasonCategories,
} from "../task-feedback-types";

describe("task feedback types", () => {
  it("summarizes structured feedback reasons by count and percentage", () => {
    expect(
      summarizeTaskFeedbackReasonCategories([
        "too_vague",
        "wrong_assignee",
        "too_vague",
        null,
      ]),
    ).toEqual([
      {
        category: "too_vague",
        label: "Too vague",
        count: 2,
        percentage: 50,
      },
      {
        category: "uncategorized",
        label: "Uncategorized",
        count: 1,
        percentage: 25,
      },
      {
        category: "wrong_assignee",
        label: "Wrong assignee",
        count: 1,
        percentage: 25,
      },
    ]);
  });

  it("returns stable labels for known and unknown categories", () => {
    expect(getTaskFeedbackReasonLabel("missing_context")).toBe("Missing context");
    expect(getTaskFeedbackReasonLabel("legacy_reason")).toBe("legacy_reason");
    expect(getTaskFeedbackReasonLabel(null)).toBeNull();
  });
});
