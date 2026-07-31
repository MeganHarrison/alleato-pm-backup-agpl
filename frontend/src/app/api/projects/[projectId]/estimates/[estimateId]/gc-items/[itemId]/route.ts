import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { NextResponse } from "next/server";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

export const PATCH = withApiGuardrails<{ projectId: string; estimateId: string; itemId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items/[itemId]#PATCH",
  async ({ request, params }) => {
    const { estimateId, itemId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items/[itemId]#PATCH", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    const itemIdNum = parseInt(itemId, 10);
    if (isNaN(estimateIdNum) || isNaN(itemIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items/[itemId]#PATCH",
        message: "Invalid estimate GC item ID.",
        details: { estimateId, itemId },
      });
    }

    const body = await request.json();

    const { data, error } = await supabase
      .from("estimate_gc_items")
      .update(body)
      .eq("id", itemIdNum)
      .eq("estimate_id", estimateIdNum)
      .select()
      .single();

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "gc-items/[itemId]#PATCH",
        message: error.message,
        cause: error,
      });
    }

    return NextResponse.json(data);
  }
);

export const DELETE = withApiGuardrails<{ projectId: string; estimateId: string; itemId: string }>(
  "projects/[projectId]/estimates/[estimateId]/gc-items/[itemId]#DELETE",
  async ({ params }) => {
    const { estimateId, itemId } = await params;
    const supabase = await createClient();

    const user = await getApiRouteUser();
    if (!user) {
      throw new GuardrailError({ code: "AUTH_EXPIRED", where: "gc-items/[itemId]#DELETE", message: "Authentication required." });
    }

    const estimateIdNum = parseInt(estimateId, 10);
    const itemIdNum = parseInt(itemId, 10);
    if (isNaN(estimateIdNum) || isNaN(itemIdNum)) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "gc-items/[itemId]#DELETE",
        message: "Invalid estimate GC item ID.",
        details: { estimateId, itemId },
      });
    }

    const { error } = await supabase
      .from("estimate_gc_items")
      .delete()
      .eq("id", itemIdNum)
      .eq("estimate_id", estimateIdNum);

    if (error) {
      throw new GuardrailError({
        code: "DB_ERROR",
        where: "gc-items/[itemId]#DELETE",
        message: error.message,
        cause: error,
      });
    }

    return new Response(null, { status: 204 });
  }
);
