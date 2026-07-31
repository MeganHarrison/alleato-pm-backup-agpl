import { NextResponse } from "next/server";
import { z } from "zod";
import { parseJsonBody, withApiGuardrails } from "@/lib/guardrails/api";
import { GuardrailError } from "@/lib/guardrails/errors";
import { createClient, getApiRouteUser } from "@/lib/supabase/server";

const OptionalString = z.string().trim().min(1).nullish();
const CompanyContextUpsertSchema = z.object({
  company_name: OptionalString,
  industry: OptionalString,
  company_size: OptionalString,
  headquarters: OptionalString,
  timezone: OptionalString,
  website_url: z.string().url().nullish(),
  mission: OptionalString,
  values: z.array(z.string().trim().min(1)).nullish(),
  communication_style: OptionalString,
  preferred_response_format: OptionalString,
}).passthrough();

async function requireAdmin(where: string) {
  const supabase = await createClient();
  const user = await getApiRouteUser();

  if (!user) {
    throw new GuardrailError({
      code: "AUTH_EXPIRED",
      where,
      message: "Unauthorized request.",
      status: 401,
    });
  }

  const { data: profile } = await supabase
    .from("user_profiles")
    .select("is_admin")
    .eq("id", user.id)
    .single();

  if (!profile?.is_admin) {
    throw new GuardrailError({
      code: "AUTH_FORBIDDEN",
      where,
      message: "Admin access required.",
      status: 403,
    });
  }

  return supabase;
}

/**
 * GET /api/admin/company-context
 * Fetch the company context (singleton row).
 */
export const GET = withApiGuardrails("/api/admin/company-context#GET", async () => {
  const supabase = await requireAdmin("/api/admin/company-context#GET");

  const { data, error } = await supabase
    .from("company_context")
    .select("*")
    .limit(1)
    .single();

  if (error && error.code !== "PGRST116") {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/company-context#GET",
      message: "Failed to load company context.",
      details: {
        reason: error.message,
      },
    });
  }

  return NextResponse.json({ data: data ?? null });
});

/**
 * PUT /api/admin/company-context
 * Upsert the company context (singleton row).
 */
export const PUT = withApiGuardrails("/api/admin/company-context#PUT", async ({ request }) => {
  const supabase = await requireAdmin("/api/admin/company-context#PUT");
  const body = await parseJsonBody(
    request,
    CompanyContextUpsertSchema,
    "/api/admin/company-context#PUT",
  );

  // Check if a row exists
  const { data: existing } = await supabase
    .from("company_context")
    .select("id")
    .limit(1)
    .single();

  let result;
  if (existing) {
    // Update existing row
    const { data, error } = await supabase
      .from("company_context")
      .update({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .eq("id", existing.id)
      .select()
      .single();
    result = { data, error };
  } else {
    // Insert new row
    const { data, error } = await supabase
      .from("company_context")
      .insert({
        ...body,
        updated_at: new Date().toISOString(),
      })
      .select()
      .single();
    result = { data, error };
  }

  if (result.error) {
    throw new GuardrailError({
      code: "INTERNAL_ERROR",
      where: "/api/admin/company-context#PUT",
      message: "Failed to save company context.",
      details: {
        reason: result.error.message,
      },
    });
  }

  return NextResponse.json({ data: result.data });
});
