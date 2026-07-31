export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createRagServiceClient, createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";

/**
 * Teams inbox feed for the master-detail Teams Messages view.
 *
 * Returns recent compiled Teams DM conversations from the AI Database
 * (rag_document_metadata, type=teams_dm_conversation). The client parses the
 * `content` into a chat thread and derives participants/preview, so we only
 * ship the raw fields here. Project names are resolved from the PM APP.
 */

export type TeamsInboxConversation = {
  id: string;
  title: string;
  content: string;
  projectId: number | null;
  projectName: string | null;
  updatedAt: string | null;
};

const LIMIT = 200;

export const GET = withApiGuardrails("teams-inbox#GET", async ({ request }): Promise<NextResponse> => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "teams-inbox#GET",
      message: "Authentication required.",
    });
  }

  const { searchParams } = new URL(request.url);
  const q = (searchParams.get("q") ?? "").trim();

  const rag = createRagServiceClient();
  let query = rag
    .from("rag_document_metadata")
    .select("id,title,content,project_id,updated_at")
    .eq("type", "teams_dm_conversation")
    .not("content", "is", null)
    .order("updated_at", { ascending: false })
    .limit(LIMIT);

  if (q) {
    query = query.ilike("content", `%${q}%`);
  }

  const { data, error } = await query;
  if (error) {
    return NextResponse.json(
      { error: `Could not load Teams conversations: ${error.message}` },
      { status: 502 },
    );
  }

  const rows = data ?? [];

  // Resolve project names from the PM APP in one batch.
  const projectIds = Array.from(
    new Set(rows.map((r) => r.project_id).filter((id): id is number => typeof id === "number")),
  );
  const projectNames = new Map<number, string | null>();
  if (projectIds.length > 0) {
    const { data: projects } = await serviceDb
      .from("projects")
      .select("id,name")
      .in("id", projectIds);
    for (const p of projects ?? []) {
      projectNames.set(p.id as number, (p.name as string | null) ?? null);
    }
  }

  const conversations: TeamsInboxConversation[] = rows.map((r) => ({
    id: String(r.id),
    title: (r.title as string | null) ?? "Teams conversation",
    content: (r.content as string | null) ?? "",
    projectId: (r.project_id as number | null) ?? null,
    projectName:
      typeof r.project_id === "number" ? (projectNames.get(r.project_id) ?? null) : null,
    updatedAt: (r.updated_at as string | null) ?? null,
  }));

  return NextResponse.json({ conversations });
});
