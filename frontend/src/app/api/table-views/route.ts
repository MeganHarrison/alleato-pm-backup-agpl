import { NextResponse } from "next/server";
import { z } from "zod";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

// Loose validators — the table-view payload is intentionally schema-agnostic
// since UnifiedTablePage hosts many different entity types. We just enforce
// types and reasonable bounds; column ids are opaque strings owned by the
// individual table configs.

const SCOPE_KEY = z
  .string()
  .trim()
  .min(1)
  .max(120)
  .regex(/^[a-z0-9][a-z0-9_-]*$/, {
    message: "scope_key must be lowercase letters, digits, hyphens, underscores",
  });

const VIEW_NAME = z.string().trim().min(1).max(80);

const FILTER_VALUE = z.union([
  z.string(),
  z.number(),
  z.boolean(),
  z.array(z.string()),
  z.null(),
]);

const VIEW_CONFIG = z.object({
  visible_columns: z.array(z.string()).max(200).optional().nullable(),
  column_order: z.array(z.string()).max(200).optional().nullable(),
  column_widths: z.record(z.string(), z.number().min(80).max(1200)).optional().nullable(),
  sort_by: z.string().trim().max(120).optional().nullable(),
  sort_direction: z.enum(["asc", "desc"]).optional().nullable(),
  filters: z.record(z.string(), FILTER_VALUE).optional().nullable(),
});

const createViewSchema = z
  .object({
    scope_key: SCOPE_KEY,
    name: VIEW_NAME,
    is_default: z.boolean().optional(),
  })
  .merge(VIEW_CONFIG);

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

export const GET = withApiGuardrails(
  "table-views#GET",
  async ({ request }) => {
    const { supabase, userId } = await requireUser("table-views#GET");
    const { searchParams } = new URL(request.url);
    const scopeKey = searchParams.get("scope_key")?.trim();
    if (!scopeKey) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "table-views#GET",
        message: "scope_key query parameter is required.",
        status: 400,
      });
    }

    const { data, error } = await supabase
      .from("user_table_views")
      .select(
        "id, scope_key, name, is_default, visible_columns, column_order, column_widths, sort_by, sort_direction, filters, created_at, updated_at",
      )
      .eq("user_id", userId)
      .eq("scope_key", scopeKey)
      .order("is_default", { ascending: false })
      .order("name", { ascending: true });

    if (error) {
      throw new GuardrailError({
        code: "INTERNAL_ERROR",
        where: "table-views#GET",
        message: error.message,
      });
    }
    return NextResponse.json(data ?? []);
  },
);

export const POST = withApiGuardrails(
  "table-views#POST",
  async ({ request }) => {
    const { supabase, userId } = await requireUser("table-views#POST");

    const body = await request.json().catch(() => null);
    const parsed = createViewSchema.safeParse(body);
    if (!parsed.success) {
      throw new GuardrailError({
        code: "INVALID_PAYLOAD",
        where: "table-views#POST",
        message: parsed.error.issues
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join("; "),
        status: 400,
      });
    }
    const p = parsed.data;

    // If this view will be the default, clear the current default for this scope first.
    if (p.is_default) {
      const { error: clearError } = await supabase
        .from("user_table_views")
        .update({ is_default: false })
        .eq("user_id", userId)
        .eq("scope_key", p.scope_key)
        .eq("is_default", true);
      if (clearError) {
        throw new GuardrailError({
          code: "INTERNAL_ERROR",
          where: "table-views#POST",
          message: clearError.message,
        });
      }
    }

    const insertRow = {
      user_id: userId,
      scope_key: p.scope_key,
      name: p.name,
      is_default: p.is_default ?? false,
      visible_columns: p.visible_columns ?? null,
      column_order: p.column_order ?? null,
      column_widths: p.column_widths ?? null,
      sort_by: p.sort_by ?? null,
      sort_direction: p.sort_direction ?? null,
      filters: p.filters ?? null,
    };

    const { data, error } = await supabase
      .from("user_table_views")
      .insert(insertRow)
      .select(
        "id, scope_key, name, is_default, visible_columns, column_order, column_widths, sort_by, sort_direction, filters, created_at, updated_at",
      )
      .single();

    if (error) {
      // Surface 409 on the unique (user_id, scope_key, name) constraint so the UI can prompt.
      const isUnique =
        error.code === "23505" ||
        error.message?.toLowerCase().includes("user_table_views_unique_name_per_scope");
      throw new GuardrailError({
        code: isUnique ? "INVALID_PAYLOAD" : "INTERNAL_ERROR",
        where: "table-views#POST",
        message: isUnique
          ? `A view named "${p.name}" already exists for this table.`
          : error.message,
        status: isUnique ? 409 : 500,
      });
    }
    return NextResponse.json(data, { status: 201 });
  },
);
