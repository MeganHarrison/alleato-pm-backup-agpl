import type { ClientProjectIntelligencePacket, InsightCard, ConfidenceLevel } from "./types";

/** A reviewable, non-executing control recommendation projected from a packet. */
export type ProjectControlRecommendation = {
  id: string;
  controlType: "schedule" | "rfi" | "submittal" | "change_event" | "operational_loss" | "general";
  action: string;
  rationale: string;
  confidence: ConfidenceLevel;
  impact: "schedule" | "cost" | "quality" | "coordination" | "operations";
  impactSummary: string;
  sourceLinks: Array<{
    id: string;
    title: string;
    type: string;
    occurredAt: string | null;
    documentId: string | null;
    chunkId: string | null;
    messageId: string | null;
  }>;
  approvalRequired: boolean;
  approvalStatus: "not_required" | "pending_review";
  governanceReason: string;
};

const ACTIVE_STATUSES = new Set(["open", "blocked", "needs_review"]);

function haystack(card: InsightCard): string {
  return [card.title, card.summary, card.whyItMatters, card.nextAction, JSON.stringify(card.metadata)]
    .filter(Boolean)
    .join(" ")
    .toLowerCase();
}

function controlType(card: InsightCard): ProjectControlRecommendation["controlType"] {
  const text = haystack(card);
  if (/\b(operational.?loss|recurring issue|missing control|preventability)\b/.test(text)) return "operational_loss";
  if (card.cardType === "schedule_risk" || /\b(schedule|delay|milestone|critical path)\b/.test(text)) return "schedule";
  if (/\b(rfi|request for information)\b/.test(text)) return "rfi";
  if (/\bsubmittal\b/.test(text)) return "submittal";
  if (card.cardType === "change_management" || /\b(change event|change order|pco|cco|scope change)\b/.test(text)) return "change_event";
  return "general";
}

function impactFor(card: InsightCard, type: ProjectControlRecommendation["controlType"]): ProjectControlRecommendation["impact"] {
  if (type === "schedule") return "schedule";
  if (type === "change_event" || card.cardType === "financial_exposure") return "cost";
  if (type === "submittal") return "quality";
  if (type === "rfi") return "coordination";
  if (type === "operational_loss") return "operations";
  return card.cardType === "blocker" ? "coordination" : "operations";
}

function fallbackAction(type: ProjectControlRecommendation["controlType"]): string {
  return {
    schedule: "Review the schedule dependency and publish the recovery action.",
    rfi: "Assign and close the outstanding RFI or record the response dependency.",
    submittal: "Confirm the submittal owner, due date, and review disposition.",
    change_event: "Validate scope, cost, and schedule impact before creating or approving a change event.",
    operational_loss: "Review the missing control with the accountable role and record the prevention step.",
    general: "Review this signal with the accountable project owner and record the next control step.",
  }[type];
}

function sourceLinks(card: InsightCard): ProjectControlRecommendation["sourceLinks"] {
  return card.evidence.map((evidence) => ({
    id: evidence.id,
    title: evidence.sourceTitle || evidence.sourceDocumentId || evidence.sourceType,
    type: evidence.sourceType,
    occurredAt: evidence.sourceOccurredAt,
    documentId: evidence.sourceDocumentId,
    chunkId: evidence.sourceChunkId,
    messageId: evidence.sourceMessageId,
  }));
}

/**
 * Projects completed packet intelligence into reviewable project controls.
 * This function never executes a control, creates an RFI, or approves a change;
 * callers must persist/display the approval boundary explicitly.
 */
export function projectControlRecommendations(
  packet: ClientProjectIntelligencePacket,
): ProjectControlRecommendation[] {
  return packet.cards
    .filter((card) => ACTIVE_STATUSES.has(card.currentStatus) && card.attributionStatus !== "rejected")
    .map((card) => {
      const type = controlType(card);
      const impact = impactFor(card, type);
      const approvalRequired = type === "change_event" || type === "operational_loss" || impact === "cost";
      const rationale = card.whyItMatters || card.summary;
      return {
        id: card.id,
        controlType: type,
        action: card.nextAction || fallbackAction(type),
        rationale,
        confidence: card.confidence,
        impact,
        impactSummary: rationale,
        sourceLinks: sourceLinks(card),
        approvalRequired,
        approvalStatus: approvalRequired ? "pending_review" : "not_required",
        governanceReason: approvalRequired
          ? "Evidence supports a recommendation, but a human must approve the project-control action."
          : "This is a reviewable follow-up only; no external or financial action is authorized.",
      } satisfies ProjectControlRecommendation;
    })
    .filter((recommendation) => recommendation.rationale.trim() && recommendation.sourceLinks.length > 0);
}
