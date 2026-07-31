import "server-only";

import { serviceDb } from "@/lib/supabase/service-db";
import {
  conversationMatchesSurface,
  type AssistantSurface,
} from "./chat-surface";

export async function conversationBelongsToSurface(params: {
  sessionId: string;
  userId: string;
  surface: AssistantSurface;
}): Promise<boolean> {
  const { data, error } = await serviceDb
    .from("conversations")
    .select("metadata")
    .eq("session_id", params.sessionId)
    .eq("user_id", params.userId)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Conversation surface could not be verified: ${error.message}`,
    );
  }

  return Boolean(
    data && conversationMatchesSurface(data.metadata, params.surface),
  );
}
