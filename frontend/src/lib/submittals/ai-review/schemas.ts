import { z } from "zod";

export const submittalReviewRunStatusSchema = z.enum([
  "queued",
  "running",
  "ready",
  "partial",
  "not_ready",
  "failed",
]);

export const submittalReviewReadinessStateSchema = z.enum([
  "ready",
  "partial",
  "not_ready",
  "failed",
]);

export const submittalReviewCheckStatusSchema = z.enum([
  "pass",
  "fail",
  "warning",
  "missing_information",
  "unable_to_determine",
  "needs_human_review",
]);

export const submittalReviewSeveritySchema = z.enum([
  "critical",
  "high",
  "medium",
  "low",
  "informational",
]);

export const submittalReviewDispositionSchema = z.enum([
  "pending",
  "accepted",
  "dismissed",
  "edited",
]);

export const submittalReviewSourceTypeSchema = z.enum([
  "submittal_document",
  "drawing",
  "drawing_page",
  "specification",
  "rag_chunk",
]);

export const submittalReviewCheckTypeSchema = z.enum([
  "completeness",
  "spec_compliance",
  "drawing_compliance",
  "manufacturer_approval",
  "dimension_conflict",
  "finish_conflict",
  "rating_conflict",
  "coordination_risk",
  "missing_information",
]);

export const SubmittalAIReviewSourceReferenceSchema = z.object({
  sourceKey: z.string(),
  sourceType: submittalReviewSourceTypeSchema,
  sourceId: z.string(),
  documentMetadataId: z.string().nullable(),
  drawingId: z.string().nullable(),
  drawingNumber: z.string().nullable(),
  pageNumber: z.number().int().nullable(),
  chunkIndex: z.number().int().nullable(),
  label: z.string(),
  excerpt: z.string().nullable(),
  confidence: z.number().nullable(),
});

export const SubmittalAIReviewReadinessLayerSchema = z.object({
  key: z.string(),
  label: z.string(),
  state: submittalReviewReadinessStateSchema,
  reasons: z.array(z.string()),
  availableCount: z.number().int().nonnegative().nullable(),
  totalCount: z.number().int().nonnegative().nullable(),
});

export const SubmittalAIReviewCheckSchema = z.object({
  id: z.string().uuid().optional(),
  checkType: submittalReviewCheckTypeSchema,
  status: submittalReviewCheckStatusSchema,
  severity: submittalReviewSeveritySchema,
  title: z.string(),
  finding: z.string(),
  expectedValue: z.string().nullable(),
  submittedValue: z.string().nullable(),
  recommendation: z.string().nullable(),
  sourceReferences: z.array(SubmittalAIReviewSourceReferenceSchema),
  confidence: z.number().nullable(),
  missingData: z.array(z.string()),
  reviewerDisposition: submittalReviewDispositionSchema.default("pending"),
  reviewerNotes: z.string().nullable().default(null),
});

export const SubmittalAIReviewModelOutputSchema = z.object({
  summary: z.string(),
  recommendation: z.string(),
  checks: z.array(
    z.object({
      checkType: submittalReviewCheckTypeSchema,
      status: submittalReviewCheckStatusSchema,
      severity: submittalReviewSeveritySchema,
      title: z.string(),
      finding: z.string(),
      expectedValue: z.string().nullable(),
      submittedValue: z.string().nullable(),
      recommendation: z.string().nullable(),
      sourceKeys: z.array(z.string()),
      confidence: z.number().nullable(),
      missingData: z.array(z.string()),
    }),
  ),
  dataGaps: z.array(z.string()),
});

export const SubmittalAIReviewRunSchema = z.object({
  runId: z.string().uuid(),
  projectId: z.number().int(),
  submittalId: z.string().uuid(),
  status: submittalReviewRunStatusSchema,
  focusArea: z.string().nullable(),
  summary: z.string().nullable(),
  recommendation: z.string().nullable(),
  startedAt: z.string().datetime(),
  completedAt: z.string().datetime().nullable(),
  readiness: z.object({
    state: submittalReviewReadinessStateSchema,
    summary: z.string(),
    layers: z.array(SubmittalAIReviewReadinessLayerSchema),
  }),
  sourceCoverage: z.object({
    submittalDocumentCount: z.number().int().nonnegative(),
    linkedDrawingCount: z.number().int().nonnegative(),
    ragChunkCount: z.number().int().nonnegative(),
    specSourceCount: z.number().int().nonnegative(),
  }),
  linkedDrawings: z.array(
    z.object({
      id: z.string().uuid(),
      submittalId: z.string().uuid(),
      drawingId: z.string().uuid(),
      drawingNumber: z.string(),
      title: z.string(),
      discipline: z.string().nullable(),
      revision: z.string().nullable(),
      readiness: z.object({
        state: submittalReviewReadinessStateSchema,
        reasons: z.array(z.string()),
        ocrTextReady: z.boolean(),
        visionReady: z.boolean(),
        embeddedReady: z.boolean(),
      }),
    }),
  ),
  checks: z.array(SubmittalAIReviewCheckSchema),
  error: z
    .object({
      code: z.string(),
      message: z.string(),
    })
    .nullable(),
});

export type SubmittalAIReviewSourceReference = z.infer<
  typeof SubmittalAIReviewSourceReferenceSchema
>;
export type SubmittalAIReviewReadinessLayer = z.infer<
  typeof SubmittalAIReviewReadinessLayerSchema
>;
export type SubmittalAIReviewCheck = z.infer<
  typeof SubmittalAIReviewCheckSchema
>;
export type SubmittalAIReviewModelOutput = z.infer<
  typeof SubmittalAIReviewModelOutputSchema
>;
export type SubmittalAIReviewRun = z.infer<typeof SubmittalAIReviewRunSchema>;
