import { z } from "zod";

export const PUBLIC_FMDS_EVALUATOR_KEY = "fmds_batch1_v1";

const optionalNonnegativeNumber = z.number().finite().min(0).optional();

export const OPEN_WIDTH_SEGMENTS_ERROR =
  "Open Width Segments must be a comma-separated list of values greater than zero, without empty entries.";

/**
 * Converts the UI's comma-separated field into an evaluator-safe input. Blank
 * tokens (including a trailing comma) are rejected rather than becoming zero.
 */
export function parseOpenWidthSegments(
  value: string,
): { values: number[] | undefined; error?: string } {
  if (value.trim() === "") return { values: undefined };

  const parts = value.split(",").map((part) => part.trim());
  const values = parts.map((part) => Number(part));
  if (
    parts.some((part) => part === "") ||
    values.some((width) => !Number.isFinite(width) || width <= 0)
  ) {
    return { values: undefined, error: OPEN_WIDTH_SEGMENTS_ERROR };
  }

  return { values };
}

const transverseFlueSchema = z
  .object({
    openWidthsIn: z.array(z.number().finite().positive()).min(1).optional(),
    horizontalUniformlyOpenPercent: z
      .number()
      .finite()
      .min(0)
      .max(100)
      .optional(),
    objectWidthIn: optionalNonnegativeNumber,
    objectAngleDegrees: z.number().finite().min(0).max(180).optional(),
    netWidthIn: optionalNonnegativeNumber,
    nominalHorizontalDistanceFt: optionalNonnegativeNumber,
    actualNetWidthIn: optionalNonnegativeNumber,
    verticallyAligned: z.boolean().optional(),
    unobstructedFullHeight: z.boolean().optional(),
    grossWidthBetweenUprightsIn: optionalNonnegativeNumber,
    netWidthBetweenUprightsIn: optionalNonnegativeNumber,
    affectedFlueHorizontalDistanceFt: optionalNonnegativeNumber,
  })
  .superRefine((value, context) => {
    const objectPair = [value.objectWidthIn, value.objectAngleDegrees];
    if (
      objectPair.some((item) => item !== undefined) &&
      objectPair.some((item) => item === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message: "Object width and angle must be entered together.",
        path: ["objectWidthIn"],
      });
    }

    const adequacyInputs = [
      value.nominalHorizontalDistanceFt,
      value.actualNetWidthIn,
      value.verticallyAligned,
      value.unobstructedFullHeight,
    ];
    if (
      adequacyInputs.slice(1).some((item) => item !== undefined) &&
      adequacyInputs.some((item) => item === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "Distance, actual net width, vertical alignment, and full-height clearance are all required for adequacy.",
        path: ["actualNetWidthIn"],
      });
    }

    const barrierInputs = [
      value.grossWidthBetweenUprightsIn,
      value.netWidthBetweenUprightsIn,
      value.affectedFlueHorizontalDistanceFt,
    ];
    if (
      barrierInputs.some((item) => item !== undefined) &&
      barrierInputs.some((item) => item === undefined)
    ) {
      context.addIssue({
        code: "custom",
        message:
          "All three vertical-barrier measurements must be entered together.",
        path: ["grossWidthBetweenUprightsIn"],
      });
    }
  });

export const asrsEstimatorRequestSchema = z.object({
  ceilingSprinklerType: z.enum(["standard_coverage", "extended_coverage"]),
  designSprinklerCount: z.number().int().positive(),
  transverseFlue: transverseFlueSchema.optional(),
});

export type AsrsEstimatorRequest = z.infer<typeof asrsEstimatorRequestSchema>;

export type AsrsEstimatorRequirementStatus = "verified" | "pending_review";

export interface AsrsEstimatorCitation {
  label: string;
  pageNumber: number | null;
  sourceType?: "table" | "figure";
  sourceId?: string;
  sourceIdentifier?: string;
  ruleKey?: string;
  reviewEventId?: string;
  href?: string;
}

export interface AsrsEstimatorRequirement {
  id: string;
  label: string;
  status: AsrsEstimatorRequirementStatus;
  value: string;
  citations: AsrsEstimatorCitation[];
}

export const asrsEstimatorResponseSchema = z.object({
  corpus: z.object({
    coverage: z.string().min(1),
    documentCode: z.string().min(1),
    revisionId: z.string().uuid(),
    revisionLabel: z.string().min(1),
    revisionStatus: z.enum(["staging", "active", "superseded", "rejected"]),
  }),
  requirements: z.array(
    z.object({
      id: z.string().min(1),
      label: z.string().min(1),
      status: z.enum(["verified", "pending_review"]),
      value: z.string().min(1),
      citations: z.array(
        z.object({
          label: z.string().min(1),
          pageNumber: z.number().int().positive().nullable(),
          sourceType: z.enum(["table", "figure"]).optional(),
          sourceId: z.string().uuid().optional(),
          sourceIdentifier: z.string().min(1).optional(),
          ruleKey: z.string().min(1).optional(),
          reviewEventId: z.string().uuid().optional(),
          href: z.string().startsWith("/asrs/").optional(),
        }),
      ),
    }),
  ),
});

export type AsrsEstimatorResponse = z.infer<typeof asrsEstimatorResponseSchema>;

export function getAsrsEvaluationStatus(
  response: AsrsEstimatorResponse,
): AsrsEstimatorRequirementStatus {
  return response.requirements.some(
    (requirement) => requirement.status === "pending_review",
  )
    ? "pending_review"
    : "verified";
}

export function formatAsrsCitation(citation: AsrsEstimatorCitation): string {
  if (citation.pageNumber === null || /\bpage\b/i.test(citation.label)) {
    return citation.label;
  }
  return `${citation.label}, page ${citation.pageNumber}`;
}

export function getAsrsPendingRequirements(): AsrsEstimatorRequirement[] {
  return [
    {
      id: "sprinkler-head-count",
      label: "Sprinkler head count",
      status: "pending_review",
      value:
        "Pending review. The reviewed Batch 1 rules do not calculate head count yet.",
      citations: [],
    },
    {
      id: "complete-configuration",
      label: "Complete ASRS configuration",
      status: "pending_review",
      value:
        "Pending review. Additional tables and figures must be verified before a complete configuration can be produced.",
      citations: [],
    },
    {
      id: "full-compliance",
      label: "Full FMDS 8-34 compliance determination",
      status: "pending_review",
      value:
        "Pending review. This estimator currently evaluates only the reviewed Batch 1 requirements.",
      citations: [],
    },
  ];
}
