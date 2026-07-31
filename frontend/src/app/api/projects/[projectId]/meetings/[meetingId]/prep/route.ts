import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { NextResponse } from "next/server";
import { apiErrorResponse } from "@/lib/api-error";
import { resolveMeetingDocumentId } from "@/lib/meetings/server";

type RouteParams = { params: Promise<{ projectId: string; meetingId: string }> };

// GET: Fetch existing meeting prep
export const GET = withApiGuardrails(
  "projects/[projectId]/meetings/[meetingId]/prep#GET",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/prep#GET";
    const { meetingId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
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
        { error: "No meeting prep found" },
        { status: 404 }
      );
    }

    return NextResponse.json({ data });
    },
);

// PUT: Save/update meeting prep content (auto-save from editor)
export const PUT = withApiGuardrails(
  "projects/[projectId]/meetings/[meetingId]/prep#PUT",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/prep#PUT";
    const { projectId, meetingId } = await params;
    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where, message: "Authentication required." });
    }

    const numericProjectId = parseInt(projectId, 10);
    if (isNaN(numericProjectId)) {
      return NextResponse.json(
        { error: "Invalid project ID" },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { content } = body;

    if (typeof content !== "string") {
      return NextResponse.json(
        { error: "Content is required" },
        { status: 400 }
      );
    }

    const resolved = await resolveMeetingDocumentId(supabase, meetingId);
    if (resolved.kind === "meetings_row_no_transcript") {
      return NextResponse.json(
        { error: "This meeting has no linked transcript yet" },
        { status: 404 }
      );
    }
    const documentMetadataId = resolved.documentMetadataId;

    // Upsert: update if exists, insert if not
    const { data: existing } = await supabase
      .from("meeting_preps")
      .select("id")
      .eq("meeting_id", documentMetadataId)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      const result = await supabase
        .from("meeting_preps")
        .update({ content, updated_at: new Date().toISOString() })
        .eq("meeting_id", documentMetadataId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await supabase
        .from("meeting_preps")
        .insert({
          meeting_id: documentMetadataId,
          project_id: numericProjectId,
          content,
          generated_by: "manual",
        })
        .select()
        .single();
      data = result.data;
      error = result.error;
    }

    if (error) {
      return apiErrorResponse(error);
    }

    return NextResponse.json({ data });
    },
);
