import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const VIEW_NAME = z.string().trim().min(1).max(80);

const FILTER_VALUE = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

// Partial — every field on PATCH is optional. Pass null to explicitly clear.
const updateSchema = z.object({
  name: VIEW_NAME.optional(),
  is_default: z.boolean().optional(),
  visible_columns: z.array(z.string()).max(200).optional().nullable(),
  column_order: z.array(z.string()).max(200).optional().nullable(),
  column_widths: z.record(z.string(), z.number().min(80).max(1200)).optional().nullable(),
  sort_by: z.string().trim().max(120).optional().nullable(),
  sort_direction: z.enum(["asc", "desc"]).optional().nullable(),
  filters: z.record(z.string(), FILTER_VALUE).optional().nullable(),
});

async function requireUser(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Authentication required.",
    });
  }
  return { supabase, userId: user.id };
}

export const PATCH = withApiGuardrails<Promise<{ viewId: string }>>(
  "table-views#PATCH",
  async ({ request, params }) => {
    const { supabase, userId } = await requireUser("table-views#PATCH");
    const { viewId } = params;

    const body = await request.json().catch(() => null);
    const parsed = updateSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "table-views#PATCH",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        status: 400,
      });
    }

    // If setting this view as default, clear the current default in the same scope first.
    if (parsed.data.is_default) {
      const { data: row, error: rowError } = await supabase
        .from("user_table_views")
        .select("scope_key")
        .eq("id", viewId)
        .eq("user_id", userId)
        .maybeSingle();
      if (rowError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "table-views#PATCH",
          message: rowError.message,
        });
      }
      if (!row) {
        throw new GuardrailError({
          code: "NOT_FOUND",
          where: "table-views#PATCH",
          message: "View not found.",
          status: 404,
        });
      }
      const { error: clearError } = await supabase
        .from("user_table_views")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("scope_key", row.scope_key)
        .eq("is_default", true)
        .neq("id", viewId);
      if (clearError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "table-views#PATCH",
          message: clearError.message,
        });
      }
    }

    const { data, error } = await supabase
      .from("user_table_views")
      .update(parsed.data)
      .eq("id", viewId)
      .eq("user_id", userId)
      .select(
        "id, scope_key, name, is_default, visible_columns, column_order, column_widths, sort_by, sort_direction, filters, created_at, updated_at",
      )
      .maybeSingle();

    if (error) {
      const isUnique =
        error.code === "23505" ||
        error.message?.toLowerCase().includes("user_table_views_unique_name_per_scope");
      throw new GuardrailError({
        code: isUnique ? "INVALID_PAYLOAD" : "INTERNAL_ERROR",
        where: "table-views#PATCH",
        message: isUnique
          ? "A view with that name already exists for this table."
          : error.message,
        status: isUnique ? 409 : 500,
      });
    }
    if (!data) {
      throw new GuardrailError({
        code: "NOT_FOUND",
        where: "table-views#PATCH",
        message: "View not found.",
        status: 404,
      });
    }
    return NextResponse.json(data);
  },
);

export const DELETE = withApiGuardrails<Promise<{ viewId: string }>>(
  "table-views#DELETE",
  async ({ params }) => {
    const { supabase, userId } = await requireUser("table-views#DELETE");
    const { viewId } = params;

    const { error } = await supabase
      .from("user_table_views")
      .delete()
      .eq("id", viewId)
      .eq("user_id", userId);

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "table-views#DELETE",
        message: error.message,
      });
    }
    return NextResponse.json({ ok: true });
  },
);
