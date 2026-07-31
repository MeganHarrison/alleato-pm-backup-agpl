import type {
  ClientProjectIntelligencePacket,
  InsightCard,
  ResolvedIntelligenceTarget,
} from "./types";
import { asArray, asRecord } from "./utils";
import type { AssistantIntent } from "../intent-router";

function findCard(packet: ClientProjectIntelligencePacket, types: string[]): InsightCard | undefined {
  return packet.cards.find((card) => types.includes(card.cardType));
}

function joinMoves(moves: string[]): string {
  return moves.length ? moves.map((move) => `- ${move}`).join("\n") : "- Verify the latest source evidence before acting.";
}

function formatEvidence(packet: ClientProjectIntelligencePacket): string {
  const coverage = packet.sourceCoverage;
  const categoryCoverage = Array.isArray(coverage.categoryCoverage)
    ? coverage.categoryCoverage
    : [];
  const categoryParts = categoryCoverage
    .map((row) => {
      if (!row || typeof row !== "object") return null;
      const record = row as Record<string, unknown>;
      const label = String(record.label ?? record.category ?? "").trim();
      if (!label) return null;
      return `${label}: ${String(record.sourceCount ?? 0)} selected / ${String(record.availableCount ?? 0)} available`;
    })
    .filter((value): value is string => Boolean(value));
  const legacyParts = [
    typeof coverage.documentMetadataRows === "number" ? `${coverage.documentMetadataRows} project document/source rows` : null,
    typeof coverage.aiMemoryRows === "number" ? `${coverage.aiMemoryRows} project memories` : null,
    typeof coverage.projectEmailRows === "number" ? `${coverage.projectEmailRows} project_emails rows` : null,
  ].filter((value): value is string => Boolean(value));
  const linkedEvidence = typeof coverage.linkedEvidenceCount === "number"
    ? [`${coverage.linkedEvidenceCount} linked packet citations`]
    : [];
  const parts = [...linkedEvidence, ...(categoryParts.length ? categoryParts : legacyParts)];
  const latest = coverage.latestSourceAt ? ` Latest packet source date: ${coverage.latestSourceAt}.` : "";
  const gaps = coverage.gaps?.length ? ` Gaps: ${coverage.gaps.join("; ")}.` : "";
  return `${parts.join(", ")}.${latest}${gaps}`;
}

function compactList(value: unknown, detailFields: string[], limit = 4): string {
  return asArray(value)
    .slice(0, limit)
    .map((item) => {
      const record = asRecord(item);
      const title = String(record.title ?? "").trim();
      if (!title) return null;
      const details = detailFields
        .map((field) => String(record[field] ?? "").trim())
        .filter(Boolean)
        .join(" ");
      return details ? `${title}: ${details}` : title;
    })
    .filter((value): value is string => Boolean(value))
    .join(" ");
}

function strategicReportLine(packet: ClientProjectIntelligencePacket, key: string, detailFields: string[]): string | null {
  const report = asRecord(asRecord(packet.packetJson).strategicReport);
  const value = report[key];
  const text = key === "moneyImpact"
    ? String(asRecord(value).summary ?? "").trim()
    : compactList(value, detailFields);
  return text || null;
}

function formatSourceCitations(packet: ClientProjectIntelligencePacket): string {
  const citations = packet.cards
    .flatMap((card) => card.evidence)
    .map((evidence) => evidence.sourceTitle || evidence.sourceDocumentId || evidence.sourceType)
    .filter(Boolean)
    .filter((value, index, values) => values.indexOf(value) === index)
    .slice(0, 3);

  if (citations.length === 0) {
    return "";
  }

  return citations.map((citation) => `[Source: ${citation}]`).join(" ");
}

export function synthesizeMissingPacketResponse(input: {
  target: ResolvedIntelligenceTarget | null;
  query: string;
}): string {
  const targetName = input.target?.name ?? "that project";
  return [
    `I do not have a current intelligence packet for ${targetName} yet.`,
    "",
    "What I can do next: run a direct source lookup across project records, meetings, Teams, email, and documents, but I will label that as live lookup rather than a prepared project read.",
  ].join("\n");
}

export function synthesizeAdvisorResponse(input: {
  target: ResolvedIntelligenceTarget;
  packet: ClientProjectIntelligencePacket;
  intent: AssistantIntent;
  query: string;
}): string {
  const { packet, target } = input;
  const statusCard = findCard(packet, ["project_update"]);
  const financialCard = findCard(packet, ["financial_exposure"]);
  const changeCard = findCard(packet, ["change_management"]);
  const scheduleCard = findCard(packet, ["schedule_risk", "risk"]);
  const decisionCard = findCard(packet, ["decision", "open_question"]);
  const followUpCard = findCard(packet, ["task", "blocker"]);
  const whatChanged = strategicReportLine(packet, "whatChanged", ["impact"]);
  const risks = strategicReportLine(packet, "risks", ["recommendedAction", "severity"]);
  const openDecisions = strategicReportLine(packet, "openDecisions", ["owner", "neededBy"]);
  const moneyImpact = strategicReportLine(packet, "moneyImpact", []);
  const promisesMade = strategicReportLine(packet, "promisesMade", ["owner", "dueDate"]);
  const freshnessLabel = packet.freshnessStatus.replace("_", " ");

  const freshnessWarning =
    packet.freshnessStatus === "fresh"
      ? ""
      : `\n\nPacket status: ${freshnessLabel}. Use this as the prepared baseline, not as proof that nothing changed after ${packet.coveredEndAt ?? packet.generatedAt}.`;
  const sourceCitations = formatSourceCitations(packet);

  return [
    `Current read: ${packet.currentStatus ?? statusCard?.summary ?? packet.executiveSummary}`,
    "",
    `What changed recently: ${whatChanged ?? statusCard?.summary ?? packet.strategicRead ?? "The packet did not include a separate recent-change card."}`,
    "",
    `Financial/change-management exposure: ${moneyImpact ?? financialCard?.summary ?? "Formal financial exposure still needs structured tool verification."} ${changeCard?.summary ?? ""}`.trim(),
    "",
    `Schedule/operational risk: ${risks ?? scheduleCard?.summary ?? "No separate schedule-risk card is in the packet."}`,
    "",
    `Decisions/open questions/follow-ups: ${[openDecisions, promisesMade, decisionCard?.summary, followUpCard?.summary].filter(Boolean).join(" ") || "No explicit decision/follow-up card is in the packet."}`,
    "",
    `Recommended next action:\n${joinMoves(packet.recommendedNextMoves)}`,
    "",
    `Evidence basis and confidence: ${packet.confidenceSummary.reason ?? "Confidence is based on the current packet cards and linked evidence."} ${formatEvidence(packet)}${sourceCitations ? ` ${sourceCitations}` : ""}`,
    freshnessWarning,
    "",
    `Resolved target: ${target.name} (project ${target.projectId ?? "none"}).`,
  ]
    .filter((part) => part !== "")
    .join("\n");
}
