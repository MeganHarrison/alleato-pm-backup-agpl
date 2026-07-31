import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { getApiRouteUser } from "@/lib/supabase/server";
import { createServiceClient } from "@/lib/supabase/service";
import { serviceDb } from "@/lib/supabase/service-db";
import { NextResponse } from "next/server";
import { generateText, isStepCount } from "ai";
import { getLanguageModel } from "@/lib/ai/providers";
import { createProjectTools } from "@/lib/ai/tools/project-tools";
import {
  buildMeetingPrepSystemPrompt,
  buildMeetingPrepUserMessage,
} from "@/lib/ai/prompts/meeting-prep";
import { apiErrorResponse } from "@/lib/api-error";
import { resolveMeetingDocumentId } from "@/lib/meetings/server";

const MODEL_ID = "anthropic/claude-sonnet-4.5";

type RouteParams = { params: Promise<{ projectId: string; meetingId: string }> };

// POST: Generate meeting prep using AI
export const POST = withApiGuardrails(
  "projects/[projectId]/meetings/[meetingId]/prep/generate#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/prep/generate#POST";
    const { projectId, meetingId: rawMeetingId } = await params;
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

    const serviceClient = createServiceClient();

    // Resolve meetingId -> the document_metadata id this legacy AI-prep logic
    // operates on. If meetingId is a new meetings-table UUID, that's its
    // linked transcript document (404 with a clear message if unlinked); if
    // it doesn't match a meetings row, treat it as a legacy document id
    // directly (pre-existing behavior).
    const resolved = await resolveMeetingDocumentId(serviceClient, rawMeetingId);
    if (resolved.kind === "meetings_row_no_transcript") {
      return NextResponse.json(
        { error: "This meeting has no linked transcript yet" },
        { status: 404 }
      );
    }
    const meetingId = resolved.documentMetadataId;

    // 1. Fetch the meeting we're prepping for
    const { data: meeting, error: meetingError } = await serviceDb.from("document_metadata")
      .select("*")
      .eq("id", meetingId)
      .eq("project_id", numericProjectId)
      .is("deleted_at", null)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json(
        { error: "Meeting not found" },
        { status: 404 }
      );
    }

    // 2. Fetch the last completed meeting for this project
    const { data: lastMeeting } = await serviceDb.from("document_metadata")
      .select("*")
      .eq("project_id", numericProjectId)
      .eq("type", "meeting")
      .eq("status", "complete")
      .is("deleted_at", null)
      .neq("id", meetingId)
      .order("date", { ascending: false })
      .limit(1)
      .maybeSingle();

    // 3. Fetch prior prep context for the last meeting (if it exists).
    let lastDigest = null;
    if (lastMeeting) {
      const { data: digest } = await serviceDb.from("meeting_preps")
        .select("content")
        .eq("meeting_id", lastMeeting.id)
        .maybeSingle();
      lastDigest = digest;
    }

    // 4. Build context and generate
    const startTime = Date.now();

    const systemPrompt = buildMeetingPrepSystemPrompt();
    const userMessage = buildMeetingPrepUserMessage({
      meetingTitle: meeting.title || "Untitled Meeting",
      meetingDate: meeting.date,
      meetingType: meeting.category,
      participants: meeting.participants,
      projectId: numericProjectId,
      projectName: meeting.project,
      lastMeetingTitle: lastMeeting?.title,
      lastMeetingDate: lastMeeting?.date,
      lastMeetingDigest: lastDigest?.content,
      lastMeetingActionItems: undefined,
      lastMeetingDecisions: undefined,
    });

    const tools = createProjectTools(user.id);

    const result = await generateText({
      model: getLanguageModel(MODEL_ID),
      instructions: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      tools,
      stopWhen: isStepCount(7),
    });

    const generationTimeMs = Date.now() - startTime;
    const content = result.text;

    if (!content) {
      return NextResponse.json(
        { error: "AI generated empty content" },
        { status: 500 }
      );
    }

    // 5. Upsert into meeting_preps
    const { data: existing } = await serviceDb.from("meeting_preps")
      .select("id, version")
      .eq("meeting_id", meetingId)
      .maybeSingle();

    let data;
    let error;

    if (existing) {
      const result = await serviceDb.from("meeting_preps")
        .update({
          content,
          generated_by: "ai",
          model_used: MODEL_ID,
          generation_time_ms: generationTimeMs,
          version: existing.version + 1,
          updated_at: new Date().toISOString(),
        })
        .eq("meeting_id", meetingId)
        .select()
        .single();
      data = result.data;
      error = result.error;
    } else {
      const result = await serviceDb.from("meeting_preps")
        .insert({
          meeting_id: meetingId,
          project_id: numericProjectId,
          content,
          generated_by: "ai",
          model_used: MODEL_ID,
          generation_time_ms: generationTimeMs,
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
