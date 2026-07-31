import type { AssistantIntent } from "@/lib/ai/intent-router";
import type { ResponseFormat } from "@/lib/ai/retrieval/types";
import type { ClientProjectIntelligencePacket } from "./types";
import { asRecord, CURRENT_COMPILER_VERSION } from "./utils";

const FAST_PATH_INTENTS = new Set<AssistantIntent>([
  "target_briefing",
  "latest_status",
  "risk_review",
  "decision_lookup",
  "task_followup",
]);

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value.trim() : null;
}

export function shouldUseProjectPacketFastPath(input: {
  intent: AssistantIntent;
  responseFormat: ResponseFormat;
  usesIntelligencePacket: boolean;
}): boolean {
  return (
    input.usesIntelligencePacket &&
    input.responseFormat === "briefing_template" &&
    FAST_PATH_INTENTS.has(input.intent)
  );
}

export function projectPacketFastPathBlockReason(
  packet: ClientProjectIntelligencePacket,
): string | null {
  const qualityGate = asRecord(packet.sourceCoverage.qualityGate);
  const qualityGateStatus = stringValue(qualityGate.status);
  const linkedEvidenceCount =
    typeof packet.sourceCoverage.linkedEvidenceCount === "number"
      ? packet.sourceCoverage.linkedEvidenceCount
      : null;

  if (packet.isStale) return "packet_is_stale";
  if (packet.compilerVersion !== CURRENT_COMPILER_VERSION) {
    return "compiler_version_not_project_intelligence_synthesis";
  }
  if (qualityGateStatus !== null && qualityGateStatus !== "passed") {
    return "quality_gate_not_passed";
  }
  if (packet.cards.length < 1) return "packet_has_no_cards";
  if (linkedEvidenceCount !== null && linkedEvidenceCount < 5) {
    return "packet_has_too_few_linked_citations";
  }
  return null;
}

export function projectPacketIsFastPathEligible(
  packet: ClientProjectIntelligencePacket,
): boolean {
  return projectPacketFastPathBlockReason(packet) === null;
}
