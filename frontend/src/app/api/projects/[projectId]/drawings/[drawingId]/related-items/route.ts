import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

const VALID_RELATED_TYPES = ["rfi", "submittal", "change_order", "observation", "punch_item", "task"] as const;

// UUID v4 regex — validated server-side to prevent junk from reaching the DB
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

/** Map related_type to the Supabase table name used for existence check. */
const RELATED_TYPE_TABLE: Record<string, string> = {
  rfi: "rfis",
  submittal: "submittals",
  observation: "observations",
  punch_item: "punch_items",
  task: "tasks",
  // change_order uses a different composite structure — skip existence check; DB FK will enforce
};

export const GET = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/related-items#GET",
  async ({ params }) => {
    const { projectId, drawingId } = params as { projectId: string; drawingId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/related-items#GET",
        message: "Unauthorized",
        status: 401,
      });
    }

    const { data, error } = await supabase
      .from("drawing_related_items")
      .select("*")
      .eq("drawing_id", drawingId)
      .order("created_at", { ascending: false });

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return NextResponse.json({ items: data || [] });
  },
);

export const POST = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/related-items#POST",
  async ({ request, params }) => {
    const { projectId, drawingId } = params as { projectId: string; drawingId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/related-items#POST",
        message: "Unauthorized",
        status: 401,
      });
    }

    let body: { related_id: string; related_type: string };
    try {
      body = await request.json();
    } catch {
      return NextResponse.json({ error: "Invalid JSON body" }, { status: 400 });
    }

    const { related_id, related_type } = body;
    if (!related_id || !related_type) {
      return NextResponse.json({ error: "related_id and related_type are required" }, { status: 400 });
    }
    if (!UUID_REGEX.test(related_id)) {
      return NextResponse.json({ error: "related_id must be a valid UUID" }, { status: 400 });
    }
    if (!VALID_RELATED_TYPES.includes(related_type as typeof VALID_RELATED_TYPES[number])) {
      return NextResponse.json(
        { error: `related_type must be one of: ${VALID_RELATED_TYPES.join(", ")}` },
        { status: 400 }
      );
    }

    // Verify drawing belongs to project
    const { data: drawing, error: drawingError } = await supabase
      .from("drawings")
      .select("id")
      .eq("id", drawingId)
      .eq("project_id", projectIdNum)
      .single();

    if (drawingError || !drawing) {
      return NextResponse.json({ error: "Drawing not found" }, { status: 404 });
    }

    // Verify the linked entity exists in its source table (where a table mapping is known).
    // This surfaces a clear error instead of silently creating a dangling reference.
    const entityTable = RELATED_TYPE_TABLE[related_type];
    if (entityTable) {
      const { data: entityRow, error: entityError } = await supabase
        .from(entityTable as Parameters<typeof supabase.from>[0])
        .select("id")
        .eq("id", related_id)
        .maybeSingle();
      if (entityError) {
        return NextResponse.json(
          { error: `Could not verify ${related_type} existence: ${entityError.message}` },
          { status: 500 }
        );
      }
      if (!entityRow) {
        return NextResponse.json(
          { error: `${related_type.replace("_", " ")} with ID ${related_id} does not exist` },
          { status: 404 }
        );
      }
    }

    const { data, error } = await supabase
      .from("drawing_related_items")
      .insert({
        drawing_id: drawingId,
        related_id,
        related_type,
        created_by: user.id,
      })
      .select()
      .single();

    if (error) {
      if (error.code === "23505") {
        return NextResponse.json({ error: "This item is already linked to this drawing" }, { status: 409 });
      }
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ item: data }, { status: 201 });
  },
);
