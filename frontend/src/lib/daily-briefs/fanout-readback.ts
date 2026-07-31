import "server-only";

import { loadDailyExecutiveBriefPacketById, type CanonicalDailyBriefPacket } from "@/lib/daily-briefs/canonical-packets";
import { createRagServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

export type DailyBriefSourceContent = {
  id: string;
  lane: "meetings" | "teams" | "messages" | "emails" | "documents";
  title: string;
  content: string;
  sourceAt: string | null;
  projectId: number | null;
  projectName: string | null;
  url: string | null;
};

export type DailyBriefFanoutReadback = {
  packet: CanonicalDailyBriefPacket;
  sources: DailyBriefSourceContent[];
  sourceReadError: string | null;
  tasks: Array<{ id: string; title: string | null; project_id: number | null; status: string; due_date: string | null }>;
  insightCards: Array<{
    id: string;
    title: string;
    card_type: string;
    summary: string;
    current_status: string;
    confidence: string;
    attribution_status: string;
    source_count: number;
  }>;
  candidates: Array<{ id: string; title: string; signal_type: string; status: string; project_id: number | null }>;
  candidateReadError: string | null;
  insightCardCount: number;
  progressReports: Array<{ id: string; project_id: number; title: string; status: string | null }>;
  projects: Array<{ id: number; name: string }>;
  allProjects: Array<{ id: number; name: string }>;
  projectIntelligenceLineage: "unverifiable";
};

function sourceLane(lane: string): DailyBriefSourceContent["lane"] {
  if (lane === "meetings") return "meetings";
  if (lane === "emails") return "emails";
  if (lane === "documents") return "documents";
  // Direct messages and channel messages are one source lane for this review.
  return "teams";
}

function textContent(row: { content: string | null; raw_text: string | null; summary: string | null; overview: string | null }) {
  return row.content?.trim() || row.raw_text?.trim() || row.summary?.trim() || row.overview?.trim() || "Source text is unavailable in the indexed record.";
}

export async function loadDailyBriefFanoutReadback(packetId: string): Promise<DailyBriefFanoutReadback> {
  const packet = await loadDailyExecutiveBriefPacketById(packetId);
  if (!packet) {
    throw new Error(`Daily Brief packet ${packetId} was not found.`);
  }
  const sourceIds = packet.sources.map((source) => source.id);
  const rag = createRagServiceClient();

  const [sourceResult, taskResult, candidateResult, cardResult, reportResult] = await Promise.all([
    sourceIds.length
      ? rag.from("rag_document_metadata").select("id,title,content,raw_text,summary,overview,source_system").in("id", sourceIds)
      : Promise.resolve({ data: [], error: null }),
    serviceDb.from("tasks").select("id,title,project_id,status,due_date").contains("extraction_metadata", { daily_packet_id: packet.id }).order("due_date", { ascending: true }),
    rag.from("source_signal_candidates").select("id,title,signal_type,status,project_id").eq("compiler_version", "daily_deep_read_consumers_v1").contains("extraction_json", { daily_packet_id: packet.id }).order("title"),
    serviceDb.from("insight_cards").select("id,title,card_type,summary,current_status,confidence,attribution_status,source_count").contains("metadata", { daily_packet_id: packet.id }).order("card_type").order("title"),
    serviceDb.from("project_progress_reports").select("id,project_id,title,status").contains("source_snapshot", { packetId: packet.id }).order("project_id"),
  ]);

  for (const result of [taskResult, cardResult, reportResult]) {
    if (result.error) throw new Error(`Daily Brief fan-out readback failed: ${result.error.message}`);
  }

  const sourceReadError = sourceResult.error
    ? `RAG source read failed: ${sourceResult.error.message}`
    : null;
  const candidateReadError = candidateResult.error
    ? `RAG candidate read failed: ${candidateResult.error.message}`
    : null;

  const sourceRows = new Map((sourceResult.data ?? []).map((row) => [row.id, row]));
  const sources = packet.sources.map((source) => {
    const row = sourceRows.get(source.id);
    return {
      id: source.id,
      lane: sourceLane(source.lane),
      title: row?.title?.trim() || source.title,
      content: row
        ? textContent(row)
        : sourceReadError ?? "Source record is missing from the indexed corpus.",
      sourceAt: source.sourceAt,
      projectId: source.projectId,
      projectName: source.projectName,
      url: source.url,
    };
  });
  const rowsWithProjectId: Array<{ projectId?: number | null; project_id?: number | null }> = [
    ...sources,
    ...(taskResult.data ?? []),
    ...(candidateResult.data ?? []),
    ...(reportResult.data ?? []),
  ];
  const projectIds = [
    ...new Set(
      rowsWithProjectId
        .map((row) => row.projectId ?? row.project_id)
        .filter((id): id is number => typeof id === "number"),
    ),
  ];
  const [projectsResult, allProjectsResult] = await Promise.all([
    projectIds.length ? serviceDb.from("projects").select("id,name").in("id", projectIds).order("name") : Promise.resolve({ data: [], error: null }),
    serviceDb.from("projects").select("id,name").eq("archived", false).order("name"),
  ]);
  if (projectsResult.error) throw new Error(`Daily Brief project readback failed: ${projectsResult.error.message}`);
  if (allProjectsResult.error) throw new Error(`Daily Brief project options readback failed: ${allProjectsResult.error.message}`);

  return {
    packet,
    sources,
    sourceReadError,
    tasks: taskResult.data ?? [],
    candidates: candidateResult.data ?? [],
    candidateReadError,
    insightCards: cardResult.data ?? [],
    insightCardCount: cardResult.data?.length ?? 0,
    progressReports: reportResult.data ?? [],
    projects: (projectsResult.data ?? []).map((project) => ({ id: Number(project.id), name: project.name ?? `Project ${project.id}` })),
    allProjects: (allProjectsResult.data ?? []).map((project) => ({ id: Number(project.id), name: project.name ?? `Project ${project.id}` })),
    projectIntelligenceLineage: "unverifiable",
  };
}
