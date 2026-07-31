import {
  categoryForExecutiveAttentionType,
  createExecutiveAttentionRequestSchema,
} from "../executive-attention-contract";

const validInput = {
  type: "financial_exposure" as const,
  title: "Owner invoice approval needs a decision",
  summary: "The owner invoice cannot move forward until the executive approves the documented exposure.",
  priority: "high" as const,
  impactOfDelay: "The draw and downstream subcontractor payment will slip.",
  accountableOwnerLabel: "Brandon",
  dueAt: "2026-07-17T16:00:00.000Z",
};

describe("Executive Attention request contract", () => {
  it("requires explicit evidence context fields before a client can create attention", () => {
    expect(createExecutiveAttentionRequestSchema.safeParse(validInput).success).toBe(true);
    expect(createExecutiveAttentionRequestSchema.safeParse({ ...validInput, impactOfDelay: "" }).success).toBe(false);
    expect(createExecutiveAttentionRequestSchema.safeParse({ ...validInput, accountableOwnerLabel: "" }).success).toBe(false);
    expect(createExecutiveAttentionRequestSchema.safeParse({ ...validInput, dueAt: "" }).success).toBe(false);
  });

  it("maps executive-facing types to the AAI-1097 controlled categories", () => {
    expect(categoryForExecutiveAttentionType("approval")).toBe("decision");
    expect(categoryForExecutiveAttentionType("financial_exposure")).toBe("financial");
    expect(categoryForExecutiveAttentionType("schedule_exception")).toBe("schedule");
    expect(categoryForExecutiveAttentionType("cross_project")).toBe("process");
  });
});
