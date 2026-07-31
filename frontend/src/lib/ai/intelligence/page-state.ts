import type { ClientProjectIntelligencePacket } from "./types";
import { asRecord, cleanText, firstStrategicText, summarizeText } from "./utils";

type IntelligenceBriefing = {
  title: string;
  body: string;
};

export type IntelligencePageState = {
  briefing: IntelligenceBriefing;
  warnings: string[];
  limitations: string[];
};

function cleanUnknown(value: unknown): string {
  return cleanText(typeof value === "string" || typeof value === "number" ? String(value) : "");
}

function strategicReport(packet: ClientProjectIntelligencePacket): Record<string, unknown> {
  return asRecord(asRecord(packet.packetJson).strategicReport);
}

function hasStrategicReport(packet: ClientProjectIntelligencePacket): boolean {
  return Object.keys(strategicReport(packet)).length > 0;
}

function packetEvidence(packet: ClientProjectIntelligencePacket) {
  return packet.cards.flatMap((card) => card.evidence);
}

function qualityWarnings(packet: ClientProjectIntelligencePacket): string[] {
  const warnings = new Set<string>();

  const lowSignalCards = packet.cards.filter((card) =>
    !firstStrategicText(card.summary, card.currentStatus, card.whyItMatters, card.nextAction)
  );

  if (lowSignalCards.length > 0 && !hasStrategicReport(packet)) {
    warnings.add(`${lowSignalCards.length} cards contain raw source text or metadata instead of usable synthesis.`);
  }

  const qualityGate = asRecord(packet.sourceCoverage.qualityGate);
  if (qualityGate.status && qualityGate.status !== "passed") {
    warnings.add(cleanUnknown(qualityGate.reason) || "The packet source quality gate did not pass.");
  }

  if (packet.isStale) {
    warnings.add("The packet is older than the expected refresh window.");
  }

  if (packetEvidence(packet).length === 0) {
    warnings.add("No linked citations are attached to the current packet.");
  }

  return Array.from(warnings).slice(0, 5);
}

function evidenceLimitations(packet: ClientProjectIntelligencePacket): string[] {
  const gaps = packet.sourceCoverage.gaps?.filter((gap): gap is string => typeof gap === "string") ?? [];
  return gaps.map(cleanText).filter(Boolean).slice(0, 5);
}

function briefingStatus(packet: ClientProjectIntelligencePacket): IntelligenceBriefing {
  const cleanRead = firstStrategicText(
    packet.executiveSummary,
    packet.currentStatus,
    packet.strategicRead,
    packet.whyItMatters,
  );
  const warnings = qualityWarnings(packet);

  if (!cleanRead) {
    return {
      title: "Daily intelligence could not produce a usable strategic read.",
      body:
        "The page found source-backed signals, but the current packet did not produce a synthesized operating read. This should be refreshed before a human or AI agent treats it as an operating report.",
    };
  }

  if (warnings.length > 0) {
    return {
      title: "Daily intelligence failed source-quality checks.",
      body:
        "The page found source-backed signals, but the current packet has a stale, uncited, or failed quality-gate condition. The evidence limits below are separate from this failure state.",
    };
  }

  return {
    title: "Daily project intelligence, synthesized from the sources that changed the job.",
    body: summarizeText(firstStrategicText(packet.currentStatus, packet.strategicRead, cleanRead), 520),
  };
}

export function buildIntelligencePageState(packet: ClientProjectIntelligencePacket): IntelligencePageState {
  return {
    briefing: briefingStatus(packet),
    warnings: qualityWarnings(packet),
    limitations: evidenceLimitations(packet),
  };
}
