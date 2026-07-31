import type { Database, Json } from "@/types/database.types";

export type AiLearningPromotionRow =
  Database["public"]["Tables"]["ai_learning_promotions"]["Row"];
export type AiFeedbackEventRow =
  Database["public"]["Tables"]["ai_feedback_events"]["Row"];

export type PromotionKind =
  | "all"
  | "teach"
  | "skill"
  | "memory"
  | "retrieval"
  | "attribution"
  | "agent_prevention"
  | "workflow";

export type PromotionLearning = {
  action?: string;
  title?: string;
  toolName?: string;
  sourceDocumentId?: string | null;
  sourceChunkId?: string | null;
  querySignature?: string;
  problemSignature?: string;
  preventionPrompt?: string;
  content?: string;
  visibility?: string;
  memoryId?: string | null;
  memoryType?: string | null;
  reasonCategory?: string | null;
  reason?: string | null;
  sourceSurface?: string | null;
  sourceRoute?: string | null;
  sourceMessageId?: string | null;
  sourceUserId?: string | null;
  appliesTo?: string | null;
  workflowCategory?: string | null;
  exampleInput?: string | null;
  exampleOutput?: string | null;
  sourceEvidenceLink?: string | null;
  suggestedReviewer?: string | null;
  whyThisMatters?: string | null;
  proposedDestination?: string | null;
  perceivedRiskLevel?: string | null;
  teachAlleatoSubmissionId?: string | null;
  recommendedResolution?: string;
  candidateProjectName?: string | null;
  pagePath?: string | null;
  taskSnapshot?: Record<string, unknown> | null;
  rationale?: string;
  signalCounts?: {
    helpful?: number;
    problem?: number;
    total?: number;
  };
};

export function jsonObject(value: Json | unknown): Record<string, unknown> {
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : {};
}

function optionalString(
  record: Record<string, unknown>,
  key: string,
): string | undefined {
  const value = record[key];
  return typeof value === "string" && value.trim() ? value : undefined;
}

function nullableString(
  record: Record<string, unknown>,
  key: string,
): string | null {
  return optionalString(record, key) ?? null;
}

function firstNullableString(
  record: Record<string, unknown>,
  keys: string[],
): string | null {
  for (const key of keys) {
    const value = nullableString(record, key);
    if (value) return value;
  }
  return null;
}

export function readLearning(value: Json): PromotionLearning {
  const record = jsonObject(value);
  const skillCandidate = jsonObject(record.skillCandidate);
  const skillScope = jsonObject(skillCandidate.scope);
  const skillEvidence = jsonObject(skillCandidate.evidence);
  const skillExamples = Array.isArray(skillCandidate.examples)
    ? skillCandidate.examples
    : [];
  const firstSkillExample = jsonObject(skillExamples[0]);
  const signalCounts = jsonObject(record.signalCounts);
  return {
    action: optionalString(record, "action"),
    title: optionalString(record, "title"),
    toolName: optionalString(record, "toolName"),
    sourceDocumentId: nullableString(record, "sourceDocumentId"),
    sourceChunkId: nullableString(record, "sourceChunkId"),
    querySignature: optionalString(record, "querySignature"),
    problemSignature: optionalString(record, "problemSignature"),
    preventionPrompt: optionalString(record, "preventionPrompt"),
    content: optionalString(record, "content"),
    visibility: optionalString(record, "visibility"),
    memoryId: nullableString(record, "memoryId"),
    memoryType: nullableString(record, "memoryType"),
    reasonCategory: nullableString(record, "reasonCategory"),
    reason: nullableString(record, "reason"),
    sourceSurface: nullableString(record, "sourceSurface"),
    sourceRoute: firstNullableString(record, [
      "sourceRoute",
      "route",
      "pageRoute",
    ]),
    sourceMessageId: nullableString(record, "sourceMessageId"),
    sourceUserId:
      firstNullableString(record, [
        "sourceUserId",
        "submitterUserId",
        "submittedBy",
        "userId",
      ]) ?? nullableString(skillCandidate, "ownerUserId"),
    appliesTo:
      firstNullableString(record, ["appliesTo", "scope", "whereApplies"]) ??
      nullableString(skillScope, "type"),
    workflowCategory:
      firstNullableString(record, [
        "workflowCategory",
        "category",
        "workflow_category",
      ]) ?? nullableString(skillCandidate, "category"),
    exampleInput:
      firstNullableString(record, [
        "exampleInput",
        "inputExample",
        "example_input",
      ]) ?? nullableString(firstSkillExample, "input"),
    exampleOutput:
      firstNullableString(record, [
        "exampleOutput",
        "outputExample",
        "example_output",
      ]) ?? nullableString(firstSkillExample, "output"),
    sourceEvidenceLink:
      firstNullableString(record, [
        "sourceEvidenceLink",
        "evidenceLink",
        "sourceLink",
        "sourceUrl",
        "url",
      ]) ?? nullableString(skillEvidence, "link"),
    suggestedReviewer:
      firstNullableString(record, [
        "suggestedReviewer",
        "reviewer",
        "reviewerEmail",
      ]) ?? nullableString(skillCandidate, "suggestedReviewer"),
    whyThisMatters:
      firstNullableString(record, [
        "whyThisMatters",
        "why",
        "businessReason",
      ]) ??
      nullableString(skillCandidate, "summary") ??
      nullableString(record, "rationale"),
    proposedDestination: firstNullableString(record, [
      "proposedDestination",
      "destination",
      "destinationLabel",
    ]),
    perceivedRiskLevel: firstNullableString(record, [
      "perceivedRiskLevel",
      "riskLevel",
      "risk",
    ]),
    teachAlleatoSubmissionId: firstNullableString(record, [
      "teachAlleatoSubmissionId",
      "submissionId",
    ]),
    recommendedResolution: optionalString(record, "recommendedResolution"),
    candidateProjectName: nullableString(record, "candidateProjectName"),
    pagePath: nullableString(record, "pagePath"),
    taskSnapshot: jsonObject(record.taskSnapshot),
    rationale: optionalString(record, "rationale"),
    signalCounts: {
      helpful:
        typeof signalCounts.helpful === "number"
          ? signalCounts.helpful
          : undefined,
      problem:
        typeof signalCounts.problem === "number"
          ? signalCounts.problem
          : undefined,
      total:
        typeof signalCounts.total === "number" ? signalCounts.total : undefined,
    },
  };
}

