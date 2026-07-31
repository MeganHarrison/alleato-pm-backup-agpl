import { z } from "zod";

export const BrandonReviewOutcomeSchema = z.enum([
  "draft_copied",
  "draft_edited",
  "skipped",
  "delegated",
  "watched",
  "marked_no_action",
]);

export type BrandonReviewOutcome = z.infer<typeof BrandonReviewOutcomeSchema>;

export const BrandonAssistantActionSchema = z.enum([
  "reply",
  "delegate",
  "watch",
  "ignore",
]);

export type BrandonAssistantAction = z.infer<typeof BrandonAssistantActionSchema>;

export const BrandonAssistantPrioritySchema = z.enum([
  "urgent",
  "high",
  "normal",
  "low",
]);

export type BrandonAssistantPriority = z.infer<typeof BrandonAssistantPrioritySchema>;

export const ProjectAssignmentReasonSignalSchema = z.enum([
  "subject_line",
  "sender",
  "message_body",
  "attachment",
  "existing_project_context",
  "other",
]);

export type ProjectAssignmentReasonSignal = z.infer<
  typeof ProjectAssignmentReasonSignalSchema
>;

export const ProjectAssignmentFeedbackSchema = z
  .object({
    status: z.enum(["correct", "incorrect", "unreviewed"]),
    correctedProjectId: z.number().int().positive().nullable().optional(),
    reasonSignals: z.array(ProjectAssignmentReasonSignalSchema).optional(),
    reasonNote: z.string().trim().max(500).nullable().optional(),
  })
  .superRefine((value, ctx) => {
    if (value.status === "incorrect" && value.correctedProjectId === undefined) {
      ctx.addIssue({
        code: "custom",
        path: ["correctedProjectId"],
        message: "Correct project is required when marking assignment incorrect.",
      });
    }

    if (value.status !== "unreviewed" && (value.reasonSignals?.length ?? 0) === 0) {
      ctx.addIssue({
        code: "custom",
        path: ["reasonSignals"],
        message: "At least one project assignment reason is required for AI training.",
      });
    }

    if (
      value.reasonSignals?.includes("other") &&
      !value.reasonNote?.trim()
    ) {
      ctx.addIssue({
        code: "custom",
        path: ["reasonNote"],
        message: "Add a note when selecting Other for project assignment reasoning.",
      });
    }
  });

export const AssistantFieldVerdictSchema = z.enum([
  "correct",
  "incorrect",
  "unreviewed",
]);

export const AssistantFieldFeedbackSchema = z.object({
  action: AssistantFieldVerdictSchema.optional(),
  priority: AssistantFieldVerdictSchema.optional(),
  category: AssistantFieldVerdictSchema.optional(),
  draft: AssistantFieldVerdictSchema.optional(),
  project: AssistantFieldVerdictSchema.optional(),
  owner: AssistantFieldVerdictSchema.optional(),
  reason: AssistantFieldVerdictSchema.optional(),
  score: AssistantFieldVerdictSchema.optional(),
});

export const BrandonAssistantReviewPayloadSchema = z
  .object({
    assistantAction: z.enum(["reply", "delegate", "watch", "ignore"]),
    assistantPriority: BrandonAssistantPrioritySchema,
    assistantCategory: z.string().trim().max(100).nullable().optional(),
    assistantScore: z.number().finite().min(0).max(200).nullable().optional(),
    reviewOutcome: BrandonReviewOutcomeSchema,
    draftBody: z.string().trim().max(20_000).nullable().optional(),
    reviewerNote: z.string().trim().max(1_000).nullable().optional(),
    assistantReason: z.string().trim().max(1_000).nullable().optional(),
    assistantOwner: z.string().trim().max(200).nullable().optional(),
    assistantRisk: z.string().trim().max(1_000).nullable().optional(),
    assistantEvidence: z.string().trim().max(1_000).nullable().optional(),
    sourceMetadata: z.record(z.string(), z.unknown()).optional(),
    projectAssignment: ProjectAssignmentFeedbackSchema.optional(),
    fieldFeedback: AssistantFieldFeedbackSchema.optional(),
  })
  .superRefine((value, ctx) => {
    const draftRequired =
      value.reviewOutcome === "draft_copied" ||
      value.reviewOutcome === "draft_edited";

    if (draftRequired && !value.draftBody?.trim()) {
      ctx.addIssue({
        code: "custom",
        path: ["draftBody"],
        message: "Draft body is required when recording a draft review outcome.",
      });
    }
  });

export type BrandonAssistantReviewPayload = z.infer<
  typeof BrandonAssistantReviewPayloadSchema
>;
