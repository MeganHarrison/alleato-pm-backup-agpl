import { NextResponse } from "next/server";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { assertNonNilUuid } from "@/lib/guardrails/path-params";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { assertMeetingInProject } from "@/lib/meetings/guards";
import { parseProjectId } from "@/lib/meetings/route-params";
import { createItemTaskSchema } from "@/lib/meetings/schemas";

type RouteParams = { projectId: string; meetingId: string; itemId: string };

type MeetingItemRow = {
  id: string;
  meeting_id: string;
  title: string;
  description: string | null;
  assignee_person_id: string | null;
  due_date: string | null;
};

// GET: List tasks generated from an agenda item.
export const GET = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks#GET",
  async ({ params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks#GET";
    const { projectId, meetingId, itemId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);
    assertNonNilUuid(itemId, "itemId", where);

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

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: existingItem } = await supabase
      .from("meeting_items")
      .select("id, meeting_id")
      .eq("id", itemId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (!existingItem) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Agenda item not found in this meeting.",
      });
    }

    const { data: tasks, error: tasksError } = await supabase
      .from("tasks")
      .select("*")
      .eq("meeting_item_id", itemId)
      .order("created_at", { ascending: true });

    if (tasksError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load agenda item tasks: ${tasksError.message}`,
        details: tasksError,
      });
    }

    return NextResponse.json({ tasks: tasks ?? [] });
  },
);

// POST: Create a task from an agenda item. Fields not supplied in the body
// default from the item itself (title, description, assignee, due date).
// `tasks.metadata_id` is a required FK into `document_metadata` — since a
// meeting-agenda-sourced task has no source document, a minimal stub row is
// inserted first (mirrors the project-email task pattern at
// frontend/src/app/api/projects/[projectId]/emails/[emailId]/tasks/route.ts:104-163).
//
// The stub id is deterministic (`meeting-item-task-${itemId}`) and looked up
// before insert, so repeat task creation against the same agenda item reuses
// one stub forever instead of leaving orphaned document_metadata rows behind.
//
// The document trigger intentionally skips meeting_agenda_task rows. Reusing
// one deterministic stub per agenda item also prevents orphan metadata rows.
export const POST = withApiGuardrails<RouteParams>(
  "projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks#POST",
  async ({ request, params }) => {
    const where = "projects/[projectId]/meetings/[meetingId]/items/[itemId]/tasks#POST";
    const { projectId, meetingId, itemId } = await params;
    assertNonNilUuid(meetingId, "meetingId", where);
    assertNonNilUuid(itemId, "itemId", where);

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where,
        message: "Authentication required.",
      });
    }

    const numericProjectId = parseProjectId(projectId, where);
    const payload = await parseJsonBody(request, createItemTaskSchema, where);
    const supabase = await createClient();

    await assertMeetingInProject(supabase, meetingId, numericProjectId, where);

    const { data: itemRow, error: itemError } = await supabase
      .from("meeting_items")
      .select("id, meeting_id, title, description, assignee_person_id, due_date")
      .eq("id", itemId)
      .eq("meeting_id", meetingId)
      .maybeSingle();

    if (itemError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to load agenda item: ${itemError.message}`,
        details: itemError,
      });
    }

    if (!itemRow) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where,
        message: "Agenda item not found in this meeting.",
      });
    }

    const item = itemRow as MeetingItemRow;

    const title = payload.title?.trim() || item.title;
    const description = payload.description?.trim() || item.description || title;
    const assigneePersonId =
      payload.assignee_person_id === undefined
        ? item.assignee_person_id ?? null
        : payload.assignee_person_id;
    const dueDate = payload.due_date === undefined ? item.due_date ?? null : payload.due_date;

    // Deterministic id: one stub per agenda item, no matter how many tasks
    // are created from it. Look up before insert (mirrors the email-tasks
    // route's existingDoc check) so repeat calls never create a duplicate
    // orphan document_metadata row.
    const metadataId = `meeting-item-task-${itemId}`;
    const nowIso = new Date().toISOString();

    const { data: existingDoc, error: existingDocError } = await supabase
      .from("document_metadata")
      .select("id")
      .eq("id", metadataId)
      .maybeSingle();

    if (existingDocError) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to look up task source document: ${existingDocError.message}`,
        details: existingDocError,
      });
    }

    if (!existingDoc) {
      const { error: docInsertError } = await supabase.from("document_metadata").insert({
        id: metadataId,
        title: `Meeting agenda item: ${title}`,
        type: "meeting_agenda_task",
        // Marks the intentionally non-processable stub as terminal.
        status: "done",
        source_system: "meeting_agenda",
        project_id: numericProjectId,
        content: description,
        date: nowIso,
        captured_at: nowIso,
        source_metadata: {
          source: "meeting_agenda",
          meeting_id: meetingId,
          meeting_item_id: itemId,
        },
      });

      if (docInsertError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where,
          message: `Failed to create task source document: ${docInsertError.message}`,
          details: docInsertError,
        });
      }
    }

    const { data: newTask, error: taskInsertError } = await supabase
      .from("tasks")
      .insert({
        metadata_id: metadataId,
        title,
        description,
        assignee_person_id: assigneePersonId,
        due_date: dueDate,
        project_id: numericProjectId,
        project_ids: [numericProjectId],
        meeting_item_id: itemId,
        status: "open",
        source_system: "meeting_agenda",
        extraction_source: "meeting_agenda",
      })
      .select("*")
      .single();

    if (taskInsertError || !newTask) {
      // Best-effort cleanup — only delete the stub if THIS call created it.
      // A pre-existing stub (reused via the lookup above) may already be
      // referenced by other tasks from the same agenda item and must not be
      // torn down here.
      if (!existingDoc) {
        await supabase.from("document_metadata").delete().eq("id", metadataId);
      }

      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where,
        message: `Failed to create task: ${taskInsertError?.message ?? "Unknown insert failure"}`,
        details: taskInsertError,
      });
    }

    return NextResponse.json(newTask, { status: 201 });
  },
);
