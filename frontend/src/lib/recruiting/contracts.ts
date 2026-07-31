import { z } from "zod";

export const recruitingStageSchema = z.enum([
  "new",
  "review",
  "qualified",
  "interview",
  "offer",
  "hired",
  "closed",
]);

export const recruitingDispositionSchema = z.enum([
  "advance",
  "hold",
  "not_qualified",
  "evaluate_another_role",
  "withdrawn",
  "hired",
]);

export const recruitingEvidenceStatusSchema = z.enum([
  "review_ready",
  "needs_review",
]);

export const recruitingResumeDocumentSchema = z.object({
  id: z.string().min(1).max(120),
  filename: z.string().min(1).max(255),
  mimeType: z.literal("application/pdf"),
  sizeBytes: z
    .number()
    .int()
    .positive()
    .max(10 * 1024 * 1024),
  synthetic: z.boolean(),
  reviewStatus: z.enum(["pending", "verified"]),
});

export const recruitingCandidateSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().trim().min(1).max(160),
  email: z.string().email().max(254),
  phone: z.string().trim().min(1).max(40),
  location: z.string().trim().min(1).max(160),
  currentRole: z.string().trim().min(1).max(160),
  currentCompany: z.string().trim().min(1).max(160),
  resumeFacts: z.array(z.string().trim().min(1).max(500)).max(40),
});

export const recruitingApplicationSchema = z
  .object({
    id: z.string().min(1).max(120),
    candidateId: z.string().min(1).max(120),
    requisitionId: z.string().min(1).max(120),
    stage: recruitingStageSchema,
    source: z.string().trim().min(1).max(160),
    receivedAt: z.string().datetime({ offset: true }),
    evidenceStatus: recruitingEvidenceStatusSchema,
    disposition: recruitingDispositionSchema,
    dispositionReason: z.string().trim().min(1).max(900).nullable(),
    resumeDocument: recruitingResumeDocumentSchema,
  })
  .superRefine((application, context) => {
    if (
      ["not_qualified", "withdrawn"].includes(application.disposition) &&
      !application.dispositionReason
    ) {
      context.addIssue({
        code: "custom",
        path: ["dispositionReason"],
        message:
          "A disposition reason is required for not qualified or withdrawn applications.",
      });
    }
  });

export const recruitingRequisitionSchema = z.object({
  id: z.string().min(1).max(120),
  title: z.string().trim().min(1).max(200),
  location: z.string().trim().min(1).max(160),
  status: z.enum(["open", "paused", "closed"]),
});

export const recruitingAuditEventSchema = z.object({
  id: z.string().min(1).max(240),
  occurredAt: z.string().datetime({ offset: true }),
  actorId: z.string().min(1).max(120),
  actorLabel: z.string().min(1).max(160),
  action: z.enum([
    "application.stage_changed",
    "application.disposition_changed",
    "application.synthetic_intake_created",
    "application.resume_reviewed",
    "application.source_history_imported",
  ]),
  applicationId: z.string().min(1).max(120),
  candidateId: z.string().min(1).max(120),
  fromValue: z.string().max(160).nullable(),
  toValue: z.string().max(160).nullable(),
  detail: z.string().min(1).max(1000),
});

function addDuplicateIssues(
  values: ReadonlyArray<{ id: string }>,
  collection: string,
  context: z.RefinementCtx,
) {
  const seen = new Set<string>();
  values.forEach((value, index) => {
    if (seen.has(value.id)) {
      context.addIssue({
        code: "custom",
        path: [collection, index, "id"],
        message: `Duplicate ${collection} id: ${value.id}.`,
      });
    }
    seen.add(value.id);
  });
}

export const recruitingWorkspaceSnapshotSchema = z
  .object({
    schemaVersion: z.literal(1),
    revision: z.number().int().nonnegative(),
    syntheticOnly: z.literal(true),
    updatedAt: z.string().datetime({ offset: true }),
    requisitions: z.array(recruitingRequisitionSchema).min(1).max(100),
    candidates: z.array(recruitingCandidateSchema).max(5000),
    applications: z.array(recruitingApplicationSchema).max(10000),
    auditEvents: z.array(recruitingAuditEventSchema).max(50000),
  })
  .superRefine((snapshot, context) => {
    addDuplicateIssues(snapshot.requisitions, "requisitions", context);
    addDuplicateIssues(snapshot.candidates, "candidates", context);
    addDuplicateIssues(snapshot.applications, "applications", context);
    addDuplicateIssues(snapshot.auditEvents, "auditEvents", context);

    const candidateIds = new Set(
      snapshot.candidates.map((candidate) => candidate.id),
    );
    const requisitionIds = new Set(
      snapshot.requisitions.map((requisition) => requisition.id),
    );
    const applicationIds = new Set(
      snapshot.applications.map((application) => application.id),
    );

    snapshot.candidates.forEach((candidate, index) => {
      if (!candidate.email.toLowerCase().endsWith("@example.test")) {
        context.addIssue({
          code: "custom",
          path: ["candidates", index, "email"],
          message:
            "Synthetic-only workspaces accept only example.test addresses.",
        });
      }
    });

    snapshot.applications.forEach((application, index) => {
      if (!candidateIds.has(application.candidateId)) {
        context.addIssue({
          code: "custom",
          path: ["applications", index, "candidateId"],
          message: `Application ${application.id} references a missing candidate.`,
        });
      }
      if (!requisitionIds.has(application.requisitionId)) {
        context.addIssue({
          code: "custom",
          path: ["applications", index, "requisitionId"],
          message: `Application ${application.id} references a missing requisition.`,
        });
      }
      if (!application.resumeDocument.synthetic) {
        context.addIssue({
          code: "custom",
          path: ["applications", index, "resumeDocument", "synthetic"],
          message:
            "Real resume documents are disabled in the local review workspace.",
        });
      }
    });

    snapshot.auditEvents.forEach((event, index) => {
      if (!applicationIds.has(event.applicationId)) {
        context.addIssue({
          code: "custom",
          path: ["auditEvents", index, "applicationId"],
          message: `Audit event ${event.id} references a missing application.`,
        });
      }
      if (!candidateIds.has(event.candidateId)) {
        context.addIssue({
          code: "custom",
          path: ["auditEvents", index, "candidateId"],
          message: `Audit event ${event.id} references a missing candidate.`,
        });
      }
    });
  });

export type RecruitingStage = z.infer<typeof recruitingStageSchema>;
export type RecruitingDisposition = z.infer<typeof recruitingDispositionSchema>;
export type RecruitingEvidenceStatus = z.infer<
  typeof recruitingEvidenceStatusSchema
>;
export type RecruitingResumeDocument = z.infer<
  typeof recruitingResumeDocumentSchema
>;
export type RecruitingCandidate = z.infer<typeof recruitingCandidateSchema>;
export type RecruitingApplication = z.infer<typeof recruitingApplicationSchema>;
export type RecruitingRequisition = z.infer<typeof recruitingRequisitionSchema>;
export type RecruitingAuditEvent = z.infer<typeof recruitingAuditEventSchema>;
export type RecruitingWorkspaceSnapshot = z.infer<
  typeof recruitingWorkspaceSnapshotSchema
>;
