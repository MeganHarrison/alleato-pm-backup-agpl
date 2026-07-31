import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { resolveMeetingDocumentId } from "@/lib/meetings/server";

/** Adapts the live meeting_preps table into the legacy digest response shape. */
function toDigestResponse(prep: {
  id: string;
  meeting_id: string;
  project_id: number | null;
  content: string;
  model_used: string | null;
  generation_time_ms: number | null;
  created_at: string | null;
}) {
  return {
    id: prep.id,
    metadata_id: prep.meeting_id,
    project_id: prep.project_id,
    digest_text: prep.content,
    digest_html: null,
    decisions_summary: [],
    action_items_summary: [],
    risks_summary: [],
    opportunities_summary: [],
    follow_ups: [],
    key_takeaways: prep.content
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean)
      .slice(0, 3),
    model_used: prep.model_used ?? "unknown",
    generation_time_seconds:
      prep.generation_time_ms != null
        ? Math.round(prep.generation_time_ms / 1000)
        : null,
    created_at: prep.created_at ?? new Date().toISOString(),
  };
}

// GET: Get the post-meeting digest for a specific meeting
export const GET = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/digest#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/digest#GET";
    const { meetingId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    const authError = null as Error | null;
    if (authError || !user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    const resolved = await resolveMeetingDocumentId(supabase, meetingId);
    if (resolved.kind === "meetings_row_no_transcript") {
      return NextResponse.json(
        { error: "This meeting has no linked transcript yet" },
        { status: 404 }
      );
    }
    const documentMetadataId = resolved.documentMetadataId;

    const { data, error } = await supabase
      .from("meeting_preps")
      .select("*")
      .eq("meeting_id", documentMetadataId)
      .maybeSingle();

    if (error) {
      return apiErrorResponse(error);
    }

    if (!data) {
      return NextResponse.json(
        { error: "Digest not yet generated" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data: toDigestResponse(data) });
    },
);
