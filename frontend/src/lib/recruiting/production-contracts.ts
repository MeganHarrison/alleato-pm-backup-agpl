import { z } from "zod";

const databaseTimestampSchema = z
  .string()
  .refine((value) => !Number.isNaN(Date.parse(value)), "Invalid ISO datetime");

export const productionRecruitingStageSchema = z.enum([
  "new",
  "review",
  "qualified",
  "interview",
  "offer",
  "hired",
  "closed",
]);

export const productionRecruitingRoleSchema = z.enum([
  "recruiting_admin",
  "recruiter",
  "hiring_manager",
  "interviewer",
  "executive",
]);

export const recruitingViewerSchema = z.object({
  userId: z.string().uuid(),
  personId: z.string().uuid(),
  role: productionRecruitingRoleSchema,
  canRead: z.boolean(),
  canWrite: z.boolean(),
  canAdmin: z.boolean(),
});

export const recruitingFeatureAvailabilitySchema = z.object({
  sharedData: z.literal(true),
  testMode: z.boolean(),
  publicIntake: z.boolean(),
  resumeUpload: z.boolean(),
  resumeExtraction: z.boolean(),
  outlookMail: z.boolean(),
  outlookCalendar: z.boolean(),
  sms: z.boolean(),
  eSignature: z.boolean(),
  automation: z.boolean(),
  aiAssistance: z.boolean(),
  retentionExecution: z.boolean(),
  unavailableReasons: z.record(z.string(), z.string()),
});

export const recruitingMicrosoftConnectionSchema = z.object({
  connected: z.boolean(),
  email: z.string().email().nullable(),
  displayName: z.string().nullable(),
  scopes: z.array(z.string()),
  mailConnected: z.boolean(),
  calendarConnected: z.boolean(),
  connectedAt: z.string().datetime().nullable(),
  lastVerifiedAt: z.string().datetime().nullable(),
});

export const productionRequisitionSchema = z.object({
  id: z.string().uuid(),
  requisitionNumber: z.string(),
  title: z.string(),
  department: z.string().nullable(),
  location: z.string().nullable(),
  jobsite: z.string().nullable(),
  status: z.enum([
    "draft",
    "pending_approval",
    "approved",
    "open",
    "paused",
    "filled",
    "closed",
    "canceled",
  ]),
  isConfidential: z.boolean(),
  headcount: z.number().int().positive(),
  rowVersion: z.number().int().positive(),
});

export const productionStageDefinitionSchema = z.object({
  id: z.string().uuid(),
  requisitionId: z.string().uuid(),
  key: productionRecruitingStageSchema,
  label: z.string(),
  position: z.number().int().nonnegative(),
  isTerminal: z.boolean(),
  requiresDisposition: z.boolean(),
});

export const productionCandidateSummarySchema = z.object({
  id: z.string().uuid(),
  displayName: z.string(),
  email: z.string().nullable(),
  phone: z.string().nullable(),
  currentCompany: z.string().nullable(),
  currentTitle: z.string().nullable(),
  location: z.string().nullable(),
  status: z.enum(["active", "prospect", "hired", "archived", "merged"]),
  rowVersion: z.number().int().positive(),
});

export const recruitingResumeReferenceSchema = z.object({
  documentId: z.string().uuid(),
  originalFileName: z.string().min(1),
});

export const productionApplicationSummarySchema = z.object({
  id: z.string().uuid(),
  isTestApplication: z.boolean(),
  candidateId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  stage: productionRecruitingStageSchema,
  status: z.enum(["active", "withdrawn", "rejected", "hired", "closed"]),
  dispositionCode: z.string().nullable(),
  dispositionReason: z.string().nullable(),
  appliedAt: databaseTimestampSchema,
  lastActivityAt: databaseTimestampSchema,
  rowVersion: z.number().int().positive(),
  resume: recruitingResumeReferenceSchema.nullable(),
});

export const recruitingUnassignedResumeSchema = z.object({
  candidateId: z.string().uuid(),
  candidateName: z.string().min(1),
  documentId: z.string().uuid(),
  originalFileName: z.string().min(1),
  uploadedAt: databaseTimestampSchema,
  expiresAt: databaseTimestampSchema,
  rowVersion: z.number().int().positive(),
});

