import { z } from "zod";

import {
  createLearningPromotion,
  recordAiFeedbackEvent,
  type AiLearningPromotionRow,
  type AiLearningPromotionType,
} from "@/lib/ai/services/feedback-event-service";
import type { AiFeedbackEventRow } from "@/lib/ai/services/feedback-event-service";
import type { Json } from "@/types/database.types";

export const teachAlleatoIntakeSchema = z.object({
  whatShouldAlleatoLearn: z.string().trim().min(1).max(8000),
  appliesTo: z.enum(["personal", "project", "team", "company"]),
  workflowCategory: z.string().trim().min(1).max(120),
  exampleInput: z.string().trim().max(8000).nullable().optional(),
  exampleOutput: z.string().trim().max(8000).nullable().optional(),
  sourceEvidenceLink: z.string().trim().url().max(1000).nullable().optional(),
  uploadIds: z.array(z.string().trim().min(1).max(200)).max(20).optional(),
  suggestedReviewer: z.string().trim().max(200).nullable().optional(),
  whyThisMatters: z.string().trim().min(1).max(4000),
  perceivedRiskLevel: z.enum(["low", "medium", "high"]),
  projectId: z.number().int().positive().nullable().optional(),
  route: z.string().trim().max(300).nullable().optional(),
  sessionId: z.string().trim().min(1).max(200).nullable().optional(),
  metadata: z.unknown().optional(),
});

export type TeachAlleatoIntakeInput = z.infer<typeof teachAlleatoIntakeSchema>;

export interface SubmitTeachAlleatoIntakeParams {
  userId: string;
  intake: TeachAlleatoIntakeInput;
}

export interface SubmitTeachAlleatoIntakeResult {
  event: AiFeedbackEventRow;
  promotions: AiLearningPromotionRow[];
}

export class TeachAlleatoIntakePromotionError extends Error {
  constructor(
    public readonly eventId: string,
    message: string,
    public readonly cause?: unknown,
  ) {
    super(
      `Teach Alleato intake feedback event ${eventId} was created, but learning promotion creation failed: ${message}`,
    );
    this.name = "TeachAlleatoIntakePromotionError";
  }
}

type TeachCandidatePlan = {
  promotionType: AiLearningPromotionType;
  destinationTable: string;
  destinationRecordId: string;
  confidence: number;
  reviewNotes: string;
};

function normalizeText(value: string | null | undefined): string | null {
  const trimmed = value?.trim();
  return trimmed ? trimmed : null;
}

function titleFromLearning(learning: string): string {
  const firstLine = learning
    .split(/\r?\n/)
    .map((line) => line.trim())
    .find(Boolean);
  const source = firstLine ?? learning.trim();
  return source.length <= 90 ? source : `${source.slice(0, 87)}...`;
}

function categoryKey(category: string): string {
  return category.trim().toLowerCase().replace(/[^a-z0-9]+/g, "_");
}

function plannedCandidates(intake: TeachAlleatoIntakeInput): TeachCandidatePlan[] {
  const key = categoryKey(intake.workflowCategory);

  if (
    key.includes("prevent") ||
    key.includes("correction") ||
    key.includes("mistake") ||
    key.includes("wrong")
  ) {
    return [
      {
        promotionType: "agent_prevention_prompt",
        destinationTable: "agent_learnings",
        destinationRecordId: key,
        confidence: 0.72,
        reviewNotes:
          "Created from Teach Alleato intake as an agent-prevention candidate.",
      },
    ];
  }

  if (intake.appliesTo === "personal") {
    return [
      {
        promotionType: "user_preference",
        destinationTable: "ai_memories",
        destinationRecordId: "teach_alleato_personal_preference",
        confidence: 0.7,
        reviewNotes:
          "Created from Teach Alleato intake as a user preference candidate.",
      },
    ];
  }

  if (intake.appliesTo === "project" && intake.projectId) {
    return [
      {
        promotionType: "project_lesson",
        destinationTable: "ai_memories",
        destinationRecordId: `project_${intake.projectId}_lesson`,
        confidence: 0.74,
        reviewNotes:
          "Created from Teach Alleato intake as a project lesson candidate.",
      },
    ];
  }

  return [
    {
      promotionType: "workflow_rule",
      destinationTable: "ai_skills",
      destinationRecordId: key || "teach_alleato_workflow_rule",
      confidence: intake.perceivedRiskLevel === "high" ? 0.62 : 0.76,
      reviewNotes:
        "Created from Teach Alleato intake as a Skill Library candidate. Skill-shaped payload is staged in proposed_learning until approval.",
    },
  ];
}

function metadataRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function skillCandidatePayload(params: {
  eventId: string;
  userId: string;
  intake: TeachAlleatoIntakeInput;
  promotionType: AiLearningPromotionType;
}): Json {
  const { eventId, userId, intake, promotionType } = params;
  const exampleInput = normalizeText(intake.exampleInput);
  const exampleOutput = normalizeText(intake.exampleOutput);
  const title = titleFromLearning(intake.whatShouldAlleatoLearn);
  const appliesToProject = intake.appliesTo === "project" && intake.projectId;

  return {
    action: "review_teach_alleato_intake",
    ruleKind: "teach_alleato_skill_candidate",
    title,
    sourceEventId: eventId,
    sourceSurface: "teach_alleato",
    sourceRoute: intake.route ?? "/ai/teach",
    sourceUserId: userId,
    appliesTo: intake.appliesTo,
    workflowCategory: intake.workflowCategory,
    exampleInput,
    exampleOutput,
    sourceEvidenceLink: normalizeText(intake.sourceEvidenceLink),
    suggestedReviewer: normalizeText(intake.suggestedReviewer),
    whyThisMatters: intake.whyThisMatters,
    perceivedRiskLevel: intake.perceivedRiskLevel,
    proposedDestination:
      promotionType === "user_preference" || promotionType === "project_lesson"
        ? "ai_memories"
        : promotionType === "agent_prevention_prompt"
          ? "agent_learnings"
          : "skill_library",
    skillCandidate: {
      title,
      slug: categoryKey(title).slice(0, 80),
      summary: intake.whyThisMatters,
      body: intake.whatShouldAlleatoLearn,
      instructions: intake.whatShouldAlleatoLearn,
      category: intake.workflowCategory,
      scope: {
        type: intake.appliesTo,
        projectId: appliesToProject ? intake.projectId : null,
      },
      status: "candidate",
      ownerUserId: userId,
      suggestedReviewer: normalizeText(intake.suggestedReviewer),
      version: 1,
      examples: [
        {
          input: exampleInput,
          output: exampleOutput,
        },
      ].filter((example) => example.input || example.output),
      evidence: {
        link: normalizeText(intake.sourceEvidenceLink),
        uploadIds: intake.uploadIds ?? [],
      },
      sourceEventIds: [eventId],
      riskLevel: intake.perceivedRiskLevel,
      metadata: {
        intakeRoute: intake.route ?? "/ai/teach",
        sessionId: intake.sessionId ?? null,
        ...metadataRecord(intake.metadata),
      },
    },
    rationale:
      "A user submitted Teach Alleato intake. Review this staged skill-shaped payload before converting it into memory, an agent learning, a workflow rule, or a future Skill Library record.",
  };
}

export async function submitTeachAlleatoIntake({
  userId,
  intake,
}: SubmitTeachAlleatoIntakeParams): Promise<SubmitTeachAlleatoIntakeResult> {
  const sourceRoute = intake.route ?? "/ai/teach";
  const event = await recordAiFeedbackEvent({
    userId,
    projectId: intake.appliesTo === "project" ? intake.projectId ?? null : null,
    eventType: "teach_alleato_intake_submitted",
    eventFamily: "workflow_outcome",
    surface: "teach_alleato",
    subjectType: "teach_alleato_intake",
    signal: "needs_review",
    reasonCategory: intake.workflowCategory,
    freeText: intake.whatShouldAlleatoLearn,
    afterSnapshot: {
      whatShouldAlleatoLearn: intake.whatShouldAlleatoLearn,
      appliesTo: intake.appliesTo,
      workflowCategory: intake.workflowCategory,
      exampleInput: normalizeText(intake.exampleInput),
      exampleOutput: normalizeText(intake.exampleOutput),
      sourceEvidenceLink: normalizeText(intake.sourceEvidenceLink),
      uploadIds: intake.uploadIds ?? [],
      suggestedReviewer: normalizeText(intake.suggestedReviewer),
      whyThisMatters: intake.whyThisMatters,
      perceivedRiskLevel: intake.perceivedRiskLevel,
      projectId: intake.projectId ?? null,
    },
    sourceContext: {
      route: sourceRoute,
      sessionId: intake.sessionId ?? null,
      sourceEvidenceLink: normalizeText(intake.sourceEvidenceLink),
      uploadIds: intake.uploadIds ?? [],
    },
    sessionId: intake.sessionId ?? null,
    metadata: {
      source: "teach_alleato_intake",
      visibility: intake.appliesTo,
      skillLibrarySchemaStatus: "not_created",
      ...metadataRecord(intake.metadata),
    },
  });

  try {
    const promotions: AiLearningPromotionRow[] = [];
    for (const candidate of plannedCandidates(intake)) {
      const promotion = await createLearningPromotion({
        promotionType: candidate.promotionType,
        projectId: intake.appliesTo === "project" ? intake.projectId ?? null : null,
        sourceEventIds: [event.id],
        destinationTable: candidate.destinationTable,
        destinationRecordId: candidate.destinationRecordId,
        confidence: candidate.confidence,
        riskLevel: intake.perceivedRiskLevel,
        proposedLearning: skillCandidatePayload({
          eventId: event.id,
          userId,
          intake,
          promotionType: candidate.promotionType,
        }),
        reviewNotes: candidate.reviewNotes,
      });
      promotions.push(promotion);
    }

    if (promotions.length === 0) {
      throw new Error("no learning promotion candidates were generated");
    }

    return { event, promotions };
  } catch (error) {
    throw new TeachAlleatoIntakePromotionError(
      event.id,
      error instanceof Error ? error.message : "unknown promotion creation error",
      error,
    );
  }
}
