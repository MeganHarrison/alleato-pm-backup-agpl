/**
 * Reusable briefing context loader — extracted from api/ai-assistant/chat/route.ts
 * so it can be imported by the retrieval executor without pulling in the full route.
 *
 * Extracted verbatim. The original inline copy in chat/route.ts re-exports from here
 * for backward compatibility.
 */

import type { SupabaseClient } from "@supabase/supabase-js";
import type { Database } from "@/types/database.types";

// ---------------------------------------------------------------------------
// Types (inlined from chat/route.ts to avoid cross-importing the route module)
// ---------------------------------------------------------------------------

type ProjectBriefingSnapshot = Record<string, unknown>;

type ExecutiveBriefingSourceName =
  | "meetings"
  | "teamsMessages"
  | "emails"
  | "oneDriveDocuments";

type ExecutiveBriefingSourceOutput = {
  source: ExecutiveBriefingSourceName;
  label: string;
  status: "loaded" | "empty" | "warning" | "error";
  resultCount: number;
  results: Array<Record<string, unknown>>;
  message?: string;
  error?: string;
};

export type ExecutiveBriefingRetrievalPacket = {
  query: string;
  projectId?: number;
  projectName?: string;
  sources: ExecutiveBriefingSourceOutput[];
};

export type ReusableBriefingContext = {
  snapshot: ProjectBriefingSnapshot;
  executiveRetrieval: ExecutiveBriefingRetrievalPacket | null;
};

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

function readSnapshotObject(
  snapshot: ProjectBriefingSnapshot | null,
  key: string,
): Record<string, unknown> | null {
  const value = snapshot?.[key];
  return value && typeof value === "object" && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function normalizeReusableBriefingContext(value: unknown): ReusableBriefingContext | null {
  if (!isRecord(value)) return null;

  const snapshot = value.project_briefing_snapshot;
  if (!isRecord(snapshot)) return null;

  const packet = value.executive_briefing_retrieval;
  const executiveRetrieval =
    isRecord(packet) && Array.isArray(packet.sources)
      ? (packet as ExecutiveBriefingRetrievalPacket)
      : null;

  return {
    snapshot,
    executiveRetrieval,
  };
}

function briefingContextMatchesProject(params: {
  snapshot: ProjectBriefingSnapshot;
  executiveRetrieval: ExecutiveBriefingRetrievalPacket | null;
  projectName?: string;
}): boolean {
  const requestedProject = params.projectName?.trim().toLowerCase();
  if (!requestedProject) return true;

  const project = readSnapshotObject(params.snapshot, "project");
  const projectNames = [
    typeof project?.name === "string" ? project.name.trim().toLowerCase() : "",
    params.executiveRetrieval?.projectName?.trim().toLowerCase() ?? "",
  ].filter((name) => name.length > 0);

  return projectNames.some((name) =>
    name.includes(requestedProject) || requestedProject.includes(name),
  );
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function loadReusableBriefingContext(params: {
  supabase: SupabaseClient<Database>;
  sessionId: string;
  projectName?: string;
}): Promise<ReusableBriefingContext | null> {
  const { data, error } = await params.supabase
    .from("chat_history")
    .select("metadata")
    .eq("session_id", params.sessionId)
    .eq("role", "assistant")
    .order("created_at", { ascending: false })
    .limit(5);

  if (error) return null;

  for (const row of data ?? []) {
    const reusable = normalizeReusableBriefingContext((row as Record<string, unknown>).metadata);
    if (!reusable) continue;
    if (
      !briefingContextMatchesProject({
        ...reusable,
        projectName: params.projectName,
      })
    ) {
      continue;
    }
    return reusable;
  }

  return null;
}