export const recruitingInboxSchema = z.object({
  openTasks: z.number().int().nonnegative(),
  overdueTasks: z.number().int().nonnegative(),
  pendingApprovals: z.number().int().nonnegative(),
  unscheduledInterviews: z.number().int().nonnegative(),
  missingScorecards: z.number().int().nonnegative(),
  failedProviderAttempts: z.number().int().nonnegative(),
  staleApplications: z.number().int().nonnegative(),
});

export const recruitingOperationsSummarySchema = z.object({
  interviews: z.number().int().nonnegative(),
  offers: z.number().int().nonnegative(),
  talentPools: z.number().int().nonnegative(),
  activeAutomations: z.number().int().nonnegative(),
  aiRunsAwaitingReview: z.number().int().nonnegative(),
});

export const recruitingWorkspaceResponseSchema = z.object({
  ok: z.literal(true),
  source: z.enum(["supabase-live", "synthetic-preview"]),
  viewer: recruitingViewerSchema,
  featureAvailability: recruitingFeatureAvailabilitySchema,
  microsoftConnection: recruitingMicrosoftConnectionSchema,
  requisitions: z.array(productionRequisitionSchema),
  selectedRequisitionId: z.string().uuid().nullable(),
  stageDefinitions: z.array(productionStageDefinitionSchema),
  candidates: z.array(productionCandidateSummarySchema),
  applications: z.array(productionApplicationSummarySchema),
  unassignedResumes: z.array(recruitingUnassignedResumeSchema),
  inbox: recruitingInboxSchema,
  operations: recruitingOperationsSummarySchema,
  fetchedAt: z.string().datetime(),
});

const commandBaseSchema = z.object({
  idempotencyKey: z.string().uuid(),
  requestHash: z.string().min(32).max(128),
});

export const transitionApplicationCommandSchema = commandBaseSchema.extend({
  command: z.literal("application.transition"),
  applicationId: z.string().uuid(),
  nextStage: productionRecruitingStageSchema,
  expectedRowVersion: z.number().int().positive(),
  reason: z.string().trim().max(2000).nullable().default(null),
});

export const setDispositionCommandSchema = commandBaseSchema.extend({
  command: z.literal("application.disposition"),
  applicationId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
  dispositionCode: z.enum([
    "advance",
    "hold",
    "not_qualified",
    "evaluate_another_role",
    "withdrawn",
    "hired",
    "position_closed",
    "duplicate",
  ]),
  reason: z.string().trim().max(2000).nullable().default(null),
});

