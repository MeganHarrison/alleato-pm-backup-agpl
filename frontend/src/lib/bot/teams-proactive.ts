// frontend/src/lib/bot/teams-proactive.ts
import { getTeamsDelivery } from "@/lib/bot/teams-delivery";
import { serviceDb } from "@/lib/supabase/service-db";

/**
 * Send a proactive DM to a user on Microsoft Teams.
 *
 * Requires that the user has previously messaged the bot (so the Teams adapter
 * has cached their serviceUrl and tenantId in Postgres state). Returns false if
 * the user has no Teams account linked.
 */
export async function sendProactiveTeamsDM(
  supabaseUserId: string,
  message: string,
): Promise<{ sent: boolean; reason?: string }> {

  const { data: mapping, error: lookupError } = await serviceDb.from("bot_user_mappings")
    .select("platform_user_id")
    .eq("platform", "teams")
    .eq("supabase_user_id", supabaseUserId)
    .maybeSingle();

  if (lookupError) {
    throw new Error(`Failed to look up Teams mapping: ${lookupError.message}`);
  }

  if (!mapping) {
    return { sent: false, reason: "no_teams_mapping" };
  }

  const chat = getTeamsDelivery();
  try {
    const dmThread = await chat.openDM(mapping.platform_user_id);
    await dmThread.post(message);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new Error(`Teams adapter failed to send DM to ${mapping.platform_user_id}: ${msg}`);
  }

  return { sent: true };
}
