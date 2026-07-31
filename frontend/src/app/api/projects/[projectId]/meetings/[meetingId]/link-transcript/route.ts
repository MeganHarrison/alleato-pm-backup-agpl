import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";

const linkTranscriptSchema = z.object({
  document_metadata_id: z.string().uuid().nullable(),
});

// POST: Link (or clear, when document_metadata_id is null) a document_metadata
// row as the meeting's transcript. The linked document must belong to the same
// project, be type='meeting', and not be soft-deleted.
export const POST = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/link-transcript#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/link-transcript#POST";
    const { projectId, meetingId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const numericProjectId = parseProjectId(projectId, where);
    const { document_metadata_id: documentMetadataId } = await parseJsonBody(
      request,
      linkTranscriptSchema,
      where,
    );
    const supabase = await createClient();

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

    if (documentMetadataId !== null) {
      const { data: doc, error: docError } = await supabase
        .from("document_metadata")
        .select("id, project_id, type, deleted_at")
        .eq("id", documentMetadataId)
        .maybeSingle();

      if (docError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to look up transcript document: ${docError.message}`,
          details: docError,
        });
      }

      if (!doc) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where,
          message: "Transcript document not found.",
        });
      }

      if (doc.deleted_at) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where,
          message: "Transcript document has been deleted.",
        });
      }

      if (doc.type !== "meeting") {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where,
          message: "Transcript document must be of type 'meeting'.",
        });
      }

      if (doc.project_id !== numericProjectId) {
        throw new GuardrailError({
          code: "INVALID_PAYLOAD",
          where,
          message: "Transcript document belongs to a different project.",
        });
      }
    }

    const { error: updateError } = await supabase
      .from("meetings")
      .update({ transcript_document_id: documentMetadataId })
      .eq("id", meetingId)
      .eq("project_id", numericProjectId);

    if (updateError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to link transcript: ${updateError.message}`,
        details: updateError,
      });
    }

    const detail = await loadMeetingDetail(supabase, numericProjectId, meetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found.",
      });
    }

    return NextResponse.json(detail);
  },
);