export const assignResumeCommandSchema = commandBaseSchema.extend({
  command: z.literal("resume.assign"),
  candidateId: z.string().uuid(),
  requisitionId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

export const createRequisitionCommandSchema = commandBaseSchema.extend({
  command: z.literal("requisition.create"),
  requisitionNumber: z.string().trim().min(1).max(50),
  title: z.string().trim().min(1).max(200),
  department: z.string().trim().max(160).nullable().default(null),
  location: z.string().trim().max(200).nullable().default(null),
  jobsite: z.string().trim().max(200).nullable().default(null),
  headcount: z.number().int().min(1).max(500).default(1),
  isConfidential: z.boolean().default(false),
});

export const setRequisitionLifecycleCommandSchema = commandBaseSchema.extend({
  command: z.literal("requisition.lifecycle"),
  requisitionId: z.string().uuid(),
  nextStatus: z.enum(["closed", "canceled"]),
  expectedRowVersion: z.number().int().positive(),
  reason: z.string().trim().min(5).max(2000),
});

export const deleteRequisitionCommandSchema = commandBaseSchema.extend({
  command: z.literal("requisition.delete"),
  requisitionId: z.string().uuid(),
  expectedRowVersion: z.number().int().positive(),
});

export const createTaskCommandSchema = commandBaseSchema.extend({
  command: z.literal("task.create"),
  requisitionId: z.string().uuid(),
  candidateId: z.string().uuid().nullable().default(null),
  applicationId: z.string().uuid().nullable().default(null),
  title: z.string().trim().min(1).max(240),
  taskType: z.enum([
    "review",
    "follow_up",
    "schedule",
    "scorecard",
    "approval",
    "offer",
    "retention",
    "provider_failure",
    "other",
  ]),
  priority: z.enum(["low", "normal", "high", "urgent"]).default("normal"),
  dueAt: z.string().datetime().nullable().default(null),
});

export const requestAiAssistanceCommandSchema = commandBaseSchema.extend({
  command: z.literal("ai.request"),
  action: z.enum([
    "extract_resume_facts",
    "draft_job_description",
    "draft_message",
    "draft_interview_questions",
    "summarize_evidence",
    "suggest_schedule",
    "detect_possible_duplicate",
  ]),
  requisitionId: z.string().uuid().nullable().default(null),
  candidateId: z.string().uuid().nullable().default(null),
  applicationId: z.string().uuid().nullable().default(null),
  promptVersion: z.string().trim().min(1).max(100),
});

export const recruitingCommandSchema = z.discriminatedUnion("command", [
  transitionApplicationCommandSchema,
  setDispositionCommandSchema,
  assignResumeCommandSchema,
  createRequisitionCommandSchema,
  setRequisitionLifecycleCommandSchema,
  deleteRequisitionCommandSchema,
  createTaskCommandSchema,
  requestAiAssistanceCommandSchema,
]);

export const recruitingCommandResponseSchema = z.object({
  ok: z.literal(true),
  command: z.string(),
  result: z.record(z.string(), z.unknown()),
});

export const recruitingUatFeatureActionSchema = z.enum([
  "resume_evidence_extraction",
  "sms_preview",
  "offer_esignature_preview",
  "workflow_automation_preview",
  "ai_evidence_summary",
]);

export const recruitingUatFeatureRequestSchema = z.object({
  action: recruitingUatFeatureActionSchema,
  idempotencyKey: z.string().uuid(),
  applicationId: z.string().uuid(),
});

export const recruitingUatFeatureResultSchema = z.object({
  runId: z.string().uuid(),
  action: recruitingUatFeatureActionSchema,
  status: z.literal("succeeded"),
  summary: z.string().min(1),
  evidence: z.array(
    z.object({
      label: z.string().min(1),
      value: z.string().min(1),
      source: z.string().min(1),
    }),
  ),
  safety: z.object({
    delivery: z.literal("not_sent"),
    employmentDecision: z.literal("human_required"),
    syntheticDataOnly: z.literal(true),
  }),
  expiresAt: databaseTimestampSchema,
});

export const recruitingUatFeatureResponseSchema = z.object({
  ok: z.literal(true),
  result: recruitingUatFeatureResultSchema,
  replayed: z.boolean(),
});

export type ProductionRecruitingStage = z.infer<
  typeof productionRecruitingStageSchema
>;
export type ProductionRecruitingRole = z.infer<
  typeof productionRecruitingRoleSchema
>;
export type RecruitingViewer = z.infer<typeof recruitingViewerSchema>;
export type RecruitingFeatureAvailability = z.infer<
  typeof recruitingFeatureAvailabilitySchema
>;
export type RecruitingMicrosoftConnection = z.infer<
  typeof recruitingMicrosoftConnectionSchema
>;
export type RecruitingWorkspaceResponse = z.infer<
  typeof recruitingWorkspaceResponseSchema
>;
export type RecruitingCommand = z.infer<typeof recruitingCommandSchema>;
export type RecruitingUatFeatureAction = z.infer<
  typeof recruitingUatFeatureActionSchema
>;
export type RecruitingUatFeatureResult = z.infer<
  typeof recruitingUatFeatureResultSchema
>;
export type ProductionRequisitionStatus = z.infer<
  typeof productionRequisitionSchema
>["status"];

export function requisitionAcceptsActiveWorkflow(
  status: ProductionRequisitionStatus,
): boolean {
  return !["filled", "closed", "canceled"].includes(status);
}

export function recruitingApplicationIsVisible({
  testMode,
  isTestApplication,
}: {
  testMode: boolean;
  isTestApplication: boolean;
}): boolean {
  return testMode || !isTestApplication;
}

export function testApplicationAllowsStage(
  stage: ProductionRecruitingStage,
): boolean {
  return ["new", "review", "qualified", "interview"].includes(stage);
}

const productionStageTransitions: Record<
  ProductionRecruitingStage,
  ProductionRecruitingStage[]
> = {
  new: ["review"],
  review: ["new", "qualified"],
  qualified: ["review", "interview"],
  interview: ["qualified", "offer"],
  offer: ["interview", "hired"],
  hired: [],
  closed: ["review"],
};

export function allowedProductionStageTransitions(
  stage: ProductionRecruitingStage,
): ProductionRecruitingStage[] {
  return productionStageTransitions[stage];
}
