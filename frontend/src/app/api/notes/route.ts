import { NextResponse } from "next/server";
import { z } from "zod";

import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { createClient } from "@/lib/supabase/server";
import {
  NOTES_SELECT,
  parsePositiveId,
  requirePagesPermission,
  throwNotesDatabaseError,
} from "./_shared";

const CreatePageSchema = z
  .object({
    projectId: z.number().int().positive(),
    title: z.string().trim().max(500).optional(),
    body: z.string().max(1_000_000).optional(),
  })
  .strict();

const UpdatePageSchema = z
  .object({
    projectId: z.number().int().positive(),
    pageId: z.number().int().positive(),
    title: z.string().trim().max(500).optional(),
    body: z.string().max(1_000_000).optional(),
    archived: z.boolean().optional(),
  })
  .strict()
  .refine(
    (value) =>
      typeof value.title !== "undefined" ||
      typeof value.body !== "undefined" ||
      typeof value.archived !== "undefined",
    { message: "At least one page field is required." },
  );

export const GET = withApiGuardrails("/api/notes#GET", async ({ request }) => {
  const projectId = parsePositiveId(
    request.nextUrl.searchParams.get("project_id"),
    "project",
    "/api/notes#GET",
  );
  const guard = await requirePagesPermission(projectId, "read");
  if (guard.denied) return guard.response;

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("notes")
    .select(NOTES_SELECT)
    .eq("project_id", projectId)
    .order("updated_at", { ascending: false, nullsFirst: false })
    .order("created_at", { ascending: false, nullsFirst: false });

  if (error) {
    throwNotesDatabaseError("load", "/api/notes#GET", error);
  }

  return NextResponse.json({ data: data ?? [] });
});

export const POST = withApiGuardrails(
  "/api/notes#POST",
  async ({ request }) => {
    const { projectId, ...input } = await parseJsonBody(
      request,
      CreatePageSchema,
      "/api/notes#POST",
    );
    const guard = await requirePagesPermission(projectId, "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .insert({
        project_id: projectId,
        title: input.title || "Untitled",
        body: input.body ?? "",
        archived: false,
        created_by: guard.userId,
      })
      .select(NOTES_SELECT)
      .single();

    if (error) {
      throwNotesDatabaseError("create", "/api/notes#POST", error);
    }

    return NextResponse.json({ data }, { status: 201 });
  },
);

export const PATCH = withApiGuardrails(
  "/api/notes#PATCH",
  async ({ request }) => {
    const { projectId, pageId, ...input } = await parseJsonBody(
      request,
      UpdatePageSchema,
      "/api/notes#PATCH",
    );
    const guard = await requirePagesPermission(projectId, "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .update({
        ...input,
        updated_at: new Date().toISOString(),
      })
      .eq("project_id", projectId)
      .eq("id", pageId)
      .select(NOTES_SELECT)
      .single();

    if (error) {
      throwNotesDatabaseError("save", "/api/notes#PATCH", error);
    }

    return NextResponse.json({ data });
  },
);

export const DELETE = withApiGuardrails(
  "/api/notes#DELETE",
  async ({ request }) => {
    const projectId = parsePositiveId(
      request.nextUrl.searchParams.get("project_id"),
      "project",
      "/api/notes#DELETE",
    );
    const noteId = parsePositiveId(
      request.nextUrl.searchParams.get("note_id"),
      "page",
      "/api/notes#DELETE",
    );
    const guard = await requirePagesPermission(projectId, "write");
    if (guard.denied) return guard.response;

    const supabase = await createClient();
    const { data, error } = await supabase
      .from("notes")
      .delete()
      .eq("project_id", projectId)
      .eq("id", noteId)
      .select("id")
      .maybeSingle();

    if (error) {
      throwNotesDatabaseError("delete", "/api/notes#DELETE", error);
    }

    if (!data) {
      throwNotesDatabaseError("delete", "/api/notes#DELETE", {
        code: "PGRST116",
        message: "No project page matched the requested project and page ids.",
      });
    }

    return new NextResponse(null, { status: 204 });
  },
);
