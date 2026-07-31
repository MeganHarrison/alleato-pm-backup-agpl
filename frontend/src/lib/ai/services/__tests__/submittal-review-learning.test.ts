import { buildSubmittalReviewCorrectionLearning } from "../agent-learning-service";

describe("buildSubmittalReviewCorrectionLearning", () => {
  const base = {
    reviewType: "submittal_review",
    aiFinding: "Fire rating of door assembly matches drawing A-101.",
    aiStatus: "Match",
    feedbackCategory: "hallucinated_issue",
    specSection: "08 14 00",
    requirementType: "fire_rating",
    correctedStatus: "Conflict",
    correctedReason: "Drawing A-101 specifies a 90-minute rating; submittal shows 60-minute.",
    sourceOfTruthRef: "Spec Section 08 14 00, page 3",
    projectId: 1102,
    feedbackId: "fb-123",
  };

  it("returns null for positive signals that need no prevention", () => {
    expect(
      buildSubmittalReviewCorrectionLearning({ ...base, feedbackCategory: "correct" }),
    ).toBeNull();
    expect(
      buildSubmittalReviewCorrectionLearning({
        ...base,
        feedbackCategory: "useful_low_priority",
      }),
    ).toBeNull();
  });

  it("activates a high-signal eval-failure learning for a correction", () => {
    const learning = buildSubmittalReviewCorrectionLearning(base);
    expect(learning).not.toBeNull();
    expect(learning?.source).toBe("eval_failure");
    expect(learning?.status).toBe("active");
    expect(learning?.confidence).toBe(0.75);
    expect(learning?.projectId).toBe(1102);
  });

  it("scope-tags so submittal reviews retrieve the learning", () => {
    const learning = buildSubmittalReviewCorrectionLearning(base);
    expect(learning?.scopeTags).toContain("submittal_review");
    expect(learning?.scopeTags).toContain("document_review");
    expect(learning?.scopeTags).toContain("hallucinated_issue");
    expect(learning?.scopeTags).toContain("fire_rating");
  });

  it("builds a prevention prompt from the category, correction, and source of truth", () => {
    const learning = buildSubmittalReviewCorrectionLearning(base);
    // category-specific guidance
    expect(learning?.preventionPrompt).toMatch(/cited text/i);
    // the verified human correction
    expect(learning?.preventionPrompt).toContain(
      "The correct status here is \"Conflict\", not \"Match\".",
    );
    expect(learning?.preventionPrompt).toContain("Spec Section 08 14 00, page 3");
  });

  it("still produces a usable prevention prompt when optional fields are absent", () => {
    const learning = buildSubmittalReviewCorrectionLearning({
      reviewType: "submittal_review",
      aiFinding: "Some finding",
      aiStatus: "Missing",
      feedbackCategory: "too_vague",
    });
    expect(learning).not.toBeNull();
    expect(learning?.preventionPrompt.trim().length).toBeGreaterThan(0);
    expect(learning?.scopeTags).toContain("too_vague");
  });
});
