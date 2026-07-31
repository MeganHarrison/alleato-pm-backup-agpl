export const dynamic = "force-dynamic";

import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import {
  listLiveTeamsConversations,
  type LiveConversationSummary,
} from "@/lib/microsoft-graph/teams-live";

/**
 * LIVE Teams conversation list — reads Microsoft Graph directly (source of
 * truth), NOT the synced database. Enumerates every chat across the configured
 * mailboxes with members + last-message preview, so ALL conversations show
 * (not just whichever happened to have the most-recent messages). Thread bodies
 * are fetched lazily per chat via /api/teams-live/[chatId].
 */

export type { LiveConversationSummary };

export const GET = withApiGuardrails("teams-live#GET", async (): Promise<NextResponse> => {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where: "teams-live#GET",
      message: "Authentication required.",
    });
  }

  const result = await listLiveTeamsConversations();
  return NextResponse.json({
    conversations: result.conversations,
    source: "microsoft-graph-live",
    checkedMailboxes: result.checkedMailboxes,
    warning: result.warning,
  });
});
