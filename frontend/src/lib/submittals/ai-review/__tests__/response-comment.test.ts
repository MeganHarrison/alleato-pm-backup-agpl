import {
  buildAIReviewResponseComment,
  parseAIReviewResponseComment,
  recommendedAIReviewWorkflowResponseStatus,
} from "../response-comment";

function reviewResult(
  overrides: Partial<Parameters<typeof buildAIReviewResponseComment>[0]> = {},
): Parameters<typeof buildAIReviewResponseComment>[0] {
  return {
    summary: "One finish conflict needs revision.",
    recommendation: "Revise finish or provide architect approval.",
    checks: [
      {
        title: "Submitted finish conflicts with specification",
        finding: "Dark bronze was submitted, but clear anodized is required.",
        status: "fail",
        reviewerDisposition: "pending",
      },
      {
        title: "Storefront system matches basis of design",
        finding: "Kawneer Trifab 451T matches the allowed system.",
        status: "pass",
        reviewerDisposition: "pending",
      },
    ],
    ...overrides,
  };
}

describe("AI review workflow response comments", () => {
  it("builds and parses scannable workflow response context", () => {
    const comment = buildAIReviewResponseComment(reviewResult());
    const parsed = parseAIReviewResponseComment(comment);

    expect(parsed).toEqual({
      summary: "One finish conflict needs revision.",
      recommendation: "Revise finish or provide architect approval.",
      findings: [
        "Submitted finish conflicts with specification: Dark bronze was submitted, but clear anodized is required.",
      ],
    });
  });

  it("does not parse normal workflow comments as AI review context", () => {
    expect(parseAIReviewResponseComment("Please revise and resubmit.")).toBeNull();
  });

  it("preserves older one-line AI review context comments", () => {
    expect(
      parseAIReviewResponseComment(
        "AI review response context: finish conflict requires revision.",
      ),
    ).toEqual({
      summary: "finish conflict requires revision.",
      recommendation: null,
      findings: [],
    });
  });

  it("recommends revise and resubmit for unresolved failures", () => {
    expect(recommendedAIReviewWorkflowResponseStatus(reviewResult())).toBe(
      "Revise and Resubmit",
    );
  });

  it("recommends approved when failures are dismissed", () => {
    expect(
      recommendedAIReviewWorkflowResponseStatus(
        reviewResult({
          checks: [
            {
              title: "Dismissed finish concern",
              finding: "Reviewer accepted alternate finish.",
              status: "fail",
              reviewerDisposition: "dismissed",
            },
          ],
        }),
      ),
    ).toBe("Approved");
  });
});
