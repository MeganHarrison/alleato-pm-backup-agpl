import {
  asrsEstimatorRequestSchema,
  asrsEstimatorResponseSchema,
  formatAsrsCitation,
  getAsrsEvaluationStatus,
  getAsrsPendingRequirements,
  OPEN_WIDTH_SEGMENTS_ERROR,
  parseOpenWidthSegments,
} from "../asrs-estimator";

describe("ASRS estimator contract", () => {
  it("accepts the reviewed hose-demand and transverse-flue inputs", () => {
    const result = asrsEstimatorRequestSchema.safeParse({
      ceilingSprinklerType: "standard_coverage",
      designSprinklerCount: 12,
      transverseFlue: {
        openWidthsIn: [0.75, 1.25],
        netWidthIn: 1.5,
        nominalHorizontalDistanceFt: 2.5,
        actualNetWidthIn: 3,
        verticallyAligned: true,
        unobstructedFullHeight: true,
      },
    });

    expect(result.success).toBe(true);
  });

  it("rejects partial barrier inputs instead of guessing", () => {
    const result = asrsEstimatorRequestSchema.safeParse({
      ceilingSprinklerType: "extended_coverage",
      designSprinklerCount: 8,
      transverseFlue: { grossWidthBetweenUprightsIn: 1.5 },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("All three");
    }
  });

  it("rejects incomplete adequacy facts instead of dropping continuity flags", () => {
    const result = asrsEstimatorRequestSchema.safeParse({
      ceilingSprinklerType: "standard_coverage",
      designSprinklerCount: 12,
      transverseFlue: { verticallyAligned: true, unobstructedFullHeight: false },
    });

    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toContain("actual net width");
    }
  });

  it("rejects blank, nonnumeric, and zero open-width segments", () => {
    expect(parseOpenWidthSegments("0.75, ")).toEqual({
      values: undefined,
      error: OPEN_WIDTH_SEGMENTS_ERROR,
    });
    expect(parseOpenWidthSegments("0.75, nope").error).toBe(
      OPEN_WIDTH_SEGMENTS_ERROR,
    );
    expect(parseOpenWidthSegments("0.75, 0").error).toBe(
      OPEN_WIDTH_SEGMENTS_ERROR,
    );
    expect(parseOpenWidthSegments("0.75, 1.25")).toEqual({
      values: [0.75, 1.25],
    });
  });

  it("keeps unsupported calculations visibly pending", () => {
    expect(getAsrsPendingRequirements().map((item) => item.label)).toEqual([
      "Sprinkler head count",
      "Complete ASRS configuration",
      "Full FMDS 8-34 compliance determination",
    ]);
    expect(
      getAsrsPendingRequirements().every(
        (item) => item.status === "pending_review",
      ),
    ).toBe(true);
  });

  it("does not repeat a page already included in the source label", () => {
    expect(
      formatAsrsCitation({
        label: "FMDS 8-34 Table 2.1.4.5.4, PDF page 12",
        pageNumber: 12,
      }),
    ).toBe("FMDS 8-34 Table 2.1.4.5.4, PDF page 12");
    expect(
      formatAsrsCitation({ label: "Table 2.1.4.5.4", pageNumber: 12 }),
    ).toBe("Table 2.1.4.5.4, page 12");
  });

  it("derives the saved aggregate state from typed requirement statuses", () => {
    const response = asrsEstimatorResponseSchema.parse({
      corpus: {
        coverage: "batch1_only",
        documentCode: "FMDS0834",
        revisionId: "11111111-1111-4111-8111-111111111111",
        revisionLabel: "2026-04",
        revisionStatus: "staging",
      },
      requirements: getAsrsPendingRequirements(),
    });

    expect(getAsrsEvaluationStatus(response)).toBe("pending_review");
  });
});
