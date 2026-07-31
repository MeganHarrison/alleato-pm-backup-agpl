import {
  normalizeReviewRunTimestamp,
  normalizeStoredReadiness,
  normalizeStoredSourceCoverage,
} from "../persistence";
import { SubmittalAIReviewModelOutputSchema } from "../schemas";

describe("SubmittalAIReviewModelOutputSchema", () => {
  it("accepts structured output with nullable fields", () => {
    const parsed = SubmittalAIReviewModelOutputSchema.parse({
      summary: "Summary",
      recommendation: "Revise and Resubmit",
      dataGaps: ["Need stamped drawing"],
      checks: [
        {
          checkType: "drawing_compliance",
          status: "fail",
          severity: "high",
          title: "Door frame mismatch",
          finding: "Submitted frame does not match the drawing.",
          expectedValue: null,
          submittedValue: null,
          recommendation: "Update the frame schedule.",
          sourceKeys: ["DWG-1", "SUB-1"],
          confidence: null,
          missingData: [],
        },
      ],
    });

    expect(parsed.checks[0].sourceKeys).toEqual(["DWG-1", "SUB-1"]);
  });
});

describe("review run persistence normalization", () => {
  it("normalizes postgres timestamps into ISO strings", () => {
    expect(
      normalizeReviewRunTimestamp("2026-06-25 04:59:23.222572+00"),
    ).toBe("2026-06-25T04:59:23.222Z");
  });

  it("hydrates incomplete running rows with explicit readiness defaults", () => {
    expect(normalizeStoredReadiness({}, "running", null)).toEqual({
      state: "partial",
      summary: "Review run is still assembling source context and findings.",
      layers: [],
    });
  });

  it("fills missing source coverage counts with zeros", () => {
    expect(normalizeStoredSourceCoverage({})).toEqual({
      submittalDocumentCount: 0,
      linkedDrawingCount: 0,
      ragChunkCount: 0,
      specSourceCount: 0,
    });
  });
});
