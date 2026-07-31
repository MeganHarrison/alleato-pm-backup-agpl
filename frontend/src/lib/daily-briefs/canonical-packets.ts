import { serviceDb } from "@/lib/supabase/service-db";
import type { Database, Json } from "@/types/database.types";
import type { BriefV3 } from "./brief-v3-types";
import type { DailyBriefHistoryItem } from "./types";

export const DAILY_EXECUTIVE_BRIEF_TARGET_SLUG = "daily-executive-brief";
export const MISSING_DAILY_BRIEF_CONTENT =
  "Daily executive brief content is missing from the canonical packet.";

type IntelligencePacketRow =
  Database["public"]["Tables"]["intelligence_packets"]["Row"];

type IntelligenceTargetRow =
  Database["public"]["Tables"]["intelligence_targets"]["Row"];

type JsonRecord = Record<string, unknown>;

export type DailyBriefMarkdownSection = {
  title: string;
  body: string;
};

/**
 * One source that fed the brief, carried through from the compiler's
 * `packet_json.sourceSet.sources` manifest. `id` is the source's full, stable
 * id (Outlook message id, meeting ulid, …) — the durable link key. `alias` is
 * the short, mangle-proof citation token the model was told to cite (e.g.
 * `S12`); the brief markdown cites the alias, and the resolver maps it back to
 * this source. Older packets predate aliases and cite the full `id` directly,
 * so `alias` is nullable and the resolver still accepts full-id citations.
 * `url` is the source's original location (Outlook web for emails, the stored
 * transcript for meetings, the file for documents); Teams messages have no
 * addressable url.
 */
export type DailyBriefSourceRef = {
  id: string;
  alias: string | null;
  title: string;
  lane: string;
  projectId: number | null;
  projectName: string | null;
  sourceAt: string | null;
  url: string | null;
};

export type CanonicalDailyBriefPacket = {
  id: string;
  targetId: string;
  packetType: string;
  generatedAt: string | null;
  coveredStartAt: string | null;
  coveredEndAt: string | null;
  freshnessStatus: string | null;
  businessDate: string;
  title: string;
  executiveSummary: string | null;
  currentStatus: string | null;
  strategicRead: string | null;
  whyItMatters: string | null;
  recommendedNextMoves: string[];
  confidenceSummary: JsonRecord;
  sourceCoverage: JsonRecord;
  sourceCounts: Record<string, number>;
  sourceIds: string[];
  sourceCount: number;
  sources: DailyBriefSourceRef[];
  briefMarkdown: string;
  sections: DailyBriefMarkdownSection[];
  /** Structured v3 brief when the packet was generated in v3 format; null for legacy packets. */
  brief: BriefV3 | null;
  compilerVersion: string | null;
  runStatus: string | null;
};

/** Runtime type guard: a value is a structured v3 brief. */
function isBriefV3(value: unknown): value is BriefV3 {
  return isRecord(value) && value.version === "v3" && Array.isArray(value.projects);
}

/** Safely extract the structured v3 brief from a packet_json record. */
function extractBriefV3(packetJson: JsonRecord): BriefV3 | null {
  return isBriefV3(packetJson.brief) ? packetJson.brief : null;
}

export type CanonicalDailyBriefApiResponse = {
  sourceOfTruth: "intelligence_packets";
  targetSlug: typeof DAILY_EXECUTIVE_BRIEF_TARGET_SLUG;
  packet: CanonicalDailyBriefPacket;
};

export function hasCompleteDailyBriefMarkdown(content: string): boolean {
  return Boolean(content.trim()) && content !== MISSING_DAILY_BRIEF_CONTENT;
}

function hasCompletedRun(packetJson: JsonRecord): boolean {
  const runContract = isRecord(packetJson.runContract) ? packetJson.runContract : null;
  return runContract?.status === "completed";
}

function isRecord(value: unknown): value is JsonRecord {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

function toRecord(value: Json | null): JsonRecord {
  return isRecord(value) ? value : {};
}

function stringValue(value: unknown): string | null {
  return typeof value === "string" && value.trim() ? value : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value)
    ? value.filter((item): item is string => typeof item === "string")
    : [];
}

