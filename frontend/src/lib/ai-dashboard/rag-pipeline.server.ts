import "server-only";

import { SOURCE_FAMILIES, type SourceFamilyKey } from "@/app/api/admin/source-sync/_lifecycle";
import { loadCohort, loadEmbeddedSets } from "@/app/api/admin/source-sync/_daily";

export type RagPipelineRange = "24h" | "3d" | "7d" | "30d";

export type RagPipelineSummary = {
  generatedAt: string;
  range: RagPipelineRange;
  sources: Array<{
    key: SourceFamilyKey;
    label: string;
    vectorized: number;
    received: number;
    sourceTableHref: string;
  }>;
};

const RANGE_MS: Record<RagPipelineRange, number> = {
  "24h": 24 * 60 * 60 * 1000,
  "3d": 3 * 24 * 60 * 60 * 1000,
  "7d": 7 * 24 * 60 * 60 * 1000,
  "30d": 30 * 24 * 60 * 60 * 1000,
};

const RAG_SOURCE_FAMILIES = SOURCE_FAMILIES.filter((family) =>
  ["meetings", "teams", "emails", "sharepoint"].includes(family.key),
);

export async function loadRagPipelineSummary(
  range: RagPipelineRange,
  now = new Date(),
): Promise<RagPipelineSummary> {
  const since = new Date(now.getTime() - RANGE_MS[range]);
  const cohort = await loadCohort({ sinceISO: since.toISOString(), untilISO: now.toISOString() });
  const embedded = await loadEmbeddedSets(cohort.map((row) => row.id));
  const days = range === "24h" ? 1 : Number(range.slice(0, -1));

  return {
    generatedAt: now.toISOString(),
    range,
    sources: RAG_SOURCE_FAMILIES.map((family) => {
      const rows = cohort.filter(family.matches);
      const vectorized = rows.filter((row) =>
        family.key === "meetings"
          ? embedded.embeddedMeetingTranscriptIds.has(row.id)
          : embedded.embeddedIds.has(row.id),
      ).length;
      return {
        key: family.key,
        label: family.key === "sharepoint" ? "Documents" : family.label,
        vectorized,
        received: rows.length,
        sourceTableHref: `/rag?tab=lifecycle&days=${days}&source=${family.key}&stage=vectorized`,
      };
    }),
  };
}