export function isTeachAlleatoPromotion(
  promotion: AiLearningPromotionRow,
): boolean {
  const learning = readLearning(promotion.proposed_learning);
  return (
    learning.action === "teach_alleato_submission" ||
    learning.action === "review_teach_alleato_intake" ||
    learning.sourceSurface === "teach_alleato" ||
    learning.sourceSurface === "ai_assistant_teach" ||
    learning.sourceRoute === "/ai/teach" ||
    learning.sourceRoute === "/ai-assistant/teach" ||
    Boolean(learning.teachAlleatoSubmissionId)
  );
}

export function isSkillLibraryPromotion(
  promotion: AiLearningPromotionRow,
): boolean {
  const learning = readLearning(promotion.proposed_learning);
  const proposedLearning = jsonObject(promotion.proposed_learning);
  const skillCandidate = jsonObject(proposedLearning.skillCandidate);
  return (
    promotion.destination_table === "ai_skill_candidates" ||
    promotion.destination_table === "ai_skills" ||
    learning.proposedDestination === "skill_library" ||
    proposedLearning.ruleKind === "teach_alleato_skill_candidate" ||
    Object.keys(skillCandidate).length > 0
  );
}

export function isMemoryReviewPromotion(
  promotion: AiLearningPromotionRow,
): boolean {
  const learning = readLearning(promotion.proposed_learning);
  return (
    learning.action === "review_memory" ||
    promotion.destination_table === "ai_memories" ||
    promotion.promotion_type === "user_preference" ||
    promotion.promotion_type === "project_lesson"
  );
}

export function promotionMatchesKind(
  promotion: AiLearningPromotionRow,
  kind: PromotionKind,
): boolean {
  if (kind === "all") return true;
  if (kind === "teach") return isTeachAlleatoPromotion(promotion);
  if (kind === "skill") return isSkillLibraryPromotion(promotion);
  if (kind === "memory") return isMemoryReviewPromotion(promotion);
  if (kind === "retrieval")
    return promotion.promotion_type === "retrieval_weight";
  if (kind === "attribution")
    return promotion.promotion_type === "attribution_rule";
  if (kind === "agent_prevention") {
    return promotion.promotion_type === "agent_prevention_prompt";
  }
  if (kind === "workflow") {
    return (
      promotion.promotion_type === "workflow_rule" &&
      !isMemoryReviewPromotion(promotion) &&
      !isSkillLibraryPromotion(promotion)
    );
  }
  return false;
}

export function firstSourceEvent(
  promotion: AiLearningPromotionRow & {
    sourceEvents?: AiFeedbackEventRow[] | null;
  },
): AiFeedbackEventRow | null {
  return promotion.sourceEvents?.[0] ?? null;
}