function numberRecord(value: unknown): Record<string, number> {
  if (!isRecord(value)) return {};
  return Object.fromEntries(
    Object.entries(value)
      .map(([key, count]) => [key, typeof count === "number" ? count : Number(count)])
      .filter((entry): entry is [string, number] => Number.isFinite(entry[1])),
  );
}

function dateOnly(value: string | null): string | null {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return date.toISOString().slice(0, 10);
}

export function splitDailyBriefMarkdown(markdown: string): DailyBriefMarkdownSection[] {
  const lines = markdown.split(/\r?\n/);
  const sections: DailyBriefMarkdownSection[] = [];
  let currentTitle = "Executive read";
  let currentLines: string[] = [];

  for (const line of lines) {
    const heading = line.match(/^##\s+(.+?)\s*$/);
    if (heading) {
      const body = currentLines.join("\n").trim();
      if (body) sections.push({ title: currentTitle, body });
      currentTitle = heading[1];
      currentLines = [];
      continue;
    }

    if (!line.startsWith("# ")) {
      currentLines.push(line);
    }
  }

  const body = currentLines.join("\n").trim();
  if (body) sections.push({ title: currentTitle, body });
  return sections;
}

function numberOrNull(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function mapSourceRefs(packetJson: JsonRecord): DailyBriefSourceRef[] {
  const sourceSet = isRecord(packetJson.sourceSet) ? packetJson.sourceSet : {};
  const rawSources = Array.isArray(sourceSet.sources) ? sourceSet.sources : [];
  const refs: DailyBriefSourceRef[] = [];
  for (const raw of rawSources) {
    if (!isRecord(raw)) continue;
    const id = stringValue(raw.id);
    if (!id) continue;
    refs.push({
      id,
      alias: stringValue(raw.alias),
      title: stringValue(raw.title) ?? id,
      lane: stringValue(raw.lane) ?? "documents",
      projectId: numberOrNull(raw.projectId),
      projectName: stringValue(raw.projectName),
      sourceAt: stringValue(raw.sourceAt),
      url: stringValue(raw.url),
    });
  }
  return refs;
}

function extractBusinessDate(row: IntelligencePacketRow, packetJson: JsonRecord): string {
  return (
    stringValue(packetJson.businessDate) ??
    dateOnly(row.covered_start_at) ??
    dateOnly(row.generated_at) ??
    "unknown"
  );
}

function mapPacket(row: IntelligencePacketRow): CanonicalDailyBriefPacket {
  const packetJson = toRecord(row.packet_json);
  const sourceCoverage = toRecord(row.source_coverage);
  const sourceCounts = numberRecord(sourceCoverage.sourceCounts);
  const sourceIds = stringArray(sourceCoverage.sourceIds);
  // `executive_summary` is a deliberately truncated database projection. It
  // is never a valid substitute for the durable Executive Report.
  const briefMarkdown = stringValue(packetJson.briefMarkdown) ?? MISSING_DAILY_BRIEF_CONTENT;
  const businessDate = extractBusinessDate(row, packetJson);

  return {
    id: row.id,
    targetId: row.target_id,
    packetType: row.packet_type,
    generatedAt: row.generated_at,
    coveredStartAt: row.covered_start_at,
    coveredEndAt: row.covered_end_at,
    freshnessStatus: row.freshness_status,
    businessDate,
    title: `Daily Executive Brief - ${businessDate}`,
    executiveSummary: row.executive_summary,
    currentStatus: row.current_status,
    strategicRead: row.strategic_read,
    whyItMatters: row.why_it_matters,
    recommendedNextMoves: row.recommended_next_moves ?? [],
    confidenceSummary: toRecord(row.confidence_summary),
    sourceCoverage,
    sourceCounts,
    sourceIds,
    sourceCount:
      sourceIds.length ||
      Object.values(sourceCounts).reduce((total, count) => total + count, 0),
    sources: mapSourceRefs(packetJson),
    briefMarkdown,
    sections: splitDailyBriefMarkdown(briefMarkdown),
    brief: extractBriefV3(packetJson),
    compilerVersion: row.compiler_version,
    runStatus: isRecord(packetJson.runContract) && typeof packetJson.runContract.status === "string"
      ? packetJson.runContract.status
      : null,
  };
}

async function loadDailyExecutiveBriefTarget(): Promise<IntelligenceTargetRow> {
    const { data, error } = await serviceDb.from("intelligence_targets")
    .select("*")
    .eq("slug", DAILY_EXECUTIVE_BRIEF_TARGET_SLUG)
    .eq("status", "active")
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to resolve canonical Daily Brief target: ${error.message}`);
  }
  if (!data) {
    throw new Error(
      `Canonical Daily Brief target '${DAILY_EXECUTIVE_BRIEF_TARGET_SLUG}' is missing or inactive.`,
    );
  }
  return data;
}

export async function listDailyExecutiveBriefPackets(
  limit = 500,
): Promise<CanonicalDailyBriefPacket[]> {
  const target = await loadDailyExecutiveBriefTarget();
    const { data, error } = await serviceDb.from("intelligence_packets")
    .select("*")
    .eq("target_id", target.id)
    .in("packet_type", ["current", "snapshot"])
    .eq("freshness_status", "fresh")
    .order("generated_at", { ascending: false })
    .limit(limit);

  if (error) {
    throw new Error(`Failed to load canonical Daily Brief packets: ${error.message}`);
  }

  return ((data ?? []) as IntelligencePacketRow[])
    .map(mapPacket)
    .filter((packet) => packet.runStatus === "completed" && hasCompleteDailyBriefMarkdown(packet.briefMarkdown));
}

export async function loadCurrentDailyExecutiveBriefPacket(): Promise<CanonicalDailyBriefPacket> {
  const target = await loadDailyExecutiveBriefTarget();
    const { data, error } = await serviceDb.from("intelligence_packets")
    .select("*")
    .eq("target_id", target.id)
    .eq("packet_type", "current")
    .eq("freshness_status", "fresh")
    .order("generated_at", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load current canonical Daily Brief packet: ${error.message}`);
  }
  if (!data) {
    throw new Error("No canonical Daily Executive Brief packet exists.");
  }
  const packet = mapPacket(data as IntelligencePacketRow);
  const packetJson = toRecord((data as IntelligencePacketRow).packet_json);
  if (!hasCompletedRun(packetJson) || !hasCompleteDailyBriefMarkdown(packet.briefMarkdown)) {
    throw new Error("The current Daily Brief packet is not a completed Executive Intelligence Run.");
  }
  return packet;
}

