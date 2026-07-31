import type { SupabaseClient } from "@supabase/supabase-js";

import { GuardrailError } from "@/lib/guardrails/errors";
import type { Database } from "@/types/database.types";

type ServiceClient = SupabaseClient<Database>;

/**
 * Loads the meeting scoped to the project and throws a 404-shaped
 * GuardrailError when it doesn't exist, belongs to a different project, or is
 * soft-deleted. MUST run before any read/write of a meeting's child rows
 * (categories, items, attendees, etc.) — this is the cross-project write
 * guard established in Task 5.
 */
export async function assertMeetingInProject(
  supabase: ServiceClient,
  meetingId: string,
  numericProjectId: number,
  where: string,
): Promise<void> {
  const { data: existingMeeting } = await supabase
    .from("meetings")
    .select("id, project_id, deleted_at")
    .eq("id", meetingId)
    .eq("project_id", numericProjectId)
    .maybeSingle();

  if (!existingMeeting || existingMeeting.deleted_at) {
    throw new GuardrailError({
      code: "NOT_FOUND",
      where,
      message: "Meeting not found in this project",
    });
  }
}
