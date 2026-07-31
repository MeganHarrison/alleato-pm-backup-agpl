import { NextResponse } from "next/server";
import { withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";
import type { Json } from "@/types/database.types";

export const dynamic = "force-dynamic";

const GET_WHERE = "/api/estimates/gc-templates#GET";
const POST_WHERE = "/api/estimates/gc-templates#POST";

/**
 * `getApiRouteUser()` returns null for anonymous callers — every handler must
 * reject that explicitly. Nothing upstream does it for us: middleware's
 * `shouldBypassSessionMiddleware` exempts all of `/api/` except `/api/admin/`.
 */
async function requireUser(where: string) {
  const user = await getApiRouteUser();
  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Sign in to manage GC templates.",
      status: 401,
    });
  }
  return user;
}

export const GET = withApiGuardrails(GET_WHERE, async () => {
  await requireUser(GET_WHERE);

  const supabase = await createClient();
  const { data, error } = await supabase
    .from("estimate_gc_templates")
    .select("template_id, name, items, created_at")
    .order("created_at", { ascending: false });

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: GET_WHERE,
      message: "Failed to load GC templates.",
      details: { reason: error.message },
    });
  }
  return NextResponse.json(data ?? []);
});

export const POST = withApiGuardrails(POST_WHERE, async ({ request }) => {
  const user = await requireUser(POST_WHERE);
  const supabase = await createClient();

  const body = (await request.json()) as { name: string; items: unknown[] };
  if (!body.name?.trim()) {
    throw new GuardrailError({
      code: "INVALID_PAYLOAD",
      where: POST_WHERE,
      message: "name is required",
      status: 400,
    });
  }

  const { data, error } = await supabase
    .from("estimate_gc_templates")
    .insert({ name: body.name.trim(), items: body.items as Json, created_by: user.id })
    .select()
    .single();

  if (error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: POST_WHERE,
      message: "Failed to save the GC template.",
      details: { reason: error.message },
    });
  }
  return NextResponse.json(data, { status: 201 });
});
