import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { z } from "zod";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { apiErrorResponse } from "@/lib/api-error";

const createHighlightedNoteSchema = z.object({
  meetingId: z.string().min(1, "Meeting ID is required"),
  selectedText: z.string().trim().min(1, "Selected text is required").max(4000),
  title: z.string().trim().max(200).optional(),
  noteBody: z.string().trim().max(8000).optional(),
});

function truncate(value: string, maxLength: number): string {
  if (value.length <= maxLength) return value;
  return `${value.slice(0, maxLength - 1)}…`;
}

function toBlockQuote(text: string): string {
  return text
    .split("\n")
    .map((line) => `> ${line}`)
    .join("\n");
}

export const POST = withApiGuardrails(
  "notes/highlight#POST",
  async ({ request }) => {
  
    const supabase = await createClient();
    const user = await getApiRouteUser();

    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "notes/highlight#POST", message: "Authentication required." });
    }

    const parseResult = createHighlightedNoteSchema.safeParse(await request.json());
    if (!parseResult.success) {
      return NextResponse.json(
        { error: parseResult.error.issues[0]?.message || "Invalid payload" },
        { status: 400 }
      );
    }

    const { meetingId, selectedText, title, noteBody } = parseResult.data;

    const { data: meeting, error: meetingError } = await supabase
      .from("document_metadata")
      .select("id, title, project_id, date")
      .eq("id", meetingId)
      .single();

    if (meetingError || !meeting) {
      return NextResponse.json({ error: "Meeting not found" }, { status: 404 });
    }

    if (typeof meeting.project_id !== "number") {
      return NextResponse.json(
        { error: "Meeting is not associated with a project" },
        { status: 400 }
      );
    }

    const defaultTitle = truncate(
      `Highlight: ${selectedText.replace(/\s+/g, " ").trim()}`,
      120
    );

    const sourceMeta = [
      `Source meeting: ${meeting.title || meeting.id}`,
      `Meeting ID: ${meeting.id}`,
      meeting.date ? `Meeting date: ${meeting.date}` : null,
    ]
      .filter(Boolean)
      .join(" | ");

    const bodyParts = [
      toBlockQuote(selectedText),
      noteBody || null,
      `---\n${sourceMeta}`,
    ].filter(Boolean);

    const { data: insertedNote, error: insertError } = await supabase
      .from("notes")
      .insert({
        project_id: meeting.project_id,
        title: title || defaultTitle,
        body: bodyParts.join("\n\n"),
        created_by: user.email || user.id,
      })
      .select("id, title")
      .single();

    if (insertError) {
      return apiErrorResponse(insertError);
    }

    return NextResponse.json(
      {
        id: insertedNote.id,
        title: insertedNote.title,
      },
      { status: 201 }
    );
    },
);
