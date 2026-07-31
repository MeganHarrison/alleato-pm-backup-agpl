import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";

export const DELETE = withApiGuardrails(
  "projects/[projectId]/drawings/[drawingId]/related-items/[itemId]#DELETE",
  async ({ params }) => {
    const { projectId, drawingId, itemId } = params as { projectId: string; drawingId: string; itemId: string };
    const projectIdNum = Number(projectId);
    if (isNaN(projectIdNum)) {
      return NextResponse.json({ error: "Invalid project ID" }, { status: 400 });
    }

    const supabase = await createClient();
    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({
        code: "AUTH_EXPIRED",
        where: "projects/[projectId]/drawings/[drawingId]/related-items/[itemId]#DELETE",
        message: "Unauthorized",
        status: 401,
      });
    }

    // Verify item exists and belongs to this drawing
    const { data: item, error: findError } = await supabase
      .from("drawing_related_items")
      .select("id")
      .eq("id", itemId)
      .eq("drawing_id", drawingId)
      .single();

    if (findError || !item) {
      return NextResponse.json({ error: "Related item not found" }, { status: 404 });
    }

    const { error } = await supabase
      .from("drawing_related_items")
      .delete()
      .eq("id", itemId)
      .eq("drawing_id", drawingId);

    if (error) return NextResponse.json({ error: error.message }, { status: 500 });
    return new NextResponse(null, { status: 204 });
  },
);
