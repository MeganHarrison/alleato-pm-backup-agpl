import { NextResponse } from "next/server";

import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { loadMeetingDetail } from "@/lib/meetings/server";
import { parseProjectId } from "@/lib/meetings/route-params";
import { renderMeetingPdfBuffer, type MeetingPdfData } from "@/lib/meeting-pdf";

// @react-pdf/renderer requires Node runtime
export const runtime = "nodejs";

// GET: Render a meeting's agenda/minutes as a downloadable PDF.
export const GET = withApiGuardrails<{ projectId: string; meetingId: string }>(
  "projects/[projectId]/meetings/[meetingId]/pdf#GET",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/pdf#GET";
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
    const supabase = await createClient();

    const detail = await loadMeetingDetail(supabase, numericProjectId, meetingId);

    if (!detail) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Meeting not found.",
      });
    }

    // Resolve assignee display names for any agenda items that have one.
    const assigneePersonIds = Array.from(
      new Set(
        detail.categories
          .flatMap((category) => category.items)
          .map((item) => item.assignee_person_id)
          .filter((id): id is string => Boolean(id)),
      ),
    );

    const assigneeNamesById: Record<string, string> = {};
    if (assigneePersonIds.length > 0) {
      const { data: peopleRows, error: peopleError } = await supabase
        .from("people")
        .select("id, first_name, last_name")
        .in("id", assigneePersonIds);

      if (peopleError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to load agenda item assignees: ${peopleError.message}`,
          details: peopleError,
        });
      }

      for (const person of peopleRows ?? []) {
        const name = [person.first_name, person.last_name].filter(Boolean).join(" ").trim();
        assigneeNamesById[person.id] = name || "—";
      }
    }

    const pdfData: MeetingPdfData = {
      ...detail,
      assigneeNamesById,
    };

    const pdfBuffer = await renderMeetingPdfBuffer(pdfData);
    const filename = `meeting-${detail.meeting.number}.pdf`;

    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="${filename}"`,
        "Cache-Control": "private, no-store",
      },
    });
  },
);