export async function loadDailyExecutiveBriefPacketById(
  packetId: string,
): Promise<CanonicalDailyBriefPacket | null> {
  const target = await loadDailyExecutiveBriefTarget();
    const { data, error } = await serviceDb.from("intelligence_packets")
    .select("*")
    .eq("id", packetId)
    .eq("target_id", target.id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to load canonical Daily Brief ${packetId}: ${error.message}`);
  }

  if (!data) return null;
  const row = data as IntelligencePacketRow;
  const packet = mapPacket(row);
  if (!hasCompletedRun(toRecord(row.packet_json)) || !hasCompleteDailyBriefMarkdown(packet.briefMarkdown)) {
    return null;
  }
  return packet;
}

export function toDailyBriefHistoryItem(
  packet: CanonicalDailyBriefPacket,
): DailyBriefHistoryItem {
  const decisions = packet.recommendedNextMoves.length;
  const totalItems = decisions || packet.sections.length;

  return {
    id: packet.id,
    recapDate: packet.businessDate,
    dateRangeStart: dateOnly(packet.coveredStartAt) ?? packet.businessDate,
    dateRangeEnd: dateOnly(packet.coveredEndAt) ?? packet.businessDate,
    workflowStatus: packet.packetType === "current" ? "current" : "snapshot",
    approvedAt: null,
    sentAt: null,
    sentTeams: false,
    sentEmail: false,
    createdAt: packet.generatedAt,
    generatedAt: packet.generatedAt,
    modelUsed: packet.compilerVersion,
    windowDays: null,
    hasPacket: true,
    itemCounts: {
      needsBrandon: decisions,
      waitingOnOthers: 0,
      importantUpdates: Math.max(0, totalItems - decisions),
      total: totalItems,
    },
    sourceCoverageCount: packet.sourceCount,
    sourceWarningCount: 0,
  };
}

export function toCanonicalDailyBriefApiResponse(
  packet: CanonicalDailyBriefPacket,
): CanonicalDailyBriefApiResponse {
  return {
    sourceOfTruth: "intelligence_packets",
    targetSlug: DAILY_EXECUTIVE_BRIEF_TARGET_SLUG,
    packet,
  };
}
