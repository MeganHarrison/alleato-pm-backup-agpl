import { projectControlRecommendations } from "../project-control-recommendations";
import type { ClientProjectIntelligencePacket, InsightCard } from "../types";

function packet(cards: InsightCard[]): ClientProjectIntelligencePacket {
  return { cards, freshnessStatus: "fresh" } as ClientProjectIntelligencePacket;
}

function card(overrides: Partial<InsightCard> = {}): InsightCard {
  return {
    id: "card-1",
    title: "RFI 42 is unresolved",
    cardType: "open_question",
    summary: "Architect response is blocking door installation.",
    whyItMatters: "The crew cannot release the affected work without a response.",
    currentStatus: "open",
    confidence: "high",
    attributionStatus: "auto_assigned",
    nextAction: "Follow up with the architect on RFI 42.",
    evidence: [{ id: "e-1", sourceTitle: "OAC meeting", sourceType: "meeting", sourceOccurredAt: "2026-07-20", sourceDocumentId: "doc-1", sourceChunkId: null, sourceMessageId: null }],
    ...overrides,
  } as InsightCard;
}

describe("projectControlRecommendations", () => {
  it("projects source-linked RFI controls without authorizing an action", () => {
    const [recommendation] = projectControlRecommendations(packet([card()]));
    expect(recommendation).toMatchObject({
      controlType: "rfi",
      action: "Follow up with the architect on RFI 42.",
      confidence: "high",
      impact: "coordination",
      approvalRequired: false,
      approvalStatus: "not_required",
    });
    expect(recommendation.sourceLinks[0]).toMatchObject({ id: "e-1", documentId: "doc-1" });
  });

  it("marks change-event and operational-loss recommendations as pending human review", () => {
    const recommendations = projectControlRecommendations(packet([
      card({ id: "change-1", title: "Potential change event", cardType: "change_management", nextAction: null }),
      card({ id: "loss-1", title: "Recurring operational loss: missing control", cardType: "process_issue" }),
    ]));
    expect(recommendations.map((item) => [item.controlType, item.approvalRequired, item.approvalStatus])).toEqual([
      ["change_event", true, "pending_review"],
      ["operational_loss", true, "pending_review"],
    ]);
  });

  it("fails closed for rejected, resolved, or uncited cards", () => {
    const recommendations = projectControlRecommendations(packet([
      card({ id: "resolved", currentStatus: "resolved" }),
      card({ id: "rejected", attributionStatus: "rejected" }),
      card({ id: "uncited", evidence: [] }),
    ]));
    expect(recommendations).toEqual([]);
  });
});
