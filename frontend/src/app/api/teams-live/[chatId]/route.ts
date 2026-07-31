export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { getLiveChatMessages, type LiveChatMessage } from "@/lib/microsoft-graph/teams-live";

/** Live thread for one Teams chat — fetched on selection, straight from Graph. */

export type { LiveChatMessage };

export const GET = withApiGuardrails<{ chatId: string }>(
  "teams-live/[chatId]#GET",
  async ({ params }): Promise<NextResponse> => {
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "teams-live/[chatId]#GET",
        message: "Authentication required.",
      });
    }

    const { chatId } = await params;
    if (!chatId) {
      return NextResponse.json({ error: "chatId is required", messages: [] }, { status: 400 });
    }

    try {
      const messages = await getLiveChatMessages(decodeURIComponent(chatId));
      return NextResponse.json({ messages });
    } catch (error) {
      return NextResponse.json(
        { error: error instanceof Error ? error.message : "Failed to load thread", messages: [] },
        { status: 502 },
      );
    }
  },
);
