import { tool } from "ai";
import { z } from "zod";
import {
  type CanonicalDailyBriefPacket,
  loadCurrentDailyExecutiveBriefPacket,
} from "@/lib/daily-briefs/canonical-packets";
import { type ToolTracePayload, withTrace as _withTrace } from "./tool-utils";

type CreateExecutiveBriefToolsOptions = {
  onTrace?: (trace: ToolTracePayload) => void;
};

function withTrace<TInput extends Record<string, unknown>, TResult>(
  name: string,
  options: CreateExecutiveBriefToolsOptions,
  execute: (input: TInput) => Promise<TResult>,
) {
  return _withTrace(
    name,
    options,
    execute,
    "Daily Executive Brief read failed. Check whether the canonical intelligence_packets/daily-executive-brief packet exists and is fresh.",
  );
}

function citedSourceAliases(packet: CanonicalDailyBriefPacket): Set<string> {
  const aliases = new Set<string>();
  const collectAliases = (value: unknown): void => {
    if (typeof value === "string") {
      for (const match of value.matchAll(/\bS\d+\b/g)) {
        aliases.add(match[0]);
      }
      return;
    }

    if (Array.isArray(value)) {
      value.forEach(collectAliases);
      return;
    }

    if (value && typeof value === "object") {
      Object.values(value).forEach(collectAliases);
    }
  };

  const structuredBrief = packet.brief
    ? {
        executiveSignal: packet.brief.executiveSignal,
        callsToday: packet.brief.callsToday,
        projects: packet.brief.projects,
        looseEnds: packet.brief.looseEnds,
        preventionFindings: packet.brief.preventionFindings,
        executiveSynthesis: packet.brief.executiveSynthesis
          ? {
              patterns: packet.brief.executiveSynthesis.patterns,
              rootCauses: packet.brief.executiveSynthesis.rootCauses,
              facts: packet.brief.executiveSynthesis.facts,
              inferences: packet.brief.executiveSynthesis.inferences,
              recommendations:
                packet.brief.executiveSynthesis.recommendations,
              risks: packet.brief.executiveSynthesis.risks,
              opportunities: packet.brief.executiveSynthesis.opportunities,
              financial: packet.brief.executiveSynthesis.financial,
              schedule: packet.brief.executiveSynthesis.schedule,
              decisions: packet.brief.executiveSynthesis.decisions,
            }
          : null,
      }
    : null;

  collectAliases({
    currentStatus: packet.currentStatus,
    strategicRead: packet.strategicRead,
    whyItMatters: packet.whyItMatters,
    briefMarkdown: packet.briefMarkdown,
    sections: packet.sections,
    recommendedNextMoves: packet.recommendedNextMoves,
    executiveSummary: packet.executiveSummary,
    structuredBrief,
  });

  return aliases;
}

export function toEveDailyBriefResponse(packet: CanonicalDailyBriefPacket) {
  const aliases = citedSourceAliases(packet);
  const sourceEvidence = packet.sources
    .filter((source) => source.alias && aliases.has(source.alias))
    .map((source) => ({
      id: source.id,
      alias: source.alias,
      title: source.title,
      lane: source.lane,
      projectId: source.projectId,
      projectName: source.projectName,
      sourceAt: source.sourceAt,
      url: source.url,
    }));

  return {
    sourceOfTruth: "intelligence_packets" as const,
    targetSlug: "daily-executive-brief" as const,
    packet: {
      id: packet.id,
      businessDate: packet.businessDate,
      title: packet.title,
      generatedAt: packet.generatedAt,
      coveredStartAt: packet.coveredStartAt,
      coveredEndAt: packet.coveredEndAt,
      freshnessStatus: packet.freshnessStatus,
      runStatus: packet.runStatus,
      executiveSummary: packet.executiveSummary,
      currentStatus: packet.currentStatus,
      whyItMatters: packet.whyItMatters,
      recommendedNextMoves: packet.recommendedNextMoves,
      confidenceSummary: packet.confidenceSummary,
      sourceCounts: packet.sourceCounts,
      sourceCount: packet.sourceCount,
      referencedSourceCount: sourceEvidence.length,
      sections: packet.sections,
      sourceEvidence,
    },
  };
}

export function createExecutiveBriefTools(
  options: CreateExecutiveBriefToolsOptions = {},
) {
  return {
    readCurrentDailyExecutiveBrief: tool({
      description:
        "Read the current canonical Daily Executive Brief from intelligence_packets target slug daily-executive-brief. Use this when the user asks for today's brief, the current executive brief, or the saved daily update. Do not regenerate the brief; if the packet is missing or stale, report that the canonical packet must be compiled first.",
      inputSchema: z.object({}),
      execute: withTrace(
        "readCurrentDailyExecutiveBrief",
        options,
        async () => {
          const packet = await loadCurrentDailyExecutiveBriefPacket();
          return toEveDailyBriefResponse(packet);
        },
      ),
    }),
  };
}
