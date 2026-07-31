import { evidenceRefSchema, type EvidenceRef } from "./contracts";

type BriefCitationLike = {
  source: string;
  sourceDetail?: string | null;
  sourceUrl?: string | null;
  sourceId?: string | null;
  evidence?: string | null;
  date?: string | null;
};

type BriefItemLike = {
  title: string;
  summary: string;
  evidence?: string | null;
  evidenceFacts?: string[];
  source?: string;
  sourceDetail?: string | null;
  sourceUrl?: string | null;
  sourceId?: string | null;
  project?: string;
  projectInternalId?: number | null;
  citations: BriefCitationLike[];
  sourceRefs?: EvidenceRef[];
};

export type ExecutiveBriefingDraftEvidenceLike = {
  id: string;
  recapDate: string;
  packet: {
    sections: {
      needsBrandon: BriefItemLike[];
      waitingOnOthers: BriefItemLike[];
      importantUpdates: BriefItemLike[];
    };
  };
};

function toIsoOrNull(value: string | null | undefined) {
  if (!value) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
}

function sourceFamily(
  value: string,
  detail?: string | null,
): EvidenceRef["sourceFamily"] {
  const normalized = `${value} ${detail ?? ""}`.toLowerCase();
  if (normalized.includes("meeting") || normalized.includes("fireflies"))
    return "meeting";
  if (normalized.includes("email") || normalized.includes("outlook"))
    return "email";
  if (normalized.includes("teams")) return "teams";
  if (normalized.includes("financial") || normalized.includes("acumatica"))
    return "acumatica";
  if (normalized.includes("document")) return "document";
  if (normalized.includes("procore")) return "procore";
  if (normalized.includes("packet")) return "intelligence_packet";
  if (normalized.includes("card")) return "insight_card";
  return "project_intelligence";
}

function internalHrefForCitation(
  citation: BriefCitationLike,
  item: BriefItemLike,
) {
  const sourceId = citation.sourceId ?? item.sourceId;
  const projectId = item.projectInternalId;
  if (!sourceId) return null;

  const encodedSourceId = encodeURIComponent(sourceId);
  const family = sourceFamily(citation.source, citation.sourceDetail);
  if (family === "acumatica") {
    return "/financial-insights";
  }

  if (!projectId) return null;

  if (family === "meeting" || family === "fireflies") {
    return `/${projectId}/meetings/${encodedSourceId}`;
  }

  if (
    family === "email" ||
    family === "outlook" ||
    family === "teams" ||
    family === "document" ||
    family === "rag"
  ) {
    return `/${projectId}/intelligence/sources/${encodedSourceId}`;
  }

  return null;
}

export function evidenceRefsForBriefItem({
  briefId,
  recapDate,
  item,
  itemIndex,
}: {
  briefId?: string;
  recapDate: string;
  item: BriefItemLike;
  itemIndex: number;
}): EvidenceRef[] {
  return item.citations.map((citation, citationIndex) => ({
    sourceFamily: sourceFamily(citation.source, citation.sourceDetail),
    sourceId:
      citation.sourceId ??
      item.sourceId ??
      citation.sourceUrl ??
      item.sourceUrl ??
      `${briefId ?? "pending-brief"}:${itemIndex + 1}:${citationIndex + 1}`,
    sourceTitle: citation.sourceDetail || item.sourceDetail || item.title,
    sourceUrl: citation.sourceUrl ?? item.sourceUrl ?? null,
    internalHref: internalHrefForCitation(citation, item),
    occurredAt: toIsoOrNull(citation.date),
    excerpt:
      citation.evidence ??
      item.evidence ??
      item.evidenceFacts?.[0] ??
      item.summary,
    confidence: "unknown",
    projectId: item.projectInternalId ?? null,
    projectLabel: item.project,
    metadata: {
      briefId: briefId ?? null,
      recapDate,
      itemTitle: item.title,
      citationIndex,
    },
  }));
}

export function withBriefItemSourceRefs<T extends BriefItemLike>({
  briefId,
  recapDate,
  item,
  itemIndex,
}: {
  briefId?: string;
  recapDate: string;
  item: T;
  itemIndex: number;
}): T {
  return {
    ...item,
    sourceRefs: evidenceRefsForBriefItem({
      briefId,
      recapDate,
      item,
      itemIndex,
    }),
  };
}

function draftSectionEntries(draft: ExecutiveBriefingDraftEvidenceLike) {
  return (
    [
      ["needsBrandon", draft.packet.sections.needsBrandon],
      ["waitingOnOthers", draft.packet.sections.waitingOnOthers],
      ["importantUpdates", draft.packet.sections.importantUpdates],
    ] as const
  ).flatMap(([section, items]) =>
    items.map((item, index) => ({ section, item, index })),
  );
}

export function evidenceRefsFromDraft(
  draft: ExecutiveBriefingDraftEvidenceLike,
): EvidenceRef[] {
  return draftSectionEntries(draft).flatMap(({ item, index }) =>
    Array.isArray(item.sourceRefs) && item.sourceRefs.length > 0
      ? item.sourceRefs
      : evidenceRefsForBriefItem({
          briefId: draft.id,
          recapDate: draft.recapDate,
          item,
          itemIndex: index,
        }),
  );
}

export function assertExecutiveBriefingDraftEvidence(
  draft: ExecutiveBriefingDraftEvidenceLike,
) {
  const failures: string[] = [];

  for (const { section, item, index } of draftSectionEntries(draft)) {
    const label = `${section}[${index}]: ${item.title || "Untitled item"}`;
    if (!Array.isArray(item.citations) || item.citations.length === 0) {
      failures.push(`${label} has no citations.`);
      continue;
    }

    for (const [citationIndex, citation] of item.citations.entries()) {
      const citationLabel = `${label} citation[${citationIndex}]`;
      if (!citation.sourceDetail?.trim()) {
        failures.push(`${citationLabel} is missing source detail.`);
      }
      if (!citation.evidence?.trim()) {
        failures.push(`${citationLabel} is missing evidence excerpt.`);
      }
      if (!citation.date?.trim() || citation.date === "Unknown date") {
        failures.push(`${citationLabel} is missing occurred-at date.`);
      }
      if (!citation.sourceId && !citation.sourceUrl) {
        failures.push(`${citationLabel} is missing source id or source URL.`);
      }
    }
  }

  const evidenceRefs = evidenceRefsFromDraft(draft);
  const evidenceRefFailures = evidenceRefs
    .map((ref, index) => ({ index, result: evidenceRefSchema.safeParse(ref) }))
    .filter((entry) => !entry.result.success)
    .map((entry) => `evidenceRef[${entry.index}] failed contract validation.`);
  failures.push(...evidenceRefFailures);

  if (failures.length > 0) {
    throw new Error(
      [
        "Executive Daily Brief evidence policy failed.",
        ...failures.slice(0, 12),
      ].join(" "),
    );
  }

  return evidenceRefs;
}
