import "server-only";

import type { Json } from "@/types/database.types";
import { serviceDb } from "@/lib/supabase/service-db";

export const DURABLE_AI_SURFACE = "durable_ai";

export type DurableConversation = {
  session_id: string;
  title: string | null;
  last_message_at: string | null;
  created_at: string | null;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function isDurableConversationMetadata(metadata: Json | null): boolean {
  return isRecord(metadata) && metadata.surface === DURABLE_AI_SURFACE;
}

export async function durableConversationBelongsToUser(args: {
  sessionId: string;
  userId: string;
}): Promise<{ belongs: boolean; error: string | null }> {
  const { data, error } = await serviceDb
    .from("conversations")
    .select("metadata")
    .eq("session_id", args.sessionId)
    .eq("user_id", args.userId)
    .maybeSingle();

  if (error) {
    return { belongs: false, error: error.message };
  }

  return {
    belongs: Boolean(data && isDurableConversationMetadata(data.metadata)),
    error: null,
  };
}

export function durableApiError(args: {
  status: number;
  code: string;
  message: string;
  where: string;
  runId?: string | null;
  stage?: string | null;
}): Response {
  return Response.json(
    {
      error: args.message,
      error_code: args.code,
      where_it_failed: args.where,
      details: {
        ...(args.runId ? { runId: args.runId } : {}),
        ...(args.stage ? { stage: args.stage } : {}),
      },
    },
    { status: args.status },
  );
}
